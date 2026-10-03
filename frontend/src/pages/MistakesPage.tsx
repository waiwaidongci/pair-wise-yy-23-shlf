import { useMemo, useState } from "react";
import { useSyncStore } from "../stores/SyncStore";
import { useMistakes } from "../hooks/useMistakes";
import { BrailleCell } from "../components/common/BrailleCell";
import { ResultBadge } from "../components/common/ResultBadge";
import { StatusBadge } from "../components/common/StatusBadge";
import { EmptyState } from "../components/common/EmptyState";
import { formatDate, formatSource } from "../utils/formatters";
import type { SyncedAnswerRecord } from "../types/AnswerRecord";

function MistakeRow({ answer, pending }: { answer: SyncedAnswerRecord; pending: boolean }) {
  const symbol = useSyncStore((state) => state.symbols.find((item) => item.id === answer.symbol_id));
  return (
    <article className="row mistake-row">
      <BrailleCell pattern={symbol?.cell_pattern ?? ""} size={44} />
      <div>
        <strong>{symbol?.letter ?? `符号 ${answer.symbol_id}`}</strong>
        <span className="muted"> {symbol?.pinyin ?? ""}</span>
        <p className="muted">
          你的回答：{answer.user_answer}
          {answer.mistake_reason ? ` · 原因：${answer.mistake_reason}` : ""} · {formatDate(answer.answered_at)}
        </p>
      </div>
      <ResultBadge correct={Boolean(answer.correct)} label={answer.correct ? "冲突副本" : "答错"} />
      <div className="source-tags">
        <StatusBadge value="SYNC_SOURCE" />
        <span>{formatSource(answer.source)}</span>
        <span className="muted">修订 {answer.revision ?? "旧"}</span>
        {pending ? <StatusBadge value="CONFLICT_PENDING" /> : null}
      </div>
    </article>
  );
}

export function MistakesPage() {
  const { rows, reason, setReason, reasons, pendingLineages } = useMistakes();
  const answers = useSyncStore((state) => state.answers);
  const [showArchived, setShowArchived] = useState(false);

  // 错题本和历史仍要能查: archived = soft-deleted losing copies after resolve.
  const archived = useMemo(
    () => answers.filter((answer) => answer.deleted).sort((a, b) => (a.answered_at < b.answered_at ? 1 : -1)),
    [answers]
  );

  return (
    <main className="page">
      <section className="page-head">
        <div>
          <p className="eyebrow">mistakes</p>
          <h1>错题本</h1>
        </div>
        <div className="toolbar">
          <select value={reason} onChange={(event) => setReason(event.target.value)}>
            <option value="ALL">全部原因</option>
            <option value="PENDING_CONFLICT">仅未解决冲突</option>
            {reasons.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => setShowArchived((value) => !value)}>
            {showArchived ? "隐藏" : "查看"}已解决历史（{archived.length}）
          </button>
        </div>
      </section>

      <section className="panel wide">
        <h2>待巩固</h2>
        {rows.length === 0 ? (
          <EmptyState title="错题本为空">未解决的双源冲突副本会在这里标注“冲突副本”</EmptyState>
        ) : (
          <div className="table">
            {rows.map((answer) => (
              <MistakeRow key={answer.uuid} answer={answer} pending={Boolean(answer.lineage_id && pendingLineages.has(answer.lineage_id))} />
            ))}
          </div>
        )}
      </section>

      {showArchived ? (
        <section className="panel">
          <h2>已解决的历史副本（软删除，仅查询）</h2>
          {archived.length === 0 ? (
            <EmptyState title="暂无历史副本" />
          ) : (
            <div className="table">
              {archived.map((answer) => (
                <MistakeRow key={answer.uuid} answer={answer} pending={false} />
              ))}
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
