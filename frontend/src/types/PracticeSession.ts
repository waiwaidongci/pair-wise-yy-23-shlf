import type { SyncStatus } from "./SyncStatus";

export interface PracticeSession {
  id: number;
  recordKey: string;        // 复合主键 `${id}::${source}`
  lesson_id: number;
  mode: string;
  started_at: string;
  finished_at: string;
  score: number;
  mistake_count: number;
  source: string;
  revision: number;
  sync_status: SyncStatus;
  conflict_group_id: string;
  backfilled: boolean;
}
