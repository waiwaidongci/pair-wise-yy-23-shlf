// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { closeAllContexts, openContext } from "../services/appContext";
import { setDeviceSource } from "../utils/syncMeta";
import { setForcedOffline } from "../utils/connectivity";
import { clearHubBatches } from "../db/hubDatabase";
import { ServiceError } from "../utils/errors";

const VOLUNTEER = "volunteer-e2e";

async function deleteDatabases() {
  const names = ["braille-trainer-db", `braille-trainer-db:${VOLUNTEER}`, "braille-trainer-hub-db"];
  await Promise.all(
    names.map(
      (name) =>
        new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase(name);
          req.onsuccess = () => resolve();
          req.onblocked = () => resolve();
          req.onerror = () => resolve();
        })
    )
  );
}

describe("离线批次同步端到端", () => {
  beforeEach(async () => {
    await closeAllContexts();
    setDeviceSource("main");
    await clearHubBatches();
    await deleteDatabases();
  });

  it("断网存本机 → 失败保留 → 恢复重试 → 主设备合并 → 重复合并不多算", async () => {
    // 1. volunteer opens (fresh DB seeds/migrates), practices offline
    setForcedOffline(true);
    const volunteer = await openContext(VOLUNTEER);
    const session = await volunteer.practiceService.startSession(1, "CELL_TO_TEXT");
    await volunteer.practiceService.recordAnswer({
      sessionUuid: session.uuid,
      lesson_id: 1,
      symbol_id: 1,
      user_answer: "a",
      correct: true,
      latency_ms: 1500
    });
    await volunteer.practiceService.finishSession({ sessionUuid: session.uuid, score: 100, mistake_count: 0 });

    const outboxBefore = await volunteer.syncService.listOutbox();
    expect(outboxBefore).toHaveLength(1);
    expect(outboxBefore[0].payload.ops.length).toBe(4); // session + answer + progress + finished session

    // 2. push while offline => retained as FAILED
    await expect(volunteer.syncService.pushOutbox()).rejects.toBeInstanceOf(ServiceError);
    const failed = await volunteer.syncService.listOutbox();
    expect(failed[0].status).toBe("FAILED");
    expect(failed[0].attempts).toBe(1);

    // 3. reconnect and retry => hub receives
    setForcedOffline(false);
    const pushReport = await volunteer.syncService.pushOutbox();
    expect(pushReport.pushed).toEqual([outboxBefore[0].batch_id]);

    // 4. main merges
    const main = await openContext("main");
    const report = await main.syncService.mergeHubIntoMain();
    expect(report.merged).toEqual([outboxBefore[0].batch_id]);

    const mainAnswers = await main.repository.answerRecords.list<{ user_answer: string; source: string }>();
    const offlineAnswer = mainAnswers.find((row) => String(row.user_answer) === "a");
    expect(offlineAnswer).toBeDefined();
    expect(offlineAnswer!.source).toBe(VOLUNTEER);

    // course progress union merged onto main's existing lineage
    const progressRows = await main.repository.lessonProgress.list<{ lesson_id: number; completed_symbol_ids: number[] }>();
    const lessonOne = progressRows.find((row) => row.lesson_id === 1);
    expect(lessonOne).toBeDefined();
    expect(lessonOne!.completed_symbol_ids).toContain(1);

    // mastery recomputed on main from merged valid answers
    const snapshots = await main.repository.masterySnapshots.list<{ symbol_id: number; total: number }>();
    const symbol1 = snapshots.find((row) => row.symbol_id === 1);
    expect((symbol1?.total ?? 0)).toBeGreaterThanOrEqual(2); // seeded answers + merged

    // 5. idempotent re-merge: the same batch sitting in hub is applied once
    const second = await main.syncService.mergeHubIntoMain();
    expect(second.skipped).toEqual([outboxBefore[0].batch_id]);
    const answersAfterReplay = await main.repository.answerRecords.list();
    expect(answersAfterReplay.length).toBe(mainAnswers.length);

    // applied-batch ledger persisted
    const receipts = await main.repository.appliedBatches.list<{ batch_id: string }>();
    expect(receipts.map((receipt) => receipt.batch_id)).toContain(outboxBefore[0].batch_id);
  });
});
