import { useEffect, useMemo } from "react";
import { useAnswerRecordStore } from "../stores/AnswerRecordStore";
import { useBrailleSymbolStore } from "../stores/BrailleSymbolStore";
import { calculateMastery } from "../utils/mastery";
import { MasteryBadge } from "../components/common/MasteryBadge";
import { StatCard } from "../components/common/StatCard";
import { StatusBadge } from "../components/common/StatusBadge";
import { EmptyState } from "../components/common/EmptyState";

export function ProgressPage() {
  const { rows: answers, load: loadAnswers } = useAnswerRecordStore();
  const { rows: symbols, load: loadSymbols } = useBrailleSymbolStore();

  useEffect(() => {
    loadAnswers();
    loadSymbols();
  }, [loadAnswers, loadSymbols]);

  const mastery = useMemo(() => calculateMastery(answers), [answers]);
  const symbolMap = useMemo(() => new Map(symbols.map((s) => [s.id, s])), [symbols]);

  const totals = useMemo(() => {
    const valid = answers.filter((r) => r.sync_status !== "conflict");
    const correct = valid.filter((r) => r.correct === "true" || r.correct === "1").length;
    const conflicts = answers.filter((r) => r.sync_status === "conflict").length;
    return {
      total: valid.length,
      correct,
      accuracy: valid.length ? Math.round((correct / valid.length) * 100) : 0,
      conflicts
    };
  }, [answers]);

  return (
    <main className="page">
      <section className="page-head">
        <div>
          <p className="eyebrow">braille-trainer</p>
          <h1>学习进度</h1>
        </div>
        <StatusBadge value="PROGRESS" />
      </section>

      <section className="metrics">
        <StatCard label="有效答题" value={totals.total} />
        <StatCard label="正确数" value={totals.correct} />
        <StatCard label="正确率" value={`${totals.accuracy}%`} />
        <StatCard label="冲突不计入" value={totals.conflicts} />
      </section>

      <section className="panel">
        <h2>掌握等级（按合并后的有效答题重算，冲突记录不计入）</h2>
        {mastery.length === 0 ? (
          <EmptyState title="暂无答题记录" />
        ) : (
          <div className="table">
            {mastery.map((m) => {
              const sym = symbolMap.get(m.symbol_id);
              return (
                <article key={m.symbol_id} className="row mastery-row">
                  <strong>{sym?.letter ?? `#${m.symbol_id}`}</strong>
                  <span>
                    {m.correct}/{m.total} 正确
                    {m.conflict_excluded > 0 ? ` · ${m.conflict_excluded} 条冲突不计入` : ""}
                  </span>
                  <MasteryBadge level={m.level} />
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
