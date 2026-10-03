import { conflictController } from "../controllers/conflictController";
import type { SyncEntityName } from "../types/SyncMeta";
import type { SyncConflict } from "../types/SyncConflict";

export async function listConflicts(): Promise<SyncConflict[]> {
  return conflictController.list();
}

export async function resolveConflict(
  entity: SyncEntityName,
  lineageId: string,
  winnerUuid: string
): Promise<SyncConflict[]> {
  return conflictController.resolve(entity, lineageId, winnerUuid);
}
