// 掌握等级重算：仅统计合并后的有效答题记录（排除冲突记录），按 symbol 聚合
import type { AnswerRecord } from "../types/AnswerRecord";
import type { MasteryLevel } from "../types/MasteryLevel";

export interface SymbolMastery {
  symbol_id: number;
  level: MasteryLevel;
  total: number;
  correct: number;
  accuracy: number;
  conflict_excluded: number;
}

// 有效答题：已同步或本机、且非冲突
export function isValidAnswer(record: AnswerRecord): boolean {
  return record.sync_status !== "conflict";
}

export function isCorrectAnswer(record: AnswerRecord): boolean {
  return record.correct === "true" || record.correct === "1";
}

export function calculateMastery(records: AnswerRecord[]): SymbolMastery[] {
  const map = new Map<number, { total: number; correct: number; conflict: number }>();
  for (const r of records) {
    const entry = map.get(r.symbol_id) ?? { total: 0, correct: 0, conflict: 0 };
    if (r.sync_status === "conflict") {
      entry.conflict += 1;
    } else {
      entry.total += 1;
      if (isCorrectAnswer(r)) entry.correct += 1;
    }
    map.set(r.symbol_id, entry);
  }

  const result: SymbolMastery[] = [];
  for (const [symbol_id, stat] of map) {
    const accuracy = stat.total > 0 ? stat.correct / stat.total : 0;
    let level: MasteryLevel = "NEW";
    if (stat.total > 0) {
      if (stat.correct >= 5 && accuracy >= 0.8) level = "MASTERED";
      else if (stat.correct >= 3 && accuracy >= 0.6) level = "FAMILIAR";
      else level = "LEARNING";
    }
    result.push({ symbol_id, level, total: stat.total, correct: stat.correct, accuracy, conflict_excluded: stat.conflict });
  }
  return result.sort((a, b) => a.symbol_id - b.symbol_id);
}

// 错题本：有效答题中答错的记录（冲突记录不计入错题本，避免重复来源干扰）
export function wrongAnswers(records: AnswerRecord[]): AnswerRecord[] {
  return records.filter((r) => isValidAnswer(r) && !isCorrectAnswer(r));
}

// 历史记录：全部可查（含冲突记录，保留两份来源）
export function historyAnswers(records: AnswerRecord[]): AnswerRecord[] {
  return [...records].sort((a, b) => Number(b.id) - Number(a.id));
}
