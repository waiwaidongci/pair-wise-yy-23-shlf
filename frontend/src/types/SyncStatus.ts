// 记录同步状态：local 本机未同步 / synced 已同步 / conflict 存在未解决冲突
export const SyncStatus = ["local", "synced", "conflict"] as const;
export type SyncStatus = (typeof SyncStatus)[number];
export const SyncStatusText: Record<SyncStatus, string> = {
  local: "本机未同步",
  synced: "已同步",
  conflict: "冲突待处理"
};
