import type { SyncBatch } from "../types/SyncBatch";

// 同步批次构造器：默认对象、表单对象、响应对象统一由此构造
export const createDefaultSyncBatch = (overrides: Partial<SyncBatch> = {}): SyncBatch => ({
  id: "",
  source: "",
  source_name: "本机",
  created_at: "",
  finished_at: "",
  status: "pending",
  record_count: 0,
  synced_count: 0,
  conflict_count: 0,
  session_count: 0,
  error_message: "",
  payload_hash: "",
  ...overrides
});

export const createSyncBatchForm = createDefaultSyncBatch;
export const createSyncBatchResponse = createDefaultSyncBatch;
