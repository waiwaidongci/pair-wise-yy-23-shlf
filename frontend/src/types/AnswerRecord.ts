import type { Synced } from "./SyncMeta";

export interface AnswerRecord {
  id: number;
  session_id: number;
  symbol_id: number;
  user_answer: string;
  correct: boolean;
  latency_ms: number;
  mistake_reason: string;
  answered_at: string;
}

export type SyncedAnswerRecord = Synced<AnswerRecord>;
