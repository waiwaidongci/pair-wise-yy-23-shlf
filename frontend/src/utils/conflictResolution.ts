import type { SyncEntityName, SyncMeta } from "../types/SyncMeta";
import type { SyncConflict } from "../types/SyncConflict";
import type { RowsByEntity } from "./mergeEngine";

export interface ResolveResult {
  rows: RowsByEntity;
  conflicts: SyncConflict[];
}

// Volunteer picks the source copy to trust. The losing copies are soft-deleted
// (错题本/历史仍能查到), the winner keeps a single physical row, and mastery
// can now include the lineage again.
export function resolveConflict(
  rows: RowsByEntity,
  conflicts: SyncConflict[],
  entity: SyncEntityName,
  lineageId: string,
  winnerUuid: string,
  now: string = new Date().toISOString()
): ResolveResult {
  const conflict = conflicts.find((entry) => entry.id === lineageId && entry.entity === entity);
  if (!conflict) return { rows, conflicts };

  const members = rows[entity].filter(
    (row) => typeof row.lineage_id === "string" && row.lineage_id === lineageId
  ) as Array<Record<string, unknown> & SyncMeta>;
  const winner = members.find((row) => row.uuid === winnerUuid);
  if (!winner) return { rows, conflicts };

  const nextRows = rows[entity].map((row) => {
    if (typeof row.lineage_id !== "string" || row.lineage_id !== lineageId) return row;
    if (row.uuid === winnerUuid) {
      return { ...winner, deleted: false, updated_at: now };
    }
    return { ...row, deleted: true, updated_at: now };
  });

  const nextConflicts = conflicts.map((entry) =>
    entry.id === lineageId && entry.entity === entity
      ? {
          ...entry,
          status: "RESOLVED" as const,
          winner_uuid: winnerUuid,
          member_uuids: members.map((row) => row.uuid),
          resolved_at: now,
          updated_at: now
        }
      : entry
  );

  return { rows: { ...rows, [entity]: nextRows }, conflicts: nextConflicts };
}

export function pendingConflictLineageIds(conflicts: SyncConflict[]): Set<string> {
  return new Set(conflicts.filter((conflict) => conflict.status === "PENDING").map((conflict) => conflict.id));
}
