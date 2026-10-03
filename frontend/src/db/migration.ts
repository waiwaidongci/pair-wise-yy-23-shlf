import type { SyncMeta, SyncSource, SyncEntityName } from "../types/SyncMeta";

// Deterministic lineage for legacy numeric-id rows. The SAME legacy row on
// independently installed devices must land in the same lineage, otherwise a
// later two-source edit could never be detected as a conflict.
export function legacyLineageId(entity: SyncEntityName, legacyId: number | string): string {
  return `lin:${entity}:${legacyId}`;
}

// Pure v1 -> v2 backfill used by both the IndexedDB upgrade and unit tests.
export function backfillLegacyRow<T extends object>(
  entity: SyncEntityName,
  row: T,
  source: SyncSource = "main",
  now: string = new Date().toISOString()
): T & SyncMeta {
  const probe = row as Record<string, unknown>;
  if (typeof probe.uuid === "string" && typeof probe.lineage_id === "string") {
    return row as T & SyncMeta;
  }
  const legacyId = probe.id;
  const lineage =
    typeof probe.lineage_id === "string"
      ? probe.lineage_id
      : legacyId !== undefined
        ? legacyLineageId(entity, legacyId as number | string)
        : `lin:${entity}:unknown`;
  const uuid = typeof probe.uuid === "string" ? probe.uuid : lineage;
  return {
    ...row,
    uuid,
    lineage_id: lineage,
    source: typeof probe.source === "string" ? probe.source : source,
    revision: typeof probe.revision === "number" ? probe.revision : 1,
    updated_at: typeof probe.updated_at === "string" ? probe.updated_at : now,
    deleted: Boolean(probe.deleted)
  } as T & SyncMeta;
}

export function migrateLegacyTable<T extends object>(
  entity: SyncEntityName,
  rows: T[],
  source: SyncSource = "main",
  now: string = new Date().toISOString()
): Array<T & SyncMeta> {
  return rows.map((row) => backfillLegacyRow(entity, row, source, now));
}
