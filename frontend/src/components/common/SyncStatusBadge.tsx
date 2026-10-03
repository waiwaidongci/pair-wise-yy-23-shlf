import { SyncStatusText } from "../../constants/SyncStatus";
import type { SyncStatus } from "../../types/SyncStatus";

// 同步状态徽标：local 本机未同步 / synced 已同步 / conflict 冲突待处理
export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  const cls = "badge sync-" + status;
  return <span className={cls}>{SyncStatusText[status]}</span>;
}
