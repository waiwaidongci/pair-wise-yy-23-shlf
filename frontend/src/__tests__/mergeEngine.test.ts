import { describe, it, expect } from "vitest";
import { mergeBatches } from "../utils/mergeEngine";
import type { RowsByEntity } from "../utils/mergeEngine";
import type { SyncBatch } from "../types/SyncBatch";
import type { SyncConflict } from "../types/SyncConflict";

const emptyRows = (): RowsByEntity => ({ practiceSession: [], answerRecord: [], lessonProgress: [] });

function answerRow(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 5,
    session_id: 2,
    symbol_id: 3,
    user_answer: "c",
    correct: true,
    latency_ms: 3000,
    mistake_reason: "",
    answered_at: "2026-10-01T09:00:00Z",
    uuid: "ans-5-uuid",
    lineage_id: "lin:answerRecord:5",
    source: "main",
    revision: 1,
    updated_at: "2026-10-01T09:00:00Z",
    deleted: false,
    ...overrides
  };
}

function batch(source: string, rows: Record<string, unknown>[], batchId = `batch-${source}`): SyncBatch {
  return {
    batch_id: batchId,
    source,
    created_at: "2026-10-02T09:00:00Z",
    ops: rows.map((payload) => ({ entity: "answerRecord" as const, uuid: String(payload.uuid), payload }))
  };
}

describe("mergeBatches 幂等", () => {
  it("重复合并同一批次不多算", () => {
    const incoming = batch("volunteer-zhang", [answerRow({ uuid: "v1", lineage_id: "lin-new-1", source: "volunteer-zhang" })], "b1");
    const once = mergeBatches({ rows: emptyRows(), conflicts: [], appliedBatchIds: new Set() }, [incoming]);
    expect(once.rows.answerRecord).toHaveLength(1);
    expect(once.appliedBatchIds).toEqual(["b1"]);

    const twice = mergeBatches(
      { rows: once.rows, conflicts: once.conflicts, appliedBatchIds: new Set(once.appliedBatchIds) },
      [incoming]
    );
    expect(twice.rows.answerRecord).toHaveLength(1);
    expect(twice.skippedBatchIds).toEqual(["b1"]);
  });

  it("批次重试后再次送达（接收方账本已有记录）完全跳过", () => {
    const incoming = batch("volunteer-zhang", [answerRow({ uuid: "v2", lineage_id: "lin-new-2", source: "volunteer-zhang" })], "b2");
    const result = mergeBatches({ rows: emptyRows(), conflicts: [], appliedBatchIds: new Set(["b2"]) }, [incoming]);
    expect(result.rows.answerRecord).toHaveLength(0);
    expect(result.skippedBatchIds).toEqual(["b2"]);
  });
});

describe("mergeBatches 双源冲突", () => {
  it("同一记录两边都改过：保留两份来源并挂起冲突", () => {
    const mainRows = emptyRows();
    mainRows.answerRecord = [answerRow({ user_answer: "主设备批改：i", correct: false, revision: 2 })];

    const volunteerRow = answerRow({
      uuid: "volunteer-uuid",
      user_answer: "志愿者批改：c",
      correct: true,
      source: "volunteer-zhang",
      revision: 1,
      updated_at: "2026-10-02T10:00:00Z"
    });

    const result = mergeBatches(
      { rows: mainRows, conflicts: [], appliedBatchIds: new Set() },
      [batch("volunteer-zhang", [volunteerRow], "b-conflict")]
    );

    expect(result.rows.answerRecord).toHaveLength(2);
    expect(new Set(result.rows.answerRecord.map((row) => row.uuid))).toEqual(new Set(["ans-5-uuid", expect.any(String)]));
    const conflict: SyncConflict | undefined = result.conflicts[0];
    expect(conflict).toBeDefined();
    expect(conflict?.status).toBe("PENDING");
    expect(conflict?.member_uuids).toHaveLength(2);
    expect(conflict?.id).toBe("lin:answerRecord:5");
  });

  it("两边改后内容一致时自动收敛为一份，不产生冲突", () => {
    const mainRows = emptyRows();
    mainRows.answerRecord = [answerRow({ user_answer: "相同内容", revision: 2, updated_at: "2026-10-02T08:00:00Z" })];
    const volunteerRow = answerRow({
      uuid: "volunteer-uuid",
      user_answer: "相同内容",
      source: "volunteer-zhang",
      revision: 1,
      updated_at: "2026-10-02T09:00:00Z"
    });
    const result = mergeBatches(
      { rows: mainRows, conflicts: [], appliedBatchIds: new Set() },
      [batch("volunteer-zhang", [volunteerRow], "b-same")]
    );
    expect(result.rows.answerRecord).toHaveLength(1);
    expect(result.conflicts).toHaveLength(0);
  });

  it("同源旧修订被丢弃（stale delivery）", () => {
    const mainRows = emptyRows();
    mainRows.answerRecord = [answerRow({ revision: 3, user_answer: "newest" })];
    const stale = answerRow({ uuid: "ans-5-uuid", revision: 2, user_answer: "older" });
    const result = mergeBatches(
      { rows: mainRows, conflicts: [], appliedBatchIds: new Set() },
      [batch("main", [stale], "b-stale")]
    );
    expect(result.rows.answerRecord[0].user_answer).toBe("newest");
  });
});

describe("mergeBatches 课程进度 CRDT", () => {
  function progressRow(overrides: Record<string, unknown>): Record<string, unknown> {
    return {
      id: 1,
      lesson_id: 1,
      completed_symbol_ids: [1],
      last_practiced_at: "2026-10-01T09:00:00Z",
      uuid: "lp-1",
      lineage_id: "lin:lessonProgress:1",
      source: "main",
      revision: 1,
      updated_at: "2026-10-01T09:00:00Z",
      deleted: false,
      ...overrides
    };
  }

  it("completed_symbol_ids 取并集，不产生冲突", () => {
    const rows = emptyRows();
    rows.lessonProgress = [progressRow({})];
    const incoming = {
      batch_id: "bp1",
      source: "volunteer-zhang",
      created_at: "2026-10-02T09:00:00Z",
      ops: [
        {
          entity: "lessonProgress" as const,
          uuid: "lp-1",
          payload: progressRow({
            uuid: "lp-1-vol",
            source: "volunteer-zhang",
            revision: 1,
            completed_symbol_ids: [2, 3],
            last_practiced_at: "2026-10-02T09:00:00Z"
          })
        }
      ]
    };
    const result = mergeBatches({ rows, conflicts: [], appliedBatchIds: new Set() }, [incoming]);
    expect(result.rows.lessonProgress).toHaveLength(1);
    expect(result.rows.lessonProgress[0].completed_symbol_ids).toEqual([1, 2, 3]);
    expect(result.rows.lessonProgress[0].last_practiced_at).toBe("2026-10-02T09:00:00Z");
    expect(result.conflicts).toHaveLength(0);
  });
});

describe("mergeBatches 异常批次", () => {
  it("缺少 batch_id 或 ops 的批次不改变状态", () => {
    const result = mergeBatches(
      { rows: emptyRows(), conflicts: [], appliedBatchIds: new Set() },
      [{ batch_id: "", source: "x", created_at: "", ops: [] }]
    );
    expect(result.appliedBatchIds).toEqual([]);
  });
});
