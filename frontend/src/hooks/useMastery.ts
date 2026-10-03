import { useMemo } from "react";
import { useSyncStore } from "../stores/SyncStore";
import { selectPendingLineageIds } from "../stores/SyncStore";
import { validAnswers, levelForSymbol } from "../utils/mastery";
import type { MasterySnapshot } from "../utils/mastery";

// Derives mastery straight from visible answers for immediate UI feedback;
// persisted snapshots (computed by the same rules) are the offline source.
// Pending-conflict lineages never count: 冲突没有处理前不能计入掌握等级.
export function useMastery(): { bySymbol: Map<number, MasterySnapshot>; snapshots: MasterySnapshot[] } {
  const answers = useSyncStore((state) => state.answers);
  const symbols = useSyncStore((state) => state.symbols);
  const pending = useSyncStore(selectPendingLineageIds);

  return useMemo(() => {
    const usable = validAnswers(answers, pending);
    const bySymbolId = new Map<number, typeof usable>();
    for (const answer of usable) {
      const list = bySymbolId.get(answer.symbol_id) ?? [];
      list.push(answer);
      bySymbolId.set(answer.symbol_id, list);
    }
    const snapshots: MasterySnapshot[] = symbols.map((symbol) => {
      const rows = bySymbolId.get(symbol.id) ?? [];
      return {
        symbol_id: symbol.id,
        ...levelForSymbol(rows),
        excluded_uuids: [],
        updated_at: new Date().toISOString()
      };
    });
    return { bySymbol: new Map(snapshots.map((snapshot) => [snapshot.symbol_id, snapshot])), snapshots };
  }, [answers, symbols, pending]);
}
