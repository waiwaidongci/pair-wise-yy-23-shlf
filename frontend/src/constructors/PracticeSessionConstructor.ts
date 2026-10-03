import type { PracticeSession } from "../types/PracticeSession";

// 练习会话构造器：默认对象、表单对象、响应对象统一由此构造
export const createDefaultPracticeSession = (overrides: Partial<PracticeSession> = {}): PracticeSession => ({
  id: 1,
  recordKey: "",
  lesson_id: 1,
  mode: "CELL_TO_TEXT",
  started_at: "",
  finished_at: "",
  score: 0,
  mistake_count: 0,
  source: "local",
  revision: 1,
  sync_status: "local",
  conflict_group_id: "",
  backfilled: false,
  ...overrides
});

export const createPracticeSessionForm = createDefaultPracticeSession;
export const createPracticeSessionResponse = createDefaultPracticeSession;
