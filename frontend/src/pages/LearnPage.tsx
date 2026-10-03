import { useMemo, useState } from "react";
import { useSyncStore } from "../stores/SyncStore";
import { BrailleCell } from "../components/common/BrailleCell";
import { StatusBadge } from "../components/common/StatusBadge";
import { EmptyState } from "../components/common/EmptyState";

const DIFFICULTIES = ["ALL", "EASY", "MEDIUM", "HARD"];

export function LearnPage() {
  const symbols = useSyncStore((state) => state.symbols);
  const [difficulty, setDifficulty] = useState("ALL");

  const rows = useMemo(
    () => symbols.filter((symbol) => difficulty === "ALL" || symbol.difficulty === difficulty),
    [symbols, difficulty]
  );

  return (
    <main className="page">
      <section className="page-head">
        <div>
          <p className="eyebrow">learn</p>
          <h1>学习卡片</h1>
        </div>
        <div className="toolbar">
          {DIFFICULTIES.map((value) => (
            <button key={value} className={difficulty === value ? "btn active" : "btn"} onClick={() => setDifficulty(value)}>
              {value === "ALL" ? "全部" : value}
            </button>
          ))}
        </div>
      </section>

      {rows.length === 0 ? (
        <EmptyState title="暂无字符" />
      ) : (
        <section className="card-grid">
          {rows.map((symbol) => (
            <article className="panel symbol-card" key={symbol.id}>
              <BrailleCell pattern={symbol.cell_pattern} size={88} title={symbol.letter} />
              <h2>
                {symbol.letter} <span className="muted">{symbol.pinyin}</span>
              </h2>
              <div className="toolbar wrap">
                <StatusBadge value={symbol.category} />
                <StatusBadge value={symbol.difficulty} />
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
