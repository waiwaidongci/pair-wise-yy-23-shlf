import { describe, it, expect } from "vitest";
import { backfillLegacyRow, migrateLegacyTable, legacyLineageId } from "../db/migration";

describe("升级时回填来源与修订号", () => {
  it("旧数据缺少 uuid/source/revision 时回填", () => {
    const row = backfillLegacyRow("answerRecord", {
      id: 5,
      session_id: 2,
      symbol_id: 3,
      user_answer: "x",
      correct: false,
      latency_ms: 100,
      mistake_reason: "DOT_CONFUSED",
      answered_at: "2026-09-27T09:07:00Z"
    });
    expect(row.source).toBe("main");
    expect(row.revision).toBe(1);
    expect(row.uuid).toBe(legacyLineageId("answerRecord", 5));
    expect(row.lineage_id).toBe("lin:answerRecord:5");
    expect(row.deleted).toBe(false);
  });

  it("两台设备的同一条旧数据回填出相同 lineage，才能在合并时识别为同一记录", () => {
    const a = backfillLegacyRow("answerRecord", { id: 9, correct: true });
    const b = backfillLegacyRow("answerRecord", { id: 9, correct: false }, "volunteer-zhang");
    expect(a.lineage_id).toBe(b.lineage_id);
    expect(a.source).toBe("main");
    expect(b.source).toBe("volunteer-zhang");
  });

  it("迁移整表保留全部业务字段", () => {
    const rows = migrateLegacyTable("practiceSession", [
      { id: 1, lesson_id: 1, mode: "MIXED", started_at: "t1", finished_at: "t2", score: 67, mistake_count: 1 }
    ]);
    expect(rows[0]).toMatchObject({ id: 1, lesson_id: 1, mode: "MIXED", score: 67 });
    expect(rows[0].revision).toBe(1);
  });

  it("已有同步元数据的行不重复回填", () => {
    const once = backfillLegacyRow("answerRecord", { id: 1, uuid: "u1", lineage_id: "l1", source: "volunteer-zhang", revision: 4 });
    const twice = backfillLegacyRow("answerRecord", once);
    expect(twice.uuid).toBe("u1");
    expect(twice.revision).toBe(4);
  });
});
