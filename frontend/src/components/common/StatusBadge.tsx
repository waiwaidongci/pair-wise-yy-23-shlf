const BADGE_LABELS: Record<string, string> = {
  ONLINE: "在线",
  OFFLINE: "断网",
  SOURCE_MAIN: "主设备",
  SOURCE_VOLUNTEER: "志愿者设备",
  SYNC_SOURCE: "来源",
  CONFLICT_PENDING: "冲突待处理",
  CONFLICT_RESOLVED: "冲突已解决",
  SYNCED: "已同步",
  PENDING: "待同步",
  FAILED: "同步失败",
  RESOLVED: "已解决",
  NEW: "未学",
  LEARNING: "学习中",
  FAMILIAR: "熟悉",
  MASTERED: "掌握",
  LETTER: "字母",
  NUMBER: "数字",
  PUNCTUATION: "标点",
  CONTRACTION: "缩略",
  EASY: "简单",
  MEDIUM: "中等",
  HARD: "困难"
};

export function StatusBadge({ value }: { value: string }) {
  const className = "badge " + String(value).toLowerCase().replace(/_/g, "-");
  return <span className={className}>{BADGE_LABELS[value] ?? String(value).replace(/_/g, " ")}</span>;
}
