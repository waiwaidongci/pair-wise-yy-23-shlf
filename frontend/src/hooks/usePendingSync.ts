import { useSyncStore } from "../stores/SyncStore";

// 待同步批次数量（pending + failed），用于徽标提醒
export function usePendingSync(): { count: number; failed: number } {
  const batches = useSyncStore((s) => s.batches);
  const pending = batches.filter((b) => b.status === "pending" || b.status === "failed");
  return { count: pending.length, failed: pending.filter((b) => b.status === "failed").length };
}
