import { ServiceError, isServiceError } from "../utils/errors";
import { openContext } from "../services/appContext";
import type { RecordAnswerInput } from "../services/practiceService";
import type { PracticeSession } from "../types/PracticeSession";
import type { SyncMeta } from "../types/SyncMeta";
import type { AnswerRecord } from "../types/AnswerRecord";

export class PracticeController {
  async startSession(lessonId: number, mode: string): Promise<PracticeSession & SyncMeta> {
    const context = await openContext();
    try {
      return await context.practiceService.startSession(lessonId, mode);
    } catch (cause) {
      if (isServiceError(cause)) throw cause;
      throw new ServiceError("VALIDATION_FAILED", cause);
    }
  }

  async recordAnswer(input: RecordAnswerInput): Promise<AnswerRecord & SyncMeta> {
    const context = await openContext();
    try {
      return await context.practiceService.recordAnswer(input);
    } catch (cause) {
      if (isServiceError(cause)) throw cause;
      throw new ServiceError("VALIDATION_FAILED", cause);
    }
  }

  async finishSession(sessionUuid: string, score: number, mistakeCount: number): Promise<void> {
    const context = await openContext();
    await context.practiceService.finishSession({ sessionUuid, score, mistake_count: mistakeCount });
  }
}

export const practiceController = new PracticeController();
