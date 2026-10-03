// 掌握等级服务：按合并后的有效答题记录重算掌握等级（冲突记录不计入）
import { listAnswerRecord } from "../api/AnswerRecord";
import { calculateMastery, wrongAnswers, historyAnswers, type SymbolMastery } from "../utils/mastery";
import type { AnswerRecord } from "../types/AnswerRecord";

export async function recalculateMastery(): Promise<SymbolMastery[]> {
  const records = await listAnswerRecord();
  return calculateMastery(records);
}

export async function loadWrongAnswers(): Promise<AnswerRecord[]> {
  const records = await listAnswerRecord();
  return wrongAnswers(records);
}

export async function loadHistory(): Promise<AnswerRecord[]> {
  const records = await listAnswerRecord();
  return historyAnswers(records);
}
