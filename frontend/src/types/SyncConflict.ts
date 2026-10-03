import type { SyncEntityName } from "./SyncMeta";

// When the same uuid was edited on two sources and the business payloads
// differ, both copies are retained and grouped here until a volunteer resolves.
export type ConflictStatus = "PENDING" | "RESOLVED";

export interface SyncConflict {
  id: string; // equals the canonical uuid of the divergent row
  entity: SyncEntityName;
  member_uuids: string[];
  status: ConflictStatus;
  winner_uuid: string;
  resolved_at: string;
  created_at: string;
  updated_at: string;
}
