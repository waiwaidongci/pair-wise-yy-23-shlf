import type { AnswerRecord } from "../types/AnswerRecord";
import { backfillSyncMeta } from "../utils/syncMeta";

export const createDefaultAnswerRecord = (overrides: Partial<AnswerRecord> = {}): AnswerRecord => ({
  id: 1,
  session_id: 1,
  symbol_id: 1,
  user_answer: "",
  correct: false,
  latency_ms: 0,
  mistake_reason: "",
  answered_at: new Date().toISOString(),
  ...overrides
});

export const createAnswerRecordForm = createDefaultAnswerRecord;

export const createAnswerRecordResponse = (
  overrides: Partial<AnswerRecord> = {},
  source = "main"
) => backfillSyncMeta(createDefaultAnswerRecord(overrides) as unknown as Record<string, unknown>, source);
