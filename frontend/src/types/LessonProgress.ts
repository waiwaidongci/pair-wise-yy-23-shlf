import type { Synced } from "./SyncMeta";

// Per-lesson course progress. Merges conflict-free as a union CRDT:
// completed symbols from every valid answer survive the merge.
export interface LessonProgress {
  id: number;
  lesson_id: number;
  completed_symbol_ids: number[];
  last_practiced_at: string;
}

export type LessonProgressRow = Synced<LessonProgress>;
