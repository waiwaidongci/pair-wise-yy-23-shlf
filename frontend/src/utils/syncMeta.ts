import type { Synced, SyncSource, SyncMeta } from "../types/SyncMeta";
import { uuid } from "./id";

export const MAIN_SOURCE: SyncSource = "main";
export const LOCAL_DEVICE_PREFIX = "volunteer-";

let currentSource: SyncSource = MAIN_SOURCE;

export function setDeviceSource(source: SyncSource): void {
  currentSource = source;
}

export function getDeviceSource(): SyncSource {
  return currentSource;
}

export function isMainSource(source: SyncSource): boolean {
  return source === MAIN_SOURCE;
}

const META_KEYS: (keyof SyncMeta)[] = ["uuid", "lineage_id", "source", "revision", "updated_at", "deleted"];

export function hasSyncMeta(row: unknown): row is SyncMeta {
  return hasMetaRow(row);
}

// Upgrade backfill: legacy rows lack 来源/修订号. uuid is scoped through
// lineage_id so forked copies can still be grouped after a later sync.
export function backfillSyncMeta<T extends object>(
  row: T,
  source: SyncSource = MAIN_SOURCE,
  now: string = new Date().toISOString()
): T & SyncMeta {
  if (hasMetaRow(row)) return row as T & SyncMeta;
  const candidate = row as Partial<SyncMeta> & { id?: number | string; updated_at?: string; deleted?: boolean };
  const id = uuid();
  return {
    ...row,
    uuid: typeof candidate.uuid === "string" ? candidate.uuid : id,
    lineage_id: typeof candidate.lineage_id === "string" ? candidate.lineage_id : id,
    source: typeof candidate.source === "string" ? candidate.source : source,
    revision: typeof candidate.revision === "number" ? candidate.revision : 1,
    updated_at: typeof candidate.updated_at === "string" ? candidate.updated_at : now,
    deleted: Boolean(candidate.deleted)
  } as T & SyncMeta;
}

// Every local write bumps the per-lineage revision of that source.
export function withRevisionBump<T extends object>(
  row: T & Partial<SyncMeta>,
  source: SyncSource = currentSource,
  now: string = new Date().toISOString()
): T & SyncMeta {
  const base = hasMetaRow(row)
    ? (row as T & SyncMeta)
    : ({ ...backfillSyncMeta(row, source, now), revision: 0 } as T & SyncMeta);
  return {
    ...base,
    uuid: base.uuid,
    lineage_id: base.lineage_id,
    source,
    revision: source === base.source ? base.revision + 1 : 1,
    updated_at: now,
    deleted: Boolean(base.deleted)
  } as T & SyncMeta;
}

function hasMetaRow(row: unknown): row is SyncMeta {
  if (!row || typeof row !== "object") return false;
  const candidate = row as Partial<SyncMeta>;
  return (
    typeof candidate.uuid === "string" &&
    typeof candidate.lineage_id === "string" &&
    typeof candidate.source === "string" &&
    typeof candidate.revision === "number"
  );
}

// Assign a new physical uuid to an incoming forked copy while preserving the
// shared lineage. Used by the merge engine when both sides edited one record.
export function forkPhysicalUuid<T extends SyncMeta>(row: T): T {
  return { ...row, uuid: uuid() };
}

export function stripMeta(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!META_KEYS.includes(key as keyof SyncMeta) && key !== "legacy_ref") out[key] = value;
  }
  return out;
}
