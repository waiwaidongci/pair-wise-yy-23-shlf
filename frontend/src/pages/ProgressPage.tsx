import { useMemo } from "react";
import { useSyncStore } from "../stores/SyncStore";
import { useMastery } from "../hooks/useMastery";
import { ChartPanel } from "../components/common/ChartPanel";
import type { ChartPoint } from "../components/common/ChartPanel";
import { StatCard } from "../components/common/StatCard";
import { LessonProgress } from "../components/common/LessonProgress";
import { StatusBadge } from "../components/common/StatusBadge";
import { EmptyState } from "../components/common/EmptyState";
import { formatDate, formatPercent, formatSource } from "../utils/formatters";
import { MasteryLevel } from "../constants/MasteryLevel";

export function ProgressPage() {
  const { sessions, answers, lessons, progress, symbols, conflicts } = useSyncStore();
  const { bySymbol } = useMastery();

  const pendingCount = conflicts.filter((conflict) => conflict.status === "PENDING").length;
  const valid = answers.filter((answer) => !answer.deleted && !conflicts.some((c) => c.status === "PENDING" && c.id === answer.lineage_id));
  const accuracy = valid.length === 0 ? 0 : valid.filter((answer) => answer.correct).length / valid.length;

  const distribution = useMemo<ChartPoint[]>(
    () =>
      MasteryLevel.map((level) => ({
        label: level,
        value: Array.from(bySymbol.values()).filter((snapshot) => snapshot.level === level).length,
        hint: `${Array.from(bySymbol.values()).filter((snapshot) => snapshot.level === level).length} 个`
      })),
    [bySymbol]
  );

  const trend = useMemo<ChartPoint[]>(() => {
    const byDay = new Map<string, { total: number; correct: number }>();
    for (const answer of valid) {
      const day = String(answer.answered_at ?? "").slice(0, 10);
      if (!day) continue;
      const bucket = byDay.get(day) ?? { total: 0, correct: 0 };
      bucket.total += 1;
      if (answer.correct) bucket.correct += 1;
      byDay.set(day, bucket);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([day, bucket]) => ({ label: day.slice(5), value: bucket.total, hint: formatPercent(bucket.correct / bucket.total) }));
  }, [valid]);

  return (
    <main className="page">
      <section className="page-head">
        <div>
          <p className="eyebrow">progress</p>
          <h1>学习进度</h1>
        </div>
        {pendingCount > 0 ? <StatusBadge value="CONFLICT_PENDING" /> : <StatusBadge value="SYNCED" />}
      </section>

      <section className="metrics">
        <StatCard label="有效答题" value={valid.length} />
        <StatCard label="正确率" value={formatPercent(accuracy)} />
        <StatCard label="练习会话" value={sessions.filter((session) => !session.deleted).length} />
      </section>

      {pendingCount > 0 ? (
        <p className="notice">有 {pendingCount} 条来源冲突未处理；冲突副本仍保留在错题本/历史中，但不计入下方掌握等级。</p>
      ) : null}

      <section className="workbench">
        <ChartPanel title="掌握等级分布（按合并后有效答题重算）" points={distribution} />
        <ChartPanel title="每日答题趋势" points={trend} />
      </section>

      <section className="panel">
        <h2>课程进度（多源并集合并）</h2>
        {lessons.length === 0 ? (
          <EmptyState title="暂无课程" />
        ) : (
          lessons.map((lesson) => {
            const row = progress.find((item) => item.lesson_id === lesson.id && !item.deleted);
            const completed = row?.completed_symbol_ids ?? [];
            return (
              <div className="row" key={lesson.id}>
                <strong>{lesson.title}</strong>
                <LessonProgress completed={completed.length} total={lesson.symbol_ids.length} />
                <span className="muted">{row ? `最近练习 ${formatDate(row.last_practiced_at)} · ${formatSource(row.source)}` : "未开始"}</span>
              </div>
            );
          })
        )}
      </section>

      <section className="panel">
        <h2>符号掌握明细</h2>
        <div className="table">
          {symbols.map((symbol) => {
            const snapshot = bySymbol.get(symbol.id);
            return (
              <article className="row" key={symbol.id}>
                <strong>
                  {symbol.letter} <span className="muted">{symbol.pinyin}</span>
                </strong>
                <StatusBadge value={snapshot?.level ?? "NEW"} />
                <span className="muted">
                  {snapshot?.total ?? 0} 题 · {formatPercent(snapshot?.accuracy ?? 0)}
                </span>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
