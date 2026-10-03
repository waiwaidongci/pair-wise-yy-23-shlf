import type { AnswerRecord } from "../types/AnswerRecord";

// 答题记录构造器：默认对象、表单对象、响应对象统一由此构造，避免页面/store 散写默认结构
export const createDefaultAnswerRecord = (overrides: Partial<AnswerRecord> = {}): AnswerRecord => ({
  id: 1,
  recordKey: "",
  session_id: 1,
  symbol_id: 1,
  user_answer: "",
  correct: "false",
  latency_ms: "0",
  mistake_reason: "",
  source: "local",
  revision: 1,
  sync_status: "local",
  conflict_group_id: "",
  backfilled: false,
  ...overrides
});

export const createAnswerRecordForm = createDefaultAnswerRecord;
export const createAnswerRecordResponse = createDefaultAnswerRecord;
