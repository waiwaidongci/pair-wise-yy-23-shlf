// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { openDatabase, LocalDatabase } from "../db/database";
import { STORE, LEGACY_STORE, DB_VERSION } from "../db/stores";

function openV1WithLegacyData(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("braille-trainer-db", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      const symbols = db.createObjectStore(STORE.brailleSymbol, { keyPath: "id" });
      const lessons = db.createObjectStore(STORE.lesson, { keyPath: "id" });
      const sessions = db.createObjectStore(LEGACY_STORE.practiceSession, { keyPath: "id" });
      const answers = db.createObjectStore(LEGACY_STORE.answerRecord, { keyPath: "id" });
      symbols.add({ id: 1, cell_pattern: "1", letter: "a", pinyin: "a", category: "LETTER", difficulty: "EASY", audio_hint_key: "" });
      lessons.add({ id: 1, title: "L1", symbol_ids: [1], stage: "STAGE_1", estimated_minutes: 5, unlock_rule: "NONE" });
      sessions.add({ id: 1, lesson_id: 1, mode: "MIXED", started_at: "t1", finished_at: "t2", score: 100, mistake_count: 0 });
      answers.add({ id: 1, session_id: 1, symbol_id: 1, user_answer: "a", correct: true, latency_ms: 1000, mistake_reason: "", answered_at: "2026-09-01T09:00:00Z" });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

describe("IndexedDB v1 -> v2 升级", () => {
  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("braille-trainer-db");
      req.onsuccess = () => resolve();
      req.onblocked = () => resolve();
      req.onerror = () => resolve();
    });
  });

  it("旧库升级：迁移会话/答题、回填元数据、旧 store 删除、掌握度重算", async () => {
    await openV1WithLegacyData();
    const idb = await openDatabase("braille-trainer-db", DB_VERSION);
    const db = new LocalDatabase(idb);

    expect(idb.objectStoreNames.contains(LEGACY_STORE.practiceSession)).toBe(false);
    expect(idb.objectStoreNames.contains(LEGACY_STORE.answerRecord)).toBe(false);
    expect(idb.objectStoreNames.contains(STORE.practiceSession)).toBe(true);
    expect(idb.objectStoreNames.contains(STORE.answerRecord)).toBe(true);
    expect(idb.objectStoreNames.contains(STORE.lessonProgress)).toBe(true);
    expect(idb.objectStoreNames.contains(STORE.syncQueue)).toBe(true);
    expect(idb.objectStoreNames.contains(STORE.appliedBatch)).toBe(true);
    expect(idb.objectStoreNames.contains(STORE.syncConflict)).toBe(true);

    const session = (await db.getAll(STORE.practiceSession))[0] as Record<string, unknown>;
    expect(session.source).toBe("main");
    expect(session.revision).toBe(1);
    expect(session.lineage_id).toBe("lin:practiceSession:1");

    const answer = (await db.getAll(STORE.answerRecord))[0] as Record<string, unknown>;
    expect(answer.uuid).toBe("lin:answerRecord:1");
    expect(answer.correct).toBe(true);

    const snapshots = await db.getAll(STORE.masterySnapshot);
    const symbolOne = snapshots.find((row) => (row as { symbol_id: number }).symbol_id === 1) as { total: number; level: string };
    expect(symbolOne.total).toBe(1);
    expect(symbolOne.level).toBe("LEARNING");

    idb.close();
  });
});
