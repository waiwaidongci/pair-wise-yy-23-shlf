import { useEffect, useMemo, useState } from "react";
import { useBrailleSymbolStore } from "../stores/BrailleSymbolStore";
import { useLessonStore } from "../stores/LessonStore";
import { BrailleCell } from "../components/common/BrailleCell";
import { LessonProgress } from "../components/common/LessonProgress";
import { StatusBadge } from "../components/common/StatusBadge";
import { EmptyState } from "../components/common/EmptyState";
import { SymbolCategoryText } from "../constants/SymbolCategory";
import type { SymbolCategory } from "../types/SymbolCategory";

export function LearnPage() {
  const { rows: symbols, load: loadSymbols } = useBrailleSymbolStore();
  const { rows: lessons, load: loadLessons } = useLessonStore();
  const [category, setCategory] = useState<string>("ALL");

  useEffect(() => {
    loadSymbols();
    loadLessons();
  }, [loadSymbols, loadLessons]);

  const filtered = useMemo(
    () => (category === "ALL" ? symbols : symbols.filter((s) => s.category === category)),
    [symbols, category]
  );

  return (
    <main className="page">
      <section className="page-head">
        <div>
          <p className="eyebrow">braille-trainer</p>
          <h1>学习卡片</h1>
        </div>
        <StatusBadge value="LEARN" />
      </section>

      <section className="panel">
        <h2>点字字符</h2>
        <div className="filter-row">
          {["ALL", "LETTER", "NUMBER", "PUNCTUATION", "CONTRACTION"].map((c) => (
            <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>
              {c === "ALL" ? "全部" : SymbolCategoryText[c as SymbolCategory]}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="暂无字符" />
        ) : (
          <div className="symbol-grid">
            {filtered.map((s) => (
              <article key={s.id} className="symbol-card">
                <BrailleCell title={s.letter} value={s.cell_pattern} />
                <div className="symbol-meta">
                  <span>{s.pinyin}</span>
                  <span className="badge">{SymbolCategoryText[s.category as SymbolCategory] ?? s.category}</span>
                  <span>难度 {s.difficulty}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>课程</h2>
        <div className="lesson-list">
          {lessons.map((l) => (
            <article key={l.id} className="row lesson-row">
              <strong>{l.title}</strong>
              <span>{l.stage} · {l.symbol_ids.length} 字符 · 约 {l.estimated_minutes} 分钟</span>
              <LessonProgress title="进度" value={l.unlock_rule} />
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
