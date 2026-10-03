import type { SyncBatch, SyncOp } from "../types/SyncBatch";
import type { SyncEntityName } from "../types/SyncMeta";
import { uuid } from "../utils/id";

export const createSyncOp = (entity: SyncEntityName, payload: object): SyncOp => ({
  entity,
  uuid: String((payload as { uuid?: unknown }).uuid ?? ""),
  payload: payload as SyncOp["payload"]
});

export const createSyncBatch = (source: string, ops: SyncOp[], now: string = new Date().toISOString()): SyncBatch => ({
  batch_id: uuid(),
  source,
  created_at: now,
  ops
});
