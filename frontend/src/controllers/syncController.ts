import { ServiceError, isServiceError } from "../utils/errors";
import { logEvent } from "../utils/logger";
import { openContext } from "../services/appContext";
import type { SyncReport } from "../services/syncService";

// Controller layer: wraps service errors for the UI and logs every attempt.
// Services wrap persistence errors separately; nothing is swallowed globally.
export class SyncController {
  async pushOutbox(): Promise<SyncReport> {
    const context = await openContext();
    try {
      return await context.syncService.pushOutbox();
    } catch (cause) {
      if (isServiceError(cause)) {
        logEvent("Sync", "同步批次重试", { code: cause.code }, "warn");
        throw cause;
      }
      throw new ServiceError("SYNC_REJECTED", cause);
    }
  }

  async mergeHubIntoMain(): Promise<SyncReport> {
    const context = await openContext();
    try {
      return await context.syncService.mergeHubIntoMain();
    } catch (cause) {
      if (isServiceError(cause)) throw cause;
      throw new ServiceError("SYNC_REJECTED", cause);
    }
  }
}

export const syncController = new SyncController();
