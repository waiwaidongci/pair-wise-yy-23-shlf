import { practiceController } from "../controllers/practiceController";
import type { PracticeSession } from "../types/PracticeSession";
import type { SyncMeta } from "../types/SyncMeta";
import type { AnswerRecord } from "../types/AnswerRecord";

export async function startSession(lessonId: number, mode: string): Promise<PracticeSession & SyncMeta> {
  return practiceController.startSession(lessonId, mode);
}

export async function recordAnswer(input: {
  sessionUuid: string;
  lesson_id: number;
  symbol_id: number;
  user_answer: string;
  correct: boolean;
  latency_ms: number;
  mistake_reason?: string;
}): Promise<AnswerRecord & SyncMeta> {
  return practiceController.recordAnswer(input);
}

export async function finishSession(sessionUuid: string, score: number, mistakeCount: number): Promise<void> {
  return practiceController.finishSession(sessionUuid, score, mistakeCount);
}
