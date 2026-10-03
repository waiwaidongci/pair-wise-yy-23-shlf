import { useSyncStore } from "../stores/SyncStore";
import type { ConflictResolution } from "../types/ConflictRecord";

// 冲突解决动作封装
export function useConflictResolver() {
  const resolve = useSyncStore((s) => s.resolve);
  return {
    resolve: (conflictId: string, resolution: ConflictResolution) => resolve(conflictId, resolution)
  };
}
