// Worker 客户端：优先用后台线程做合并计算，失败回退主线程
import { planMerge, type SyncableRecord, type MergePlan } from "./merge";
import type { MergeWorkerInput, MergeWorkerOutput } from "../workers/mergeWorker";

export interface OffthreadMergeResult {
  answerPlan: MergePlan;
  sessionPlan: MergePlan;
}

export async function planMergeOffthread(input: MergeWorkerInput): Promise<OffthreadMergeResult> {
  try {
    const worker = new Worker(new URL("../workers/mergeWorker.ts", import.meta.url), { type: "module" });
    return await new Promise<OffthreadMergeResult>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<MergeWorkerOutput>) => {
        worker.terminate();
        resolve(e.data);
      };
      worker.onerror = (err) => {
        worker.terminate();
        reject(err);
      };
      worker.postMessage(input);
    });
  } catch {
    // 回退：主线程计算
    return {
      answerPlan: planMerge(input.localAnswers, input.remoteAnswers, "answer_record"),
      sessionPlan: planMerge(input.localSessions, input.remoteSessions, "practice_session")
    };
  }
}
