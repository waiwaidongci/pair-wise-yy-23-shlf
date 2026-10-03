import type { Synced } from "./SyncMeta";

export interface PracticeSession {
  id: number;
  lesson_id: number;
  mode: string;
  started_at: string;
  finished_at: string;
  score: number;
  mistake_count: number;
}

export type SyncedPracticeSession = Synced<PracticeSession>;
