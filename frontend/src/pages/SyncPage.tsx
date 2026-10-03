import { useCallback, useState } from "react";
import { useSyncStore } from "../stores/SyncStore";
import { useOnlineSync } from "../hooks/useOnlineSync";
import { pushOutbox, mergeHubIntoMain } from "../api/Sync";
import { resolveConflict } from "../api/Conflict";
import { setForcedOffline, isForcedOffline } from "../utils/connectivity";
import { isMainSource, MAIN_SOURCE } from "../utils/syncMeta";
import { BatchStatusText } from "../constants/SyncStatus";
import { ConflictStatusText } from "../constants/SyncStatus";
import { formatDate, formatSource } from "../utils/formatters";
import { isServiceError } from "../utils/errors";
import { StatusBadge } from "../components/common/StatusBadge";
import { EmptyState } from "../components/common/EmptyState";
import type { SyncConflict } from "../types/SyncConflict";

function memberRows(conflict: SyncConflict, answers: ReturnType<typeof useSyncStore.getState>["answers"], sessions: ReturnType<typeof useSyncStore.getState>["sessions"]) {
  const pool = conflict.entity === "answerRecord" ? answers : sessions;
  return conflict.member_uuids
    .map((memberUuid) => pool.find((row) => row.uuid === memberUuid))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export function SyncPage() {
  const { source, queue, conflicts, answers, sessions, refresh, setMessage, lastMessage } = useSyncStore();
  const [busy, setBusy] = useState(false);
  const online = useOnlineSync(useCallback(() => undefined, []));

  const run = async (action: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await action();
      await refresh();
      setMessage(ok);
    } catch (error) {
      await refresh();
      setMessage(isServiceError(error) ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const onResolve = (conflict: SyncConflict, winnerUuid: string) =>
    run(() => resolveConflict(conflict.entity, conflict.id, winnerUuid), "冲突已解决，掌握等级已按有效答题重算");

  const openBatches = queue.filter((entry) => entry.status !== "SYNCED");
  const syncedBatches = queue.filter((entry) => entry.status === "SYNCED");

  return (
    <main className="page sync-page">
      <section className="page-head">
        <div>
          <p className="eyebrow">sync center</p>
          <h1>同步中心</h1>
        </div>
        <div className="head-badges">
          <StatusBadge value={online ? "ONLINE" : "OFFLINE"} />
          <StatusBadge value={isMainSource(source) ? "SOURCE_MAIN" : "SOURCE_VOLUNTEER"} />
        </div>
      </section>

      <section className="panel">
        <h2>网络与传输</h2>
        <div className="toolbar">
          <button
            className="btn"
            onClick={() => setForcedOffline(!isForcedOffline())}
          >
            模拟{isForcedOffline() ? "恢复网络" : "断网"}
          </button>
          {!isMainSource(source) ? (
            <button className="btn primary" disabled={busy || !online} onClick={() => run(() => pushOutbox(), "本机批次已上传主设备")}>
              回场上传统重试
            </button>
          ) : (
            <button className="btn primary" disabled={busy || !online} onClick={() => run(() => mergeHubIntoMain(), "主设备已合并志愿者批次")}>
              拉取并合并批次
            </button>
          )}
        </div>
        {lastMessage ? <p className="notice">{lastMessage}</p> : null}
      </section>

      <section className="workbench">
        <div className="panel wide">
          <h2>本机批次（失败保留，联网重试）</h2>
          {openBatches.length === 0 && syncedBatches.length === 0 ? (
            <EmptyState title="暂无同步批次">在志愿者设备断网练习后会生成本机批次</EmptyState>
          ) : (
            <div className="table">
              {[...openBatches, ...syncedBatches].map((entry) => (
                <article className="row" key={entry.batch_id}>
                  <div>
                    <strong>{entry.batch_id.slice(0, 8)}</strong>
                    <span className="muted">
                      {" "}
                      · {entry.payload.ops.length} 条操作 · 重试 {entry.attempts} 次 · {formatDate(entry.updated_at)}
                      {entry.last_error ? ` · ${entry.last_error}` : ""}
                    </span>
                  </div>
                  <StatusBadge value={entry.status} />
                  <span className="muted">{BatchStatusText[entry.status]}</span>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h2>来源冲突</h2>
          <p className="muted">同一条记录两边都改过：保留两份来源，未解决前不计入掌握等级。</p>
          {conflicts.length === 0 ? (
            <EmptyState title="暂无冲突" />
          ) : (
            conflicts.map((conflict) => (
              <div className="conflict-card" key={`${conflict.entity}:${conflict.id}`}>
                <div className="conflict-head">
                  <strong>{conflict.entity === "answerRecord" ? "答题记录" : "练习会话"}</strong>
                  <StatusBadge value={conflict.status === "PENDING" ? "CONFLICT_PENDING" : "CONFLICT_RESOLVED"} />
                </div>
                <p className="muted">{ConflictStatusText[conflict.status]}</p>
                <div className="conflict-members">
                  {memberRows(conflict, answers, sessions).map((row) => (
                    <div className={row.uuid === conflict.winner_uuid ? "member winner" : "member"} key={row.uuid}>
                      <div className="member-head">
                        <StatusBadge value="SYNC_SOURCE" />
                        <span>{formatSource(row.source)}</span>
                        <span className="muted">修订 {row.revision}</span>
                      </div>
                      <pre>{JSON.stringify({ ...row, uuid: undefined, lineage_id: undefined, source: undefined, revision: undefined, updated_at: undefined, deleted: undefined }, null, 2)}</pre>
                      {conflict.status === "PENDING" ? (
                        <button className="btn small" disabled={busy} onClick={() => onResolve(conflict, row.uuid ?? "")}>
                          保留此来源
                        </button>
                      ) : row.uuid === conflict.winner_uuid ? (
                        <span className="notice">已采纳 · {formatDate(conflict.resolved_at)}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      <p className="muted">当前库：{source === MAIN_SOURCE ? "主设备" : `志愿者 ${source}`}。批次号与操作修订号保证重复合并不多算。</p>
    </main>
  );
}
