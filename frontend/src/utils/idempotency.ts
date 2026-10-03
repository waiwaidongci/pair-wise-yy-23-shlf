// 幂等控制：已处理批次日志，重复合并不多算
import { getAll, get, put, STORES } from "./storage";
import type { ProcessedBatch } from "../types/SyncBatch";

export async function isBatchProcessed(batchId: string): Promise<boolean> {
  const existing = await get<ProcessedBatch>(STORES.PROCESSED_BATCHES, batchId);
  return Boolean(existing);
}

export async function markBatchProcessed(
  batchId: string,
  recordCount: number,
  result: ProcessedBatch["result"]
): Promise<void> {
  await put(
    STORES.PROCESSED_BATCHES,
    { batchId, processed_at: new Date().toISOString(), record_count: recordCount, result },
    "batchId"
  );
}

export async function listProcessedBatches(): Promise<ProcessedBatch[]> {
  return getAll<ProcessedBatch>(STORES.PROCESSED_BATCHES);
}
