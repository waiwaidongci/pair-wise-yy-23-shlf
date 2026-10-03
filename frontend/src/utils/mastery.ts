import { MASTERY_RULES } from "../constants/masteryRules";
import { MasteryLevel } from "../types/MasteryLevel";
import type { BrailleSymbol } from "../types/BrailleSymbol";
import type { SyncMeta } from "../types/SyncMeta";

export interface MasterySnapshot {
  symbol_id: number;
  level: MasteryLevel;
  total: number;
  correct: number;
  accuracy: number;
  last_answered_at: string;
  // uuids excluded from the calc; non-empty means conflict未处理前不能计入掌握等级
  excluded_uuids: string[];
  updated_at: string;
}

export interface AnswerLike {
  symbol_id: number;
  correct: boolean;
  answered_at?: string;
  uuid?: string;
  lineage_id?: string;
  deleted?: boolean;
}

// `pendingLineageIds` identifies records whose two-source conflict is not
// resolved: both copies stay queryable (错题本/历史) but never count here.
export function validAnswers<T extends AnswerLike>(rows: T[], pendingLineageIds: ReadonlySet<string> = new Set()): T[] {
  return rows.filter((row) => {
    if (row.deleted) return false;
    if (typeof row.lineage_id === "string" && pendingLineageIds.has(row.lineage_id)) return false;
    return typeof row.correct === "boolean";
  });
}

export function levelForSymbol(
  answers: AnswerLike[],
  now: number = Date.now()
): { level: MasteryLevel; total: number; correct: number; accuracy: number; last_answered_at: string } {
  const total = answers.length;
  const correct = answers.filter((row) => row.correct).length;
  const accuracy = total === 0 ? 0 : correct / total;
  const sorted = answers.map((row) => row.answered_at ?? "").sort();
  const last = sorted.length > 0 ? sorted[sorted.length - 1] : "";

  const recentWrong = answers.some((row) => {
    if (row.correct || !row.answered_at) return false;
    return now - new Date(row.answered_at).getTime() <= MASTERY_RULES.RECENT_WRONG_WINDOW_MS;
  });

  let level: MasteryLevel = "NEW";
  if (total >= MASTERY_RULES.MIN_ANSWERS_LEAVING_NEW) level = "LEARNING";
  if (total >= MASTERY_RULES.MIN_ANSWERS_FAMILIAR && accuracy >= MASTERY_RULES.FAMILIAR_ACCURACY) {
    level = "FAMILIAR";
  }
  if (total >= MASTERY_RULES.MIN_ANSWERS_MASTERED && accuracy >= MASTERY_RULES.MASTERED_ACCURACY) {
    level = "MASTERED";
  }
  if (recentWrong && level !== "NEW") level = "LEARNING";
  return { level, total, correct, accuracy, last_answered_at: last };
}

function toAnswerLike(row: unknown): AnswerLike | null {
  if (!row || typeof row !== "object") return null;
  const candidate = row as Record<string, unknown>;
  if (typeof candidate.symbol_id !== "number" || typeof candidate.correct !== "boolean") return null;
  return candidate as unknown as AnswerLike & Partial<SyncMeta>;
}

// Pure recompute used by the v2 migration, every successful merge, conflict
// resolution and local answer writes.
export function computeMastery(
  answerRows: unknown[],
  symbols: Pick<BrailleSymbol, "id">[],
  pendingLineageIds: ReadonlySet<string> = new Set(),
  now: string = new Date().toISOString()
): MasterySnapshot[] {
  const parsed = answerRows
    .map(toAnswerLike)
    .filter((row): row is AnswerLike & Partial<SyncMeta> => row !== null);
  const usable = validAnswers(parsed, pendingLineageIds);
  const bySymbol = new Map<number, AnswerLike[]>();
  const excludedBySymbol = new Map<number, string[]>();

  for (const row of parsed) {
    if (row.deleted) continue;
    const lineage = typeof row.lineage_id === "string" ? row.lineage_id : "";
    const rowUuid = typeof row.uuid === "string" ? row.uuid : "";
    if (lineage && pendingLineageIds.has(lineage)) {
      const list = excludedBySymbol.get(row.symbol_id) ?? [];
      if (rowUuid) list.push(rowUuid);
      excludedBySymbol.set(row.symbol_id, list);
      continue;
    }
  }
  for (const row of usable) {
    const list = bySymbol.get(row.symbol_id) ?? [];
    list.push(row);
    bySymbol.set(row.symbol_id, list);
  }

  return symbols.map((symbol) => {
    const answers = bySymbol.get(symbol.id) ?? [];
    const stats = levelForSymbol(answers);
    return {
      symbol_id: symbol.id,
      ...stats,
      excluded_uuids: excludedBySymbol.get(symbol.id) ?? [],
      updated_at: now
    };
  });
}
