import { describe, it, expect } from "vitest";
import { resolveConflict, pendingConflictLineageIds } from "../utils/conflictResolution";
import type { RowsByEntity } from "../utils/mergeEngine";
import type { SyncConflict } from "../types/SyncConflict";
import { computeMastery } from "../utils/mastery";

function twoSourceRows(): RowsByEntity {
  return {
    practiceSession: [],
    lessonProgress: [],
    answerRecord: [
      {
        id: 5,
        session_id: 2,
        symbol_id: 3,
        user_answer: "主设备批改：i",
        correct: false,
        latency_ms: 4000,
        mistake_reason: "TEACHER_REVIEW",
        answered_at: "2026-10-01T09:00:00Z",
        uuid: "main-copy",
        lineage_id: "lin:answerRecord:5",
        source: "main",
        revision: 2,
        updated_at: "2026-10-02T08:00:00Z",
        deleted: false
      },
      {
        id: 5,
        session_id: 2,
        symbol_id: 3,
        user_answer: "志愿者批改：c",
        correct: true,
        latency_ms: 4000,
        mistake_reason: "",
        answered_at: "2026-10-01T09:00:00Z",
        uuid: "volunteer-copy",
        lineage_id: "lin:answerRecord:5",
        source: "volunteer-zhang",
        revision: 1,
        updated_at: "2026-10-02T09:00:00Z",
        deleted: false
      }
    ]
  };
}

const conflict: SyncConflict = {
  id: "lin:answerRecord:5",
  entity: "answerRecord",
  member_uuids: ["main-copy", "volunteer-copy"],
  status: "PENDING",
  winner_uuid: "",
  resolved_at: "",
  created_at: "2026-10-02T09:00:00Z",
  updated_at: "2026-10-02T09:00:00Z"
};

describe("冲突未解决前不计入掌握等级", () => {
  it("pending 谱系的两份副本都被排除", () => {
    const rows = twoSourceRows();
    const pending = pendingConflictLineageIds([conflict]);
    const snapshots = computeMastery(rows.answerRecord, [{ id: 3 }], pending, "2026-10-03T00:00:00Z");
    expect(snapshots[0].total).toBe(0);
    expect(snapshots[0].level).toBe("NEW");
    expect(snapshots[0].excluded_uuids.sort()).toEqual(["main-copy", "volunteer-copy"]);
  });

  it("解决后只计入获胜来源，失败副本软删除但历史仍可查", () => {
    const rows = twoSourceRows();
    const resolved = resolveConflict(rows, [conflict], "answerRecord", "lin:answerRecord:5", "volunteer-copy", "2026-10-03T10:00:00Z");

    const mainCopy = resolved.rows.answerRecord.find((row) => row.uuid === "main-copy");
    expect(mainCopy?.deleted).toBe(true);
    const volunteerCopy = resolved.rows.answerRecord.find((row) => row.uuid === "volunteer-copy");
    expect(volunteerCopy?.deleted).toBe(false);
    expect(resolved.conflicts[0].status).toBe("RESOLVED");
    expect(resolved.conflicts[0].winner_uuid).toBe("volunteer-copy");

    const snapshots = computeMastery(resolved.rows.answerRecord, [{ id: 3 }], pendingConflictLineageIds(resolved.conflicts), "2026-10-03T10:00:00Z");
    expect(snapshots[0].total).toBe(1);
    expect(snapshots[0].correct).toBe(1);
    // soft-deleted row is still physically present for 错题本/历史查询
    expect(resolved.rows.answerRecord).toHaveLength(2);
  });
});

describe("掌握等级阈值", () => {
  const answer = (symbol_id: number, correct: boolean, day: string) => ({
    id: 1,
    session_id: 1,
    symbol_id,
    user_answer: "x",
    correct,
    latency_ms: 1000,
    mistake_reason: "",
    answered_at: day,
    uuid: `u-${symbol_id}-${Math.random()}`,
    lineage_id: `l-${symbol_id}-${Math.random()}`,
    source: "main",
    revision: 1,
    updated_at: day,
    deleted: false
  });

  it("按正确数与正确率分级，近期答错回落到 LEARNING", () => {
    const rows = [
      answer(1, true, "2026-09-20T09:00:00Z"),
      answer(1, true, "2026-09-20T09:01:00Z"),
      answer(1, true, "2026-09-20T09:02:00Z"),
      answer(1, true, "2026-09-20T09:03:00Z"),
      answer(1, true, "2026-09-20T09:04:00Z"),
      answer(1, false, "2026-09-20T09:05:00Z")
    ];
    // 5/6 = 83% -> FAMILIAR (the wrong answer is >7 days before 2026-10-03)
    const fam = computeMastery(rows, [{ id: 1 }], new Set(), "2026-10-03T00:00:00Z");
    expect(fam[0].level).toBe("FAMILIAR");

    // 6/6 -> MASTERED
    const mastered = computeMastery(rows.slice(0, 5).concat(answer(1, true, "2026-09-20T09:06:00Z")), [{ id: 1 }], new Set(), "2026-10-03T00:00:00Z");
    expect(mastered[0].level).toBe("MASTERED");

    // A wrong answer inside the 7-day window pulls MASTERED back to LEARNING.
    const regressed = computeMastery(
      rows.slice(0, 5).concat([answer(1, true, "2026-09-20T09:06:00Z"), answer(1, false, "2026-10-01T09:00:00Z")]),
      [{ id: 1 }],
      new Set(),
      "2026-10-03T00:00:00Z"
    );
    expect(regressed[0].level).toBe("LEARNING");
  });
});
