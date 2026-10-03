import { MERGE_STRATEGY, UNION_CONFIG } from "./mergeConfig";
import { sameBusinessPayload } from "./payload";
import { uuid } from "./id";
import type { SyncMeta, SyncEntityName, SyncSource } from "../types/SyncMeta";
import type { SyncBatch, SyncOp } from "../types/SyncBatch";
import type { SyncConflict } from "../types/SyncConflict";

export type AnyRow = Record<string, unknown> & Partial<SyncMeta>;
export type RowsByEntity = Record<SyncEntityName, AnyRow[]>;

export interface MergeInput {
  rows: RowsByEntity;
  conflicts: SyncConflict[];
  appliedBatchIds: ReadonlySet<string>;
}

export interface MergeOutput {
  rows: RowsByEntity;
  conflicts: SyncConflict[];
  appliedBatchIds: string[];
  skippedBatchIds: string[];
  touchedEntities: SyncEntityName[];
}

const EMPTY_ROWS = (): RowsByEntity => ({
  practiceSession: [],
  answerRecord: [],
  lessonProgress: []
});

function hasMeta(row: AnyRow): row is AnyRow & SyncMeta {
  return (
    typeof row.uuid === "string" &&
    typeof row.lineage_id === "string" &&
    typeof row.source === "string" &&
    typeof row.revision === "number"
  );
}

function cloneRows(rows: RowsByEntity): RowsByEntity {
  return {
    practiceSession: rows.practiceSession.map((row) => ({ ...row })),
    answerRecord: rows.answerRecord.map((row) => ({ ...row })),
    lessonProgress: rows.lessonProgress.map((row) => ({ ...row }))
  };
}

function unionOf(prev: unknown, next: unknown): unknown[] {
  return Array.from(new Set([...(Array.isArray(prev) ? prev : []), ...(Array.isArray(next) ? next : [])]));
}

function mergeUnionRow(prev: AnyRow, incoming: AnyRow & SyncMeta, entity: SyncEntityName): AnyRow {
  const cfg = UNION_CONFIG[entity];
  const merged: AnyRow = { ...prev };
  for (const field of cfg.setFields) {
    merged[field] = unionOf(prev[field], incoming[field]);
  }
  for (const field of cfg.latestFields) {
    const a = String(prev[field] ?? "");
    const b = String(incoming[field] ?? "");
    merged[field] = a >= b ? prev[field] : incoming[field];
  }
  // Numeric counters (id/score fields are not used here); keep the higher
  // revision and freshest update time for convergence across re-merges.
  merged.uuid = prev.uuid ?? incoming.uuid;
  merged.lineage_id = prev.lineage_id ?? incoming.lineage_id;
  merged.source = incoming.source;
  merged.revision = Math.max(Number(prev.revision ?? 0), incoming.revision);
  merged.updated_at = String(prev.updated_at ?? "") >= incoming.updated_at ? prev.updated_at : incoming.updated_at;
  merged.deleted = false; // union rows are never tombstoned by a stale delivery
  return merged;
}

function findConflict(conflicts: SyncConflict[], lineageId: string): SyncConflict | undefined {
  return conflicts.find((conflict) => conflict.id === lineageId);
}

function upsertConflict(
  conflicts: SyncConflict[],
  entity: SyncEntityName,
  lineageId: string,
  memberUuids: string[],
  now: string
): SyncConflict[] {
  const members = Array.from(new Set(memberUuids));
  const existing = findConflict(conflicts, lineageId);
  if (existing) {
    return conflicts.map((conflict) =>
      conflict.id === lineageId
        ? { ...conflict, member_uuids: members, status: "PENDING", winner_uuid: "", updated_at: now }
        : conflict
    );
  }
  const conflict: SyncConflict = {
    id: lineageId,
    entity,
    member_uuids: members,
    status: "PENDING",
    winner_uuid: "",
    resolved_at: "",
    created_at: now,
    updated_at: now
  };
  return [...conflicts, conflict];
}

// If both sides converge back to identical content, auto-resolve and collapse
// to the newest single copy (重复合并不多算).
function autoResolveIfConverged(
  conflicts: SyncConflict[],
  rows: RowsByEntity,
  entity: SyncEntityName,
  lineageId: string,
  now: string
): { conflicts: SyncConflict[]; rows: RowsByEntity } {
  const conflict = findConflict(conflicts, lineageId);
  if (!conflict || conflict.status !== "PENDING") return { conflicts, rows };
  const members = rows[entity].filter(
    (row) => hasMeta(row) && row.lineage_id === lineageId && !row.deleted
  ) as Array<AnyRow & SyncMeta>;
  if (members.length >= 2 && members.every((row) => sameBusinessPayload(row, members[0]))) {
    const keep = members.reduce((newest, row) =>
      String(row.updated_at) > String(newest.updated_at) ? row : newest
    );
    rows = {
      ...rows,
      [entity]: rows[entity].filter((row) => !(hasMeta(row) && row.lineage_id === lineageId) || row.uuid === keep.uuid)
    };
    conflicts = conflicts.map((entry) =>
      entry.id === lineageId
        ? {
            ...entry,
            status: "RESOLVED",
            winner_uuid: keep.uuid,
            resolved_at: now,
            updated_at: now,
            member_uuids: [keep.uuid]
          }
        : entry
    );
  }
  return { conflicts, rows };
}

function applyOp(
  rows: RowsByEntity,
  conflicts: SyncConflict[],
  op: SyncOp,
  batchSource: SyncSource,
  now: string
): { rows: RowsByEntity; conflicts: SyncConflict[] } {
  const entity = op.entity;
  const incoming = op.payload as AnyRow;
  if (!hasMeta(incoming)) {
    // Untrusted batch without 来源/修订号: ignore to keep merge idempotent.
    return { rows, conflicts };
  }

  // Defensive: a payload generated elsewhere must share the op uuid/lineage.
  const normalized: AnyRow & SyncMeta = {
    ...incoming,
    uuid: incoming.uuid,
    lineage_id: incoming.lineage_id,
    source: incoming.source || batchSource,
    revision: incoming.revision
  };

  const samePhysical = rows[entity].find((row) => hasMeta(row) && row.uuid === normalized.uuid) as
    | (AnyRow & SyncMeta)
    | undefined;
  if (samePhysical) {
    if (samePhysical.source === normalized.source) {
      // Same device re-delivering one of its own physical rows.
      if (samePhysical.revision === normalized.revision && sameBusinessPayload(samePhysical, normalized)) {
        return { rows, conflicts }; // exact retry: nothing to do
      }
      if (Number(normalized.revision) >= Number(samePhysical.revision ?? 0)) {
        rows = { ...rows, [entity]: rows[entity].map((row) => (row.uuid === normalized.uuid ? normalized : row)) };
        return autoResolveIfConverged(conflicts, rows, entity, normalized.lineage_id, now);
      }
      return { rows, conflicts }; // older revision of same source: stale
    }

    // Same physical uuid but DIFFERENT source: this only happens for legacy
    // rows whose uuid was backfilled deterministically from their numeric id.
    if (MERGE_STRATEGY[entity] === "UNION") {
      const merged = mergeUnionRow(samePhysical, normalized, entity);
      rows = { ...rows, [entity]: rows[entity].map((row) => (row.uuid === samePhysical.uuid ? merged : row)) };
      return { rows, conflicts };
    }
    if (sameBusinessPayload(samePhysical, normalized)) {
      // Independently identical edits: keep one copy, raise no conflict.
      return { rows, conflicts };
    }
    // Genuine two-source fork on a legacy uuid: give the incoming copy its own
    // physical uuid, retain both, and register the pending conflict.
    const forked: AnyRow & SyncMeta = { ...normalized, uuid: uuid() };
    rows = { ...rows, [entity]: [...rows[entity], forked] };
    conflicts = upsertConflict(conflicts, entity, normalized.lineage_id, [samePhysical.uuid, forked.uuid], now);
    return { rows, conflicts };
  }

  const lineageRows = rows[entity].filter((row) => hasMeta(row) && row.lineage_id === normalized.lineage_id);

  if (lineageRows.length === 0) {
    rows = { ...rows, [entity]: [...rows[entity], normalized] };
    return { rows, conflicts };
  }

  // Same lineage already present.
  const lineageRowsAll = lineageRows as Array<AnyRow & SyncMeta>;
  const activeLineageRows = lineageRowsAll.filter((row) => !row.deleted);

  if (MERGE_STRATEGY[entity] === "UNION") {
    const target = activeLineageRows[0] ?? lineageRowsAll[0];
    const merged = mergeUnionRow(target, normalized, entity);
    rows = { ...rows, [entity]: rows[entity].map((row) => (row.uuid === target.uuid ? merged : row)) };
    return { rows, conflicts };
  }

  // BRANCH entities.
  const sameSourceBranch = activeLineageRows.find((row) => row.source === normalized.source);
  if (sameSourceBranch) {
    // A newer/equal revision of THIS source's branch replaces it; older
    // revisions are stale deliveries and change nothing.
    if (normalized.revision > sameSourceBranch.revision) {
      rows = {
        ...rows,
        [entity]: rows[entity].map((row) => (row.uuid === sameSourceBranch.uuid ? normalized : row))
      };
    } else if (sameBusinessPayload(sameSourceBranch, normalized)) {
      return { rows, conflicts };
    } else {
      return { rows, conflicts };
    }
  } else {
    // First delivery of this source's branch into this lineage.
    const otherBranches = activeLineageRows.filter((row) => row.source !== normalized.source);
    const identicalElsewhere = otherBranches.length > 0 && otherBranches.every((row) => sameBusinessPayload(row, normalized));
    if (identicalElsewhere) {
      // Independently identical edits: keep one copy, never double-count.
      return autoResolveIfConverged(conflicts, rows, entity, normalized.lineage_id, now);
    }
    const forked: AnyRow & SyncMeta = { ...normalized, uuid: uuid() };
    rows = { ...rows, [entity]: [...rows[entity], forked] };
    const memberUuids = otherBranches.map((row) => row.uuid as string).concat(forked.uuid);
    conflicts = upsertConflict(conflicts, entity, normalized.lineage_id, memberUuids, now);
  }

  // Re-evaluate convergence across all active branches; identical content on
  // every source collapses the copies and auto-resolves (重复合并不多算).
  return autoResolveIfConverged(conflicts, rows, entity, normalized.lineage_id, now);
}

// Apply one or more offline batches onto current state. Pure: the caller
// persists the output. Re-applying an applied batch id is a no-op, which is
// what makes 恢复网络重试 and 重复合并 safe.
export function mergeBatches(input: MergeInput, batches: SyncBatch[], now: string = new Date().toISOString()): MergeOutput {
  let rows: RowsByEntity = cloneRows(input.rows);
  let conflicts = [...input.conflicts];
  const appliedBatchIds: string[] = [];
  const skippedBatchIds: string[] = [];
  const touched = new Set<SyncEntityName>();

  for (const batch of batches) {
    if (!batch.batch_id || !Array.isArray(batch.ops)) {
      continue; // SYNC_BATCH_TAMPERED: malformed batch never mutates state
    }
    if (input.appliedBatchIds.has(batch.batch_id) || appliedBatchIds.includes(batch.batch_id)) {
      skippedBatchIds.push(batch.batch_id);
      continue;
    }
    for (const op of batch.ops) {
      const result = applyOp(rows, conflicts, op, batch.source, now);
      rows = result.rows;
      conflicts = result.conflicts;
      touched.add(op.entity);
    }
    appliedBatchIds.push(batch.batch_id);
  }

  return {
    rows,
    conflicts,
    appliedBatchIds,
    skippedBatchIds,
    touchedEntities: Array.from(touched)
  };
}
