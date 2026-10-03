export const BatchStatus = ["PENDING", "FAILED", "SYNCED"] as const;
export type BatchStatus = (typeof BatchStatus)[number];

export const ConflictStatus = ["PENDING", "RESOLVED"] as const;
export type ConflictStatus = (typeof ConflictStatus)[number];

export const BatchStatusText: Record<BatchStatus, string> = {
  PENDING: "待同步",
  FAILED: "同步失败",
  SYNCED: "已同步"
};

export const ConflictStatusText: Record<ConflictStatus, string> = {
  PENDING: "待处理",
  RESOLVED: "已解决"
};
