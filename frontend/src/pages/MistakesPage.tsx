import { useEffect, useMemo } from "react";
import { useAnswerRecordStore } from "../stores/AnswerRecordStore";
import { useBrailleSymbolStore } from "../stores/BrailleSymbolStore";
import { wrongAnswers } from "../utils/mastery";
import { BrailleCell } from "../components/common/BrailleCell";
import { SyncStatusBadge } from "../components/common/SyncStatusBadge";
import { EmptyState } from "../components/common/EmptyState";
import { StatusBadge } from "../components/common/StatusBadge";

export function MistakesPage() {
  const { rows: answers, load: loadAnswers } = useAnswerRecordStore();
  const { rows: symbols, load: loadSymbols } = useBrailleSymbolStore();

  useEffect(() => {
    loadAnswers();
    loadSymbols();
  }, [loadAnswers, loadSymbols]);

  const wrong = useMemo(() => wrongAnswers(answers), [answers]);
  const symbolMap = useMemo(() => new Map(symbols.map((s) => [s.id, s])), [symbols]);

  return (
    <main className="page">
      <section className="page-head">
        <div>
          <p className="eyebrow">braille-trainer</p>
          <h1>错题本</h1>
        </div>
        <StatusBadge value="WRONG_ANSWERS" />
      </section>

      <section className="panel">
        <h2>错题记录（仅统计有效答题，冲突记录不计入）</h2>
        {wrong.length === 0 ? (
          <EmptyState title="暂无错题，继续加油" />
        ) : (
          <div className="table">
            {wrong.map((r) => {
              const sym = symbolMap.get(r.symbol_id);
              return (
                <article key={r.recordKey} className="row mistake-row">
                  <BrailleCell title={sym?.letter ?? `#${r.symbol_id}`} value={sym?.cell_pattern ?? "?"} />
                  <div className="mistake-info">
                    <span>你的答案：{r.user_answer}</span>
                    <span>错误原因：{r.mistake_reason || "—"}</span>
                    <span>练习会话：#{r.session_id} · 耗时 {r.latency_ms}ms</span>
                  </div>
                  <SyncStatusBadge status={r.sync_status} />
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
