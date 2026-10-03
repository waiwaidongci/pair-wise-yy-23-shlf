// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { closeAllContexts, openContext } from "../services/appContext";
import { setDeviceSource } from "../utils/syncMeta";
import { setForcedOffline } from "../utils/connectivity";
import { clearHubBatches } from "../db/hubDatabase";

const VOLUNTEER = "volunteer-union";

async function del(name: string) {
  return new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onblocked = () => resolve();
    req.onerror = () => resolve();
  });
}

describe("课程进度跨设备并集", () => {
  beforeEach(async () => {
    await closeAllContexts();
    setDeviceSource("main");
    setForcedOffline(false);
    await clearHubBatches();
    await Promise.all([del("braille-trainer-db"), del(`braille-trainer-db:${VOLUNTEER}`)]);
  });

  it("两台设备各自第一次练同一节课，完成符号取并集且只有一行", async () => {
    // Main practices lesson 1 symbol 1.
    const main = await openContext("main");
    const mainSession = await main.practiceService.startSession(1, "CELL_TO_TEXT");
    await main.practiceService.recordAnswer({
      sessionUuid: mainSession.uuid, lesson_id: 1, symbol_id: 1, user_answer: "a", correct: true, latency_ms: 1000
    });

    // Volunteer device (fresh DB) independently practices lesson 1 symbol 3.
    setForcedOffline(true);
    const volunteer = await openContext(VOLUNTEER);
    const vSession = await volunteer.practiceService.startSession(1, "CELL_TO_TEXT");
    await volunteer.practiceService.recordAnswer({
      sessionUuid: vSession.uuid, lesson_id: 1, symbol_id: 3, user_answer: "c", correct: true, latency_ms: 1200
    });
    setForcedOffline(false);
    await volunteer.syncService.pushOutbox();

    await main.syncService.mergeHubIntoMain();

    const progress = await main.repository.lessonProgress.list<{ lesson_id: number; completed_symbol_ids: number[] }>();
    const lessonOne = progress.filter((row) => row.lesson_id === 1);
    expect(lessonOne).toHaveLength(1);
    expect(lessonOne[0].completed_symbol_ids.sort()).toEqual([1, 3]);
  });
});
