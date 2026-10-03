import { create } from "zustand";
import {
  listBatches,
  pushLocalBatch,
  pullSimulatedRemoteBatch,
  retryBatch,
  resolveConflict
} from "../services/SyncService";
import { listConflicts } from "../services/MergeService";
import { listProcessedBatches } from "../utils/idempotency";
import type { SyncBatch } from "../types/SyncBatch";
import type { ConflictRecord, ConflictResolution } from "../types/ConflictRecord";

interface SyncState {
  batches: SyncBatch[];
  conflicts: ConflictRecord[];
  processedCount: number;
  online: boolean;
  loading: boolean;
  load: () => Promise<void>;
  pushLocal: () => Promise<{ pushed: boolean; error?: string }>;
  pullRemote: () => Promise<{ inserted: number; updated: number; conflicts: number; alreadyProcessed: boolean }>;
  retry: (batchId: string) => Promise<{ pushed: boolean; error?: string }>;
  resolve: (conflictId: string, resolution: ConflictResolution) => Promise<void>;
  setOnline: (online: boolean) => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  batches: [],
  conflicts: [],
  processedCount: 0,
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  loading: false,

  async load() {
    set({ loading: true });
    const [batches, conflicts, processed] = await Promise.all([
      listBatches(),
      listConflicts(),
      listProcessedBatches()
    ]);
    set({ batches, conflicts, processedCount: processed.length, loading: false });
  },

  async pushLocal() {
    const result = await pushLocalBatch();
    await get().load();
    return { pushed: result.pushed, error: result.error };
  },

  async pullRemote() {
    const result = await pullSimulatedRemoteBatch();
    await get().load();
    return {
      inserted: result.inserted,
      updated: result.updated,
      conflicts: result.conflicts,
      alreadyProcessed: result.alreadyProcessed
    };
  },

  async retry(batchId: string) {
    const result = await retryBatch(batchId);
    await get().load();
    return { pushed: result.pushed, error: result.error };
  },

  async resolve(conflictId: string, resolution: ConflictResolution) {
    await resolveConflict(conflictId, resolution);
    await get().load();
  },

  setOnline(online: boolean) {
    set({ online });
  }
}));
