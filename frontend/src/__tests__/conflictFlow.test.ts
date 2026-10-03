// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { closeAllContexts, openContext } from "../services/appContext";
import { setDeviceSource } from "../utils/syncMeta";
import { setForcedOffline } from "../utils/connectivity";
import { clearHubBatches } from "../db/hubDatabase";
import { stageVolunteerScenario, stageMainEdit } from "../services/demoScenario";
import { pendingConflictLineageIds } from "../utils/conflictResolution";

const VOLUNTEER = "volunteer-conflict";

async function del(name: string) {
  return new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onblocked = () => resolve();
    req.onerror = () => resolve();
  });
}

describe("双源冲突解决端到端", () => {
  beforeEach(async () => {
    await closeAllContexts();
    setDeviceSource("main");
    setForcedOffline(false);
    await clearHubBatches();
    await Promise.all([del("braille-trainer-db"), del(`braille-trainer-db:${VOLUNTEER}`)]);
  });

  it("同一答题两边改过：保留两份、不计掌握度；解决后按获胜来源重算，败方软删除可查", async () => {
    // Main edits answer id=5 first, then the volunteer independently edits it.
    const lineage = await stageMainEdit();
    expect(lineage).toBe("lin:answerRecord:5");
    await stageVolunteerScenario(VOLUNTEER, { diverge: true });

    const volunteer = await openContext(VOLUNTEER);
    await volunteer.syncService.pushOutbox();

    const main = await openContext("main");
    const report = await main.syncService.mergeHubIntoMain();
    expect(report.merged).toHaveLength(1);

    const conflicts = await main.repository.conflicts.list<import("../types/SyncConflict").SyncConflict>();
    const conflict = conflicts.find((entry) => entry.id === "lin:answerRecord:5");
    expect(conflict?.status).toBe("PENDING");
    expect(conflict?.member_uuids).toHaveLength(2);

    const answers = await main.repository.answerRecords.list<{
      lineage_id: string;
      source: string;
      uuid: string;
      deleted?: boolean;
      correct?: boolean;
    }>();
    const copies = answers.filter((row) => row.lineage_id === "lin:answerRecord:5");
    expect(copies).toHaveLength(2);
    expect(new Set(copies.map((row) => row.source))).toEqual(new Set(["main", VOLUNTEER]));

    // Pending conflict => both copies excluded from mastery.
    const before = await main.mergeService.recomputeMastery();
    const symbol3 = before.find((snapshot) => snapshot.symbol_id === 3)!;
    // seed answer id=2 (symbol 3) still counts; the two id=5 copies do not
    expect(symbol3.total).toBe(1);
    expect(symbol3.excluded_uuids).toHaveLength(2);

    // Resolve in favor of the volunteer copy.
    const volunteerCopy = copies.find((row) => row.source === VOLUNTEER)!;
    await main.mergeService.resolve("answerRecord", "lin:answerRecord:5", volunteerCopy.uuid);

    const afterRows = await main.repository.answerRecords.list<{ lineage_id: string; source: string; uuid: string; deleted?: boolean }>();
    const afterCopies = afterRows.filter((row) => row.lineage_id === "lin:answerRecord:5");
    expect(afterCopies).toHaveLength(2); // both retained for 历史查询
    expect(afterCopies.find((row) => row.uuid === volunteerCopy.uuid)?.deleted).toBe(false);
    expect(afterCopies.find((row) => row.source === "main")?.deleted).toBe(true);

    const afterConflicts = await main.repository.conflicts.list<import("../types/SyncConflict").SyncConflict>();
    expect(pendingConflictLineageIds(afterConflicts).size).toBe(0);

    // Mastery now counts the winning (correct) copy.
    const after = await main.mergeService.recomputeMastery();
    const symbol3After = after.find((snapshot) => snapshot.symbol_id === 3)!;
    expect(symbol3After.total).toBe(2);
    expect(symbol3After.correct).toBe(2);
  });
});
