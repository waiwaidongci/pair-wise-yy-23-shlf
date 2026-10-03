// 合并计算 Worker：把耗时的合并/冲突判定放到后台线程，避免阻塞 UI
import { planMerge, type SyncableRecord, type MergePlan } from "../utils/merge";

export interface MergeWorkerInput {
  localAnswers: SyncableRecord[];
  remoteAnswers: SyncableRecord[];
  localSessions: SyncableRecord[];
  remoteSessions: SyncableRecord[];
}

export interface MergeWorkerOutput {
  answerPlan: MergePlan;
  sessionPlan: MergePlan;
}

self.onmessage = (e: MessageEvent<MergeWorkerInput>) => {
  const { localAnswers, remoteAnswers, localSessions, remoteSessions } = e.data;
  const answerPlan = planMerge(localAnswers, remoteAnswers, "answer_record");
  const sessionPlan = planMerge(localSessions, remoteSessions, "practice_session");
  const output: MergeWorkerOutput = { answerPlan, sessionPlan };
  (self as unknown as Worker).postMessage(output);
};
