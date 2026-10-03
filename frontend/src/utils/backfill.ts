// 升级回填：旧数据缺少来源(source)与修订号(revision)时回填，保证错题本/历史可查、进度可算
import { recordKey } from "./merge";
import type { SyncableRecord } from "./merge";

export const LEGACY_SOURCE = "legacy";

export function needsBackfill(record: SyncableRecord): boolean {
  return (
    !record.source ||
    record.source === "" ||
    record.revision === undefined ||
    record.revision === null ||
    !record.recordKey
  );
}

// 回填单条记录：缺来源补 legacy，缺修订号补 1，补 recordKey
export function backfillRecord<T extends SyncableRecord>(record: T): T {
  if (!needsBackfill(record)) return record;
  const source = record.source && record.source !== "" ? record.source : LEGACY_SOURCE;
  return {
    ...record,
    source,
    revision: record.revision && record.revision > 0 ? record.revision : 1,
    recordKey: record.recordKey || recordKey(record.id, source),
    sync_status: record.sync_status || "local",
    conflict_group_id: record.conflict_group_id || "",
    backfilled: true
  };
}

export function backfillAll<T extends SyncableRecord>(records: T[]): { records: T[]; backfilledCount: number } {
  let backfilledCount = 0;
  const result = records.map((r) => {
    if (needsBackfill(r)) {
      backfilledCount += 1;
      return backfillRecord(r);
    }
    return r;
  });
  return { records: result, backfilledCount };
}
