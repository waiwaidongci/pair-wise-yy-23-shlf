export const SyncBatchStatus = ["pending", "syncing", "synced", "failed"] as const;
export type SyncBatchStatus = (typeof SyncBatchStatus)[number];
export const SyncBatchStatusText: Record<SyncBatchStatus, string> = {
  pending: "待同步",
  syncing: "同步中",
  synced: "已同步",
  failed: "同步失败"
};
