import { STORE } from "../db/stores";
import { Repository } from "./repository";
import { MergeService } from "./mergeService";
import { createSyncBatch, createSyncOp } from "../constructors/SyncBatchConstructor";
import { isMainSource, withRevisionBump } from "../utils/syncMeta";
import { nextNumericId } from "../utils/id";
import { legacyLineageId } from "../db/migration";
import { logEvent } from "../utils/logger";
import { ServiceError } from "../utils/errors";
import type { AnswerRecord } from "../types/AnswerRecord";
import type { PracticeSession } from "../types/PracticeSession";
import type { LessonProgress } from "../types/LessonProgress";
import type { SyncBatch, SyncOp, SyncQueueEntry } from "../types/SyncBatch";
import type { SyncMeta, SyncSource } from "../types/SyncMeta";

export interface RecordAnswerInput {
  sessionUuid: string;
  lesson_id: number;
  symbol_id: number;
  user_answer: string;
  correct: boolean;
  latency_ms: number;
  mistake_reason?: string;
  answered_at?: string;
}

export interface FinishSessionInput {
  sessionUuid: string;
  score: number;
  mistake_count: number;
  finished_at?: string;
}

// One cohesive offline unit: a session header, its answers and the resulting
// course-progress union. Volunteer devices persist locally AND append the same
// rows to one outbox batch; the main device applies directly (it is the hub).
export class PracticeService {
  constructor(
    private readonly repo: Repository,
    private readonly merge: MergeService,
    private readonly source: SyncSource
  ) {}

  async startSession(lesson_id: number, mode: string): Promise<PracticeSession & SyncMeta> {
    const now = new Date().toISOString();
    const existing = await this.repo.practiceSessions.list<PracticeSession & Partial<SyncMeta>>();
    const id = nextNumericId(existing);
    const source = this.source;
    const session = withRevisionBump(
      {
        id,
        lesson_id,
        mode,
        started_at: now,
        finished_at: "",
        score: 0,
        mistake_count: 0
      } as PracticeSession & Partial<SyncMeta>,
      source,
      now
    );
    await this.repo.practiceSessions.put(session);
    logEvent("PracticeSession", "练习会话创建", { uuid: session.uuid, lesson_id });

    // Volunteer devices enqueue immediately: a device that never finishes a
    // session (battery dies in the community room) must still sync the header.
    if (!isMainSource(source)) {
      await this.appendToOutbox([createSyncOp("practiceSession", session as unknown as Record<string, unknown>)]);
    }
    return session;
  }

  async recordAnswer(input: RecordAnswerInput): Promise<AnswerRecord & SyncMeta> {
    const session = await this.repo.practiceSessions.get<Record<string, unknown>>(input.sessionUuid);
    if (!session) throw new ServiceError("VALIDATION_FAILED", input.sessionUuid);

    const now = input.answered_at ?? new Date().toISOString();
    const source = this.source;
    const existingAnswers = await this.repo.answerRecords.list<AnswerRecord & Partial<SyncMeta>>();
    const id = nextNumericId(existingAnswers);
    const answer = withRevisionBump(
      {
        id,
        session_id: Number(session.id),
        symbol_id: input.symbol_id,
        user_answer: input.user_answer,
        correct: input.correct,
        latency_ms: input.latency_ms,
        mistake_reason: input.mistake_reason ?? "",
        answered_at: now
      } as AnswerRecord & Partial<SyncMeta>,
      source,
      now
    );

    const progress = await this.upsertProgress(input.lesson_id, input.correct ? [input.symbol_id] : [], now, source);

    await this.repo.transaction(
      [STORE.answerRecord, STORE.lessonProgress],
      "readwrite",
      ([answerStore, progressStore]) => {
        answerStore.put(answer);
        progressStore.put(progress);
      }
    );
    logEvent("AnswerRecord", "答题记录创建", { uuid: answer.uuid, symbol_id: input.symbol_id, correct: input.correct });

    if (!isMainSource(source)) {
      await this.appendToOutbox([
        createSyncOp("answerRecord", answer as unknown as Record<string, unknown>),
        createSyncOp("lessonProgress", progress as unknown as Record<string, unknown>)
      ]);
    }

    await this.refreshMastery();
    return answer;
  }

  async finishSession(input: FinishSessionInput): Promise<void> {
    const session = await this.repo.practiceSessions.get<PracticeSession & SyncMeta>(input.sessionUuid);
    if (!session) throw new ServiceError("VALIDATION_FAILED", input.sessionUuid);
    const now = input.finished_at ?? new Date().toISOString();
    const updated = withRevisionBump(
      { ...session, score: input.score, mistake_count: input.mistake_count, finished_at: now },
      this.source,
      now
    );
    await this.repo.practiceSessions.put(updated);
    logEvent("PracticeSession", "练习会话更新", { uuid: updated.uuid, score: input.score });

    if (!isMainSource(this.source)) {
      await this.appendToOutbox([createSyncOp("practiceSession", updated as unknown as Record<string, unknown>)]);
    }
  }

  // Open (or reuse the open) outbox batch for this offline visit.
  async appendToOutbox(ops: SyncOp[]): Promise<SyncQueueEntry> {
    const source = this.source;
    const queue = await this.repo.queue.list<SyncQueueEntry>();
    const open = queue.find((entry) => entry.status !== "SYNCED");
    const now = new Date().toISOString();

    let entry: SyncQueueEntry;
    if (open) {
      const batch: SyncBatch = {
        ...open.payload,
        ops: [...open.payload.ops, ...ops]
      };
      entry = { ...open, payload: batch, updated_at: now, status: open.status === "FAILED" ? "PENDING" : open.status };
    } else {
      const batch = createSyncBatch(source, ops, now);
      entry = {
        batch_id: batch.batch_id,
        source,
        status: "PENDING",
        attempts: 0,
        last_error: "",
        payload: batch,
        created_at: now,
        updated_at: now
      };
      logEvent("Sync", "同步批次创建", { batch_id: entry.batch_id });
    }
    await this.repo.queue.put(entry);
    return entry;
  }

  private async upsertProgress(
    lessonId: number,
    completedSymbolIds: number[],
    now: string,
    source: string
  ): Promise<LessonProgress & SyncMeta> {
    const rows = await this.repo.lessonProgress.list<LessonProgress & SyncMeta>();
    const current = rows.find((row) => row.lesson_id === lessonId && !row.deleted);
    if (current) {
      return withRevisionBump(
        {
          ...current,
          completed_symbol_ids: Array.from(new Set([...current.completed_symbol_ids, ...completedSymbolIds])),
          last_practiced_at: now
        },
        source,
        now
      );
    }
    const created = {
      id: nextNumericId(rows),
      lesson_id: lessonId,
      completed_symbol_ids: completedSymbolIds,
      last_practiced_at: now
    } as LessonProgress & Partial<SyncMeta>;
    // Course progress shares ONE deterministic lineage per lesson across every
    // device, otherwise independently created rows could never union-merge.
    const lineage = legacyLineageId("lessonProgress", `lesson:${lessonId}`);
    const meta: LessonProgress & SyncMeta = {
      ...withRevisionBump(created, source, now),
      uuid: lineage,
      lineage_id: lineage
    };
    return meta;
  }

  private async refreshMastery(): Promise<void> {
    const snapshots = await this.merge.recomputeMastery();
    await this.repo.masterySnapshots.putMany(snapshots);
  }
}
