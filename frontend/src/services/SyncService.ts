// 同步服务：推送本机批次（失败保留、恢复重试）、拉取远程批次合并、解决冲突
import { listAnswerRecord, saveAnswerRecords } from "../api/AnswerRecord";
import { listPracticeSession, savePracticeSessions } from "../api/PracticeSession";
import { getAll, get, put, putAll, STORES } from "../utils/storage";
import { pushBatch } from "../api/Sync";
import { getDeviceId, getDeviceName } from "../utils/device";
import { createDefaultSyncBatch } from "../constructors/SyncBatchConstructor";
import { createDefaultAnswerRecord } from "../constructors/AnswerRecordConstructor";
import { createDefaultPracticeSession } from "../constructors/PracticeSessionConstructor";
import { recordKey } from "../utils/merge";
import { mergeRemoteBatch } from "./MergeService";
import { logSync } from "../utils/logger";
import type { SyncBatch } from "../types/SyncBatch";
import type { AnswerRecord } from "../types/AnswerRecord";
import type { PracticeSession } from "../types/PracticeSession";
import type { ConflictRecord } from "../types/ConflictRecord";
import type { ConflictResolution } from "../types/ConflictRecord";

function uuid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

// 推送本机批次：收集本机未同步记录，创建批次推送；失败保留本机批次，恢复后重试
export async function pushLocalBatch(): Promise<{ batch: SyncBatch | null; pushed: boolean; error?: string }> {
  const [answers, sessions, deviceId, deviceName] = await Promise.all([
    listAnswerRecord(),
    listPracticeSession(),
    getDeviceId(),
    getDeviceName()
  ]);
  const localAnswers = answers.filter((r) => r.sync_status === "local");
  const localSessions = sessions.filter((r) => r.sync_status === "local");
  if (localAnswers.length === 0 && localSessions.length === 0) {
    return { batch: null, pushed: false };
  }

  const batch = createDefaultSyncBatch({
    id: uuid("batch"),
    source: deviceId,
    source_name: deviceName,
    created_at: now(),
    status: "pending",
    record_count: localAnswers.length,
    session_count: localSessions.length,
    synced_count: 0,
    conflict_count: 0
  });
  await put(STORES.SYNC_BATCHES, batch as unknown as Record<string, unknown>, "id");
  logSync("同步批次创建", { batchId: batch.id, records: batch.record_count, sessions: batch.session_count });

  const result = await pushBatch(batch);
  if (!result.ok) {
    const failed = { ...batch, status: "failed" as const, error_message: result.error ?? "", finished_at: now() };
    await put(STORES.SYNC_BATCHES, failed as unknown as Record<string, unknown>, "id");
    logSync("同步批次失败保留本机", { batchId: batch.id, error: result.error });
    return { batch: failed, pushed: false, error: result.error };
  }

  const syncedAnswers = localAnswers.map((r) => ({ ...r, sync_status: "synced" as const }));
  const syncedSessions = localSessions.map((r) => ({ ...r, sync_status: "synced" as const }));
  await saveAnswerRecords(syncedAnswers);
  await savePracticeSessions(syncedSessions);
  const done = {
    ...batch,
    status: "synced" as const,
    synced_count: localAnswers.length,
    finished_at: now()
  };
  await put(STORES.SYNC_BATCHES, done as unknown as Record<string, unknown>, "id");
  logSync("同步批次成功", { batchId: batch.id });
  return { batch: done, pushed: true };
}

// 重试失败批次：恢复网络后调用，重复推送不影响已同步记录
export async function retryBatch(batchId: string): Promise<{ pushed: boolean; error?: string }> {
  const batch = await get<SyncBatch>(STORES.SYNC_BATCHES, batchId);
  if (!batch || batch.status !== "failed") return { pushed: false };
  logSync("同步批次重试", { batchId });

  const result = await pushBatch(batch);
  if (!result.ok) {
    const failed = { ...batch, status: "failed" as const, error_message: result.error ?? "", finished_at: now() };
    await put(STORES.SYNC_BATCHES, failed as unknown as Record<string, unknown>, "id");
    return { pushed: false, error: result.error };
  }

  const [answers, sessions] = await Promise.all([listAnswerRecord(), listPracticeSession()]);
  const pendingAnswers = answers.filter((r) => r.sync_status === "local");
  const pendingSessions = sessions.filter((r) => r.sync_status === "local");
  await saveAnswerRecords(pendingAnswers.map((r) => ({ ...r, sync_status: "synced" as const })));
  await savePracticeSessions(pendingSessions.map((r) => ({ ...r, sync_status: "synced" as const })));
  const done = {
    ...batch,
    status: "synced" as const,
    synced_count: pendingAnswers.length,
    finished_at: now(),
    error_message: ""
  };
  await put(STORES.SYNC_BATCHES, done as unknown as Record<string, unknown>, "id");
  logSync("同步批次成功", { batchId });
  return { pushed: true };
}

// 模拟志愿者回场：生成一个远程批次并合并（含新记录、冲突、同来源更新）
export async function pullSimulatedRemoteBatch(): Promise<{
  batchId: string;
  alreadyProcessed: boolean;
  inserted: number;
  updated: number;
  conflicts: number;
  skipped: number;
}> {
  const remoteSource = "volunteer-a";
  const batchId = uuid("remote");

  const remoteAnswers: AnswerRecord[] = [
    createDefaultAnswerRecord({
      id: 100,
      recordKey: recordKey(100, remoteSource),
      session_id: 100,
      symbol_id: 3,
      user_answer: "⠉",
      correct: "true",
      latency_ms: "1050",
      source: remoteSource,
      revision: 1,
      sync_status: "synced"
    }),
    createDefaultAnswerRecord({
      id: 101,
      recordKey: recordKey(101, remoteSource),
      session_id: 100,
      symbol_id: 6,
      user_answer: "⠼⠁",
      correct: "false",
      latency_ms: "2400",
      mistake_reason: "DOT_MISSING",
      source: remoteSource,
      revision: 1,
      sync_status: "synced"
    }),
    // 与本机 id=7（main 来源）冲突
    createDefaultAnswerRecord({
      id: 7,
      recordKey: recordKey(7, remoteSource),
      session_id: 2,
      symbol_id: 4,
      user_answer: "⠙",
      correct: "false",
      latency_ms: "2200",
      mistake_reason: "CELL_ORDER",
      source: remoteSource,
      revision: 1,
      sync_status: "synced"
    }),
    // 同来源更高修订号 → 更新本机 8::volunteer-a
    createDefaultAnswerRecord({
      id: 8,
      recordKey: recordKey(8, remoteSource),
      session_id: 1,
      symbol_id: 5,
      user_answer: "⠑",
      correct: "true",
      latency_ms: "1300",
      mistake_reason: "",
      source: remoteSource,
      revision: 2,
      sync_status: "synced"
    })
  ];

  const remoteSessions: PracticeSession[] = [
    createDefaultPracticeSession({
      id: 100,
      recordKey: recordKey(100, remoteSource),
      lesson_id: 1,
      mode: "CELL_TO_TEXT",
      started_at: "2026-10-01T09:00:00Z",
      finished_at: "2026-10-01T09:10:00Z",
      score: 70,
      mistake_count: 3,
      source: remoteSource,
      revision: 1,
      sync_status: "synced"
    })
  ];

  logSync("远程批次拉取", { batchId, source: remoteSource });
  return mergeRemoteBatch(batchId, remoteAnswers, remoteSessions);
}

// 解决冲突：KEEP_LOCAL / KEEP_REMOTE / KEEP_BOTH，解决后重算掌握等级
export async function resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<void> {
  const conflict = await get<ConflictRecord>(STORES.CONFLICTS, conflictId);
  if (!conflict) return;

  const [answers, sessions] = await Promise.all([listAnswerRecord(), listPracticeSession()]);
  const isAnswer = conflict.entity_type === "answer_record";

  const apply = <T extends { recordKey: string; sync_status: string; conflict_group_id: string }>(records: T[]): T[] => {
    if (resolution === "KEEP_LOCAL") {
      return records
        .filter((r) => r.recordKey !== conflict.remote_record_key)
        .map((r) =>
          r.recordKey === conflict.local_record_key
            ? { ...r, sync_status: "synced" as const, conflict_group_id: "" }
            : r
        );
    }
    if (resolution === "KEEP_REMOTE") {
      return records
        .filter((r) => r.recordKey !== conflict.local_record_key)
        .map((r) =>
          r.recordKey === conflict.remote_record_key
            ? { ...r, sync_status: "synced" as const, conflict_group_id: "" }
            : r
        );
    }
    return records.map((r) =>
      r.recordKey === conflict.local_record_key || r.recordKey === conflict.remote_record_key
        ? { ...r, sync_status: "synced" as const, conflict_group_id: "" }
        : r
    );
  };

  if (isAnswer) {
    await saveAnswerRecords(apply(answers));
  } else {
    await savePracticeSessions(apply(sessions));
  }

  const resolved = { ...conflict, resolved: true, resolution, resolved_at: now() };
  await put(STORES.CONFLICTS, resolved as unknown as Record<string, unknown>, "id");
  logSync("冲突解决", { conflictId, resolution });
}

export async function listBatches(): Promise<SyncBatch[]> {
  return getAll<SyncBatch>(STORES.SYNC_BATCHES);
}
