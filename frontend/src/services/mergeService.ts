import { STORE } from "../db/stores";
import { Repository } from "./repository";
import { mergeBatches } from "../utils/mergeEngine";
import type { RowsByEntity } from "../utils/mergeEngine";
import { pendingConflictLineageIds, resolveConflict } from "../utils/conflictResolution";
import { computeMastery } from "../utils/mastery";
import type { MasterySnapshot } from "../utils/mastery";
import { logEvent } from "../utils/logger";
import { ServiceError } from "../utils/errors";
import type { AppliedBatch } from "../types/SyncBatch";
import type { SyncBatch } from "../types/SyncBatch";
import type { SyncConflict } from "../types/SyncConflict";
import type { SyncEntityName } from "../types/SyncMeta";
import type { BrailleSymbol } from "../types/BrailleSymbol";

type Row = Record<string, unknown>;

export interface MergeSummary {
  appliedBatchIds: string[];
  skippedBatchIds: string[];
  conflicts: SyncConflict[];
  touchedEntities: SyncEntityName[];
}

// Loads every synced store, runs the pure merge engine, then persists rows,
// applied-batch receipts, conflicts and recomputed mastery in one transaction.
export class MergeService {
  constructor(private readonly repo: Repository) {}

  async mergeIncoming(batches: SyncBatch[]): Promise<MergeSummary> {
    if (batches.length === 0) {
      return { appliedBatchIds: [], skippedBatchIds: [], conflicts: await this.repo.conflicts.list(), touchedEntities: [] };
    }
    try {
      const rows: RowsByEntity = {
        practiceSession: await this.repo.practiceSessions.list<Row>(),
        answerRecord: await this.repo.answerRecords.list<Row>(),
        lessonProgress: await this.repo.lessonProgress.list<Row>()
      };
      const conflicts = await this.repo.conflicts.list<SyncConflict>();
      const applied = await this.repo.appliedBatches.list<AppliedBatch>();
      const result = mergeBatches(
        { rows, conflicts, appliedBatchIds: new Set(applied.map((entry) => entry.batch_id)) },
        batches
      );

      const now = new Date().toISOString();
      const receipts: AppliedBatch[] = result.appliedBatchIds.map((batch_id) => {
        const batch = batches.find((item) => item.batch_id === batch_id);
        return {
          batch_id,
          source: batch?.source ?? "unknown",
          applied_at: now,
          op_count: batch?.ops.length ?? 0
        };
      });

      const snapshots = await this.recomputeMastery(result.rows, result.conflicts);

      await this.persist(result.rows, result.conflicts, receipts, snapshots, result.touchedEntities);

      for (const batchId of result.appliedBatchIds) logEvent("Merge", "合并开始", { batch_id: batchId });
      result.skippedBatchIds.forEach((batchId) => logEvent("Merge", "幂等批次跳过", { batch_id: batchId }, "warn"));
      const pending = result.conflicts.filter((conflict) => conflict.status === "PENDING").length;
      if (pending > 0) logEvent("Merge", "双源副本保留", { pending }, "warn");

      return {
        appliedBatchIds: result.appliedBatchIds,
        skippedBatchIds: result.skippedBatchIds,
        conflicts: result.conflicts,
        touchedEntities: result.touchedEntities
      };
    } catch (cause) {
      if (cause instanceof ServiceError) throw cause;
      throw new ServiceError("SYNC_REJECTED", cause);
    }
  }

  async resolve(entity: SyncEntityName, lineageId: string, winnerUuid: string): Promise<SyncConflict[]> {
    const rows: RowsByEntity = {
      practiceSession: await this.repo.practiceSessions.list<Row>(),
      answerRecord: await this.repo.answerRecords.list<Row>(),
      lessonProgress: await this.repo.lessonProgress.list<Row>()
    };
    const conflicts = await this.repo.conflicts.list<SyncConflict>();
    const result = resolveConflict(rows, conflicts, entity, lineageId, winnerUuid);
    const snapshots = await this.recomputeMastery(result.rows, result.conflicts);

    await this.persist(result.rows, result.conflicts, [], snapshots, [entity]);
    logEvent("Merge", "冲突解决确认", { entity, lineage_id: lineageId, winner: winnerUuid });
    return result.conflicts;
  }

  async recomputeMastery(rows?: RowsByEntity, conflicts?: SyncConflict[]): Promise<MasterySnapshot[]> {
    const loaded =
      rows ??
      ({
        practiceSession: await this.repo.practiceSessions.list<Row>(),
        answerRecord: await this.repo.answerRecords.list<Row>(),
        lessonProgress: await this.repo.lessonProgress.list<Row>()
      } satisfies RowsByEntity);
    const loadedConflicts = conflicts ?? (await this.repo.conflicts.list<SyncConflict>());
    const symbols = await this.repo.symbols.list<BrailleSymbol>();
    const pending = pendingConflictLineageIds(loadedConflicts);
    return computeMastery(loaded.answerRecord, symbols, pending);
  }

  private async persist(
    rows: RowsByEntity,
    conflicts: SyncConflict[],
    receipts: AppliedBatch[],
    snapshots: MasterySnapshot[],
    touched: SyncEntityName[]
  ): Promise<void> {
    // One transaction across synced stores so a half-merged batch can never be
    // visible (which would double-count on retry).
    const storeNames = new Set<string>([STORE.syncConflict, STORE.masterySnapshot]);
    touched.forEach((entity) => storeNames.add(storeForEntity(entity)));
    if (receipts.length > 0) storeNames.add(STORE.appliedBatch);

    // Run per store inside one database transaction.
    await this.transactionFor(Array.from(storeNames), async (put) => {
      if (touched.includes("practiceSession")) rows.practiceSession.forEach((row) => put(STORE.practiceSession, row));
      if (touched.includes("answerRecord")) rows.answerRecord.forEach((row) => put(STORE.answerRecord, row));
      if (touched.includes("lessonProgress")) rows.lessonProgress.forEach((row) => put(STORE.lessonProgress, row));
      conflicts.forEach((conflict) => put(STORE.syncConflict, conflict));
      receipts.forEach((receipt) => put(STORE.appliedBatch, receipt));
      snapshots.forEach((snapshot) => put(STORE.masterySnapshot, snapshot));
    });
  }

  protected transactionFor(stores: string[], fn: (put: (store: string, value: unknown) => void) => void): Promise<void> {
    return withStores(this.repo, stores, fn);
  }
}

export function storeForEntity(entity: SyncEntityName): string {
  if (entity === "practiceSession") return STORE.practiceSession;
  if (entity === "answerRecord") return STORE.answerRecord;
  return STORE.lessonProgress;
}

// Put into multiple stores inside one database transaction: a half-written
// batch would otherwise double-count on 恢复网络重试.
function withStores(
  repo: Repository,
  stores: string[],
  fn: (put: (store: string, value: unknown) => void) => void
): Promise<void> {
  return repo.transaction(stores, "readwrite", (objectStores) => {
    const byName = new Map(stores.map((name, index) => [name, objectStores[index]]));
    fn((store, value) => byName.get(store)!.put(value));
  });
}
