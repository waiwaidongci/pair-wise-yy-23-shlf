import { Repository } from "./repository";
import { MergeService } from "./mergeService";
import { isOnline } from "../utils/connectivity";
import { pushBatchToHub, listHubBatches } from "../db/hubDatabase";
import { STORE } from "../db/stores";
import { logEvent } from "../utils/logger";
import { ServiceError } from "../utils/errors";
import type { SyncBatch } from "../types/SyncBatch";
import type { SyncQueueEntry } from "../types/SyncBatch";
import type { SyncSource } from "../types/SyncMeta";

export interface SyncReport {
  pushed: string[];
  failed: Array<{ batch_id: string; error: string }>;
  merged: string[];
  skipped: string[];
  mergedByMain: boolean;
}

// Transport + retry policy over the outbox. Failure NEVER deletes a batch:
// 同步失败后保留本机批次，恢复网络重试; the applied-batch ledger guarantees
// 重复合并不多算.
export class SyncService {
  constructor(
    private readonly repo: Repository,
    private readonly merge: MergeService,
    private readonly source: SyncSource
  ) {}

  async listOutbox(): Promise<SyncQueueEntry[]> {
    return this.repo.queue.list<SyncQueueEntry>();
  }

  async pendingCount(): Promise<number> {
    const queue = await this.listOutbox();
    return queue.filter((entry) => entry.status !== "SYNCED").length;
  }

  // Volunteer device side: deliver all open batches to the rendezvous point.
  async pushOutbox(): Promise<SyncReport> {
    const report: SyncReport = { pushed: [], failed: [], merged: [], skipped: [], mergedByMain: false };
    if (!isOnline()) {
      await this.markAllRetryable("offline");
      throw new ServiceError("SYNC_OFFLINE");
    }

    const queue = await this.repo.queue.list<SyncQueueEntry>();
    for (const entry of queue) {
      if (entry.status === "SYNCED") continue;
      try {
        await pushBatchToHub(entry.payload);
        const synced: SyncQueueEntry = {
          ...entry,
          status: "SYNCED",
          attempts: entry.attempts + 1,
          last_error: "",
          updated_at: new Date().toISOString()
        };
        await this.repo.queue.put(synced);
        report.pushed.push(entry.batch_id);
        logEvent("Sync", "同步批次确认", { batch_id: entry.batch_id });
      } catch (cause) {
        const failed: SyncQueueEntry = {
          ...entry,
          status: "FAILED",
          attempts: entry.attempts + 1,
          last_error: cause instanceof Error ? cause.message : String(cause),
          updated_at: new Date().toISOString()
        };
        await this.repo.queue.put(failed);
        report.failed.push({ batch_id: entry.batch_id, error: failed.last_error });
        // Retained in outbox; throw so the UI can show 失败保留 + 恢复重试.
        logEvent("Sync", "同步批次保留", { batch_id: entry.batch_id, error: failed.last_error }, "error");
      }
    }
    if (report.failed.length > 0) throw new ServiceError("SYNC_REJECTED", report.failed);
    return report;
  }

  // Main device side: pull delivered batches and merge them. Idempotent even
  // if a volunteer retried a batch the main already applied.
  async mergeHubIntoMain(): Promise<SyncReport> {
    const report: SyncReport = { pushed: [], failed: [], merged: [], skipped: [], mergedByMain: true };
    if (!isOnline()) throw new ServiceError("SYNC_OFFLINE");

    const inbox = await listHubBatches();
    const batches: SyncBatch[] = inbox.map(({ received_at: _receivedAt, ...batch }) => {
      void _receivedAt;
      return batch;
    });
    if (batches.length === 0) return report;

    const summary = await this.merge.mergeIncoming(batches);
    report.merged = summary.appliedBatchIds;
    report.skipped = summary.skippedBatchIds;
    return report;
  }

  private async markAllRetryable(reason: string): Promise<void> {
    const queue = await this.repo.queue.list<SyncQueueEntry>();
    await this.repo.transaction([STORE.syncQueue], "readwrite", ([store]) => {
      queue
        .filter((entry) => entry.status !== "SYNCED")
        .forEach((entry) =>
          store.put({
            ...entry,
            status: "FAILED",
            attempts: entry.attempts + 1,
            last_error: reason,
            updated_at: new Date().toISOString()
          })
        );
    });
    logEvent("Sync", "同步批次保留", { reason }, "warn");
  }
}
