// 数据初始化：首次运行把 mock 种子写入 IndexedDB，之后以持久化存储为准
import { getAll, putAll, STORES } from "../utils/storage";
import { mockData } from "../mocks/seedData";
import { recordKey } from "../utils/merge";
import type { AnswerRecord } from "../types/AnswerRecord";
import type { PracticeSession } from "../types/PracticeSession";
import type { BrailleSymbol } from "../types/BrailleSymbol";
import type { Lesson } from "../types/Lesson";

const SEEDED_KEY = "seeded-v2";

export async function ensureSeeded(): Promise<void> {
  const existing = await getAll<{ key: string; value: string }>(STORES.META);
  if (existing.some((m) => m.key === SEEDED_KEY)) return;

  // 种子数据补齐 recordKey（旧数据缺 source/revision，recordKey 待回填时再补）
  const answers = (mockData.answerRecord as AnswerRecord[]).map((r) => ({
    ...r,
    recordKey: r.recordKey || recordKey(r.id, r.source || "legacy")
  }));
  const sessions = (mockData.practiceSession as PracticeSession[]).map((r) => ({
    ...r,
    recordKey: r.recordKey || recordKey(r.id, r.source || "legacy")
  }));

  await putAll(STORES.ANSWER_RECORDS, answers as unknown as Record<string, unknown>[], "recordKey");
  await putAll(STORES.PRACTICE_SESSIONS, sessions as unknown as Record<string, unknown>[], "recordKey");
  await putAll(STORES.LESSONS, mockData.lesson as unknown as Record<string, unknown>[], "id");
  await putAll(STORES.META, [{ key: SEEDED_KEY, value: "true" }], "key");
}

export async function listBrailleSymbol(): Promise<BrailleSymbol[]> {
  await ensureSeeded();
  return [...(mockData.brailleSymbol as BrailleSymbol[])];
}

export async function listLesson(): Promise<Lesson[]> {
  await ensureSeeded();
  return getAll<Lesson>(STORES.LESSONS);
}
