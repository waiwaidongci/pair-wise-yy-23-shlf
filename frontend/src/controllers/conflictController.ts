import { ServiceError, isServiceError } from "../utils/errors";
import { openContext } from "../services/appContext";
import type { SyncEntityName } from "../types/SyncMeta";
import type { SyncConflict } from "../types/SyncConflict";

export class ConflictController {
  async list(): Promise<SyncConflict[]> {
    const context = await openContext();
    return context.repository.conflicts.list<SyncConflict>();
  }

  async resolve(entity: SyncEntityName, lineageId: string, winnerUuid: string): Promise<SyncConflict[]> {
    const context = await openContext();
    try {
      return await context.mergeService.resolve(entity, lineageId, winnerUuid);
    } catch (cause) {
      if (isServiceError(cause)) throw cause;
      throw new ServiceError("SYNC_CONFLICT", cause);
    }
  }
}

export const conflictController = new ConflictController();
