import type { SyncBatch } from "../../types/SyncBatch";
import { SyncBatchStatusText } from "../../types/SyncBatchStatus";
import { formatDate } from "../../utils/formatters";

// 同步批次列表：展示批次状态，失败批次可重试
export function SyncBatchList({
  batches,
  onRetry
}: {
  batches: SyncBatch[];
  onRetry: (batchId: string) => void;
}) {
  if (batches.length === 0) {
    return <div className="empty">暂无同步批次</div>;
  }
  return (
    <div className="batch-list">
      {batches.map((b) => (
        <article key={b.id} className={"batch status-" + b.status}>
          <div className="batch-row">
            <strong>{b.source_name}</strong>
            <span className={"badge batch-" + b.status}>{SyncBatchStatusText[b.status]}</span>
          </div>
          <div className="batch-meta">
            <span>批次 {b.id}</span>
            <span>{formatDate(b.created_at)}</span>
            <span>记录 {b.record_count} · 会话 {b.session_count}</span>
            {b.error_message ? <span className="error-msg">{b.error_message}</span> : null}
          </div>
          {b.status === "failed" ? (
            <button className="retry-btn" onClick={() => onRetry(b.id)}>重试</button>
          ) : null}
        </article>
      ))}
    </div>
  );
}
