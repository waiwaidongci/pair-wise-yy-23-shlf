import type { LessonProgress } from "../types/LessonProgress";
import { backfillSyncMeta } from "../utils/syncMeta";

export const createDefaultLessonProgress = (overrides: Partial<LessonProgress> = {}): LessonProgress => ({
  id: 1,
  lesson_id: 1,
  completed_symbol_ids: [],
  last_practiced_at: "",
  ...overrides
});

export const createLessonProgressForm = createDefaultLessonProgress;

export const createLessonProgressResponse = (
  overrides: Partial<LessonProgress> = {},
  source = "main"
) => backfillSyncMeta(createDefaultLessonProgress(overrides) as unknown as Record<string, unknown>, source);
