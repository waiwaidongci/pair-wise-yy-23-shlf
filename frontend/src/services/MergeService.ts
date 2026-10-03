// 合并服务：把远程批次合并入本机，幂等控制，冲突保留两份来源
import { listAnswerRecord, saveAnswerRecords } from "../api/AnswerRecord";
import { listPracticeSession, savePracticeSessions } from "../api/PracticeSession";
import { getAll, putAll, STORES } from "../utils/storage";
import { planMergeOffthread } from "../utils/mergeWorkerClient";
import { isBatchProcessed, markBatchProcessed } from "../utils/idempotency";
import { logSync } from "../utils/logger";
import type { AnswerRecord } from "../types/AnswerRecord";
import type { PracticeSession } from "../types/PracticeSession";
import type { ConflictRecord } from "../types/ConflictRecord";

export interface MergeOutcome {
  batchId: string;
  alreadyProcessed: boolean;
  inserted: number;
  updated: number;
  conflicts: number;
  skipped: number;
}

export async function mergeRemoteBatch(
  batchId: string,
  remoteAnswers: AnswerRecord[],
  remoteSessions: PracticeSession[]
): Promise<MergeOutcome> {
  // 幂等：重复合并不多算
  if (await isBatchProcessed(batchId)) {
    logSync("重复批次幂等跳过", { batchId });
    return { batchId, alreadyProcessed: true, inserted: 0, updated: 0, conflicts: 0, skipped: 0 };
  }

  const [localAnswers, localSessions] = await Promise.all([listAnswerRecord(), listPracticeSession()]);
  // 耗时合并计算放 Web Worker，失败回退主线程
  const { answerPlan, sessionPlan } = await planMergeOffthread({
    localAnswers,
    remoteAnswers,
    localSessions,
    remoteSessions
  });

  await saveAnswerRecords(answerPlan.recordsToPut as AnswerRecord[]);
  await savePracticeSessions(sessionPlan.recordsToPut as PracticeSession[]);
  await putAll(
    STORES.CONFLICTS,
    [...answerPlan.conflictsToCreate, ...sessionPlan.conflictsToCreate] as unknown as Record<string, unknown>[],
    "id"
  );

  const inserted = answerPlan.insertedCount + sessionPlan.insertedCount;
  const updated = answerPlan.updatedCount + sessionPlan.updatedCount;
  const conflicts = answerPlan.conflictCount + sessionPlan.conflictCount;
  const skipped = answerPlan.skippedCount + sessionPlan.skippedCount;

  await markBatchProcessed(batchId, inserted + updated, "synced");
  logSync("远程批次拉取", { batchId, inserted, updated, conflicts, skipped });
  if (conflicts > 0) logSync("冲突检测", { batchId, conflicts });

  return { batchId, alreadyProcessed: false, inserted, updated, conflicts, skipped };
}

export async function listConflicts(): Promise<ConflictRecord[]> {
  return getAll<ConflictRecord>(STORES.CONFLICTS);
}
