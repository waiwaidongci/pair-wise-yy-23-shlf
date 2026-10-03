// 同步 API：模拟网络推送/拉取，支持断网与失败注入，便于演示「失败保留本机批次、恢复重试」
import type { SyncBatch } from "../types/SyncBatch";

let forcedOffline = false;
let forcedFailNext = false;

export interface MockNetworkState {
  offline: boolean;
  failNext: boolean;
  browserOnline: boolean;
}

export function setMockNetwork(opts: { offline?: boolean; failNext?: boolean }): void {
  if (opts.offline !== undefined) forcedOffline = opts.offline;
  if (opts.failNext !== undefined) forcedFailNext = opts.failNext;
}

export function getMockNetwork(): MockNetworkState {
  return {
    offline: forcedOffline,
    failNext: forcedFailNext,
    browserOnline: typeof navigator !== "undefined" ? navigator.onLine : true
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface PushResult {
  ok: boolean;
  error?: "SYNC_OFFLINE" | "SYNC_BATCH_FAILED";
}

export async function pushBatch(_batch: SyncBatch): Promise<PushResult> {
  await delay(350);
  const browserOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (forcedOffline || !browserOnline) return { ok: false, error: "SYNC_OFFLINE" };
  if (forcedFailNext) {
    forcedFailNext = false;
    return { ok: false, error: "SYNC_BATCH_FAILED" };
  }
  return { ok: true };
}
