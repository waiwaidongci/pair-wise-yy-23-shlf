import type { PracticeSession } from "../types/PracticeSession";
import { backfillSyncMeta } from "../utils/syncMeta";

export const createDefaultPracticeSession = (overrides: Partial<PracticeSession> = {}): PracticeSession => ({
  id: 1,
  lesson_id: 1,
  mode: "CELL_TO_TEXT",
  started_at: new Date().toISOString(),
  finished_at: "",
  score: 0,
  mistake_count: 0,
  ...overrides
});

export const createPracticeSessionForm = createDefaultPracticeSession;

export const createPracticeSessionResponse = (
  overrides: Partial<PracticeSession> = {},
  source = "main"
) => backfillSyncMeta(createDefaultPracticeSession(overrides) as unknown as Record<string, unknown>, source);
