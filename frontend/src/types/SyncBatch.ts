import type { Synced, SyncEntityName, SyncSource } from "./SyncMeta";

export type SyncRow = Synced<object>;

// A single upsert of one row on the producing source.
export interface SyncOp {
  entity: SyncEntityName;
  uuid: string;
  payload: SyncRow;
}

// The unit of offline transfer. Failed batches are kept on the producing
// device and retried; `batch_id` makes receiving a batch idempotent.
export interface SyncBatch {
  batch_id: string;
  source: SyncSource;
  created_at: string;
  ops: SyncOp[];
}

export type BatchStatus = "PENDING" | "FAILED" | "SYNCED";

// Outbox row stored locally while the device is offline.
export interface SyncQueueEntry {
  batch_id: string;
  source: SyncSource;
  status: BatchStatus;
  attempts: number;
  last_error: string;
  payload: SyncBatch;
  created_at: string;
  updated_at: string;
}

export interface AppliedBatch {
  batch_id: string;
  source: SyncSource;
  applied_at: string;
  op_count: number;
}
