import type { SyncBatchStatus } from "./SyncBatchStatus";

// 同步批次：一次推送的本机记录集合，失败后保留本机批次以便重试
export interface SyncBatch {
  id: string;              // 批次唯一 id（幂等键）
  source: string;          // 来源设备 id
  source_name: string;     // 来源设备名称
  created_at: string;
  finished_at: string;
  status: SyncBatchStatus;
  record_count: number;
  synced_count: number;
  conflict_count: number;
  session_count: number;
  error_message: string;
  payload_hash: string;    // 批次内容哈希，重复合并不多算
}

// 已处理批次日志：记录已合并的批次 id，保证重复合并幂等
export interface ProcessedBatch {
  batchId: string;
  processed_at: string;
  record_count: number;
  result: "synced" | "already_processed" | "failed";
}
