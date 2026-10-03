import { useEffect, useState } from "react";
import { useSyncStore } from "../stores/SyncStore";
import { useAnswerRecordStore } from "../stores/AnswerRecordStore";
import { usePracticeSessionStore } from "../stores/PracticeSessionStore";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { usePendingSync } from "../hooks/usePendingSync";
import { SyncBatchList } from "../components/common/SyncBatchList";
import { ConflictResolver } from "../components/common/ConflictResolver";
import { StatusBadge } from "../components/common/StatusBadge";
import { StatCard } from "../components/common/StatCard";
import { setMockNetwork, getMockNetwork } from "../api/Sync";
import { ERROR_MESSAGES } from "../constants/errorMessages";

const errMsg = (code: string): string => ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES] ?? code;

export function SyncPage() {
  const { batches, conflicts, processedCount, loading, load, pushLocal, pullRemote, retry } = useSyncStore();
  const reloadAnswers = useAnswerRecordStore((s) => s.load);
  const reloadSessions = usePracticeSessionStore((s) => s.load);
  const online = useOnlineStatus();
  const { count: pendingCount, failed: failedCount } = usePendingSync();
  const [offline, setOffline] = useState(getMockNetwork().offline);
  const [failNext, setFailNext] = useState(getMockNetwork().failNext);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    load();
  }, [load]);

  const refreshAll = async () => {
    await Promise.all([load(), reloadAnswers(), reloadSessions()]);
  };

  const onPush = async () => {
    const result = await pushLocal();
    if (!result.pushed && result.error) {
      setMsg(errMsg(result.error));
    } else if (!result.pushed) {
      setMsg("本机没有待同步的练习记录");
    } else {
      setMsg("本机批次已推送");
    }
    await refreshAll();
  };

  const onPull = async () => {
    const result = await pullRemote();
    if (result.alreadyProcessed) {
      setMsg(ERROR_MESSAGES.SYNC_DUPLICATE_BATCH);
    } else {
      setMsg(`已合并：新增 ${result.inserted}，更新 ${result.updated}，冲突 ${result.conflicts}`);
    }
    await refreshAll();
  };

  const onRetry = async (batchId: string) => {
    const result = await retry(batchId);
    setMsg(result.pushed ? "批次重试成功" : errMsg(result.error ?? "SYNC_BATCH_FAILED"));
    await refreshAll();
  };

  const toggleOffline = () => {
    const next = !offline;
    setOffline(next);
    setMockNetwork({ offline: next });
  };

  const toggleFail = () => {
    const next = !failNext;
    setFailNext(next);
    setMockNetwork({ failNext: next });
  };

  const unresolvedConflicts = conflicts.filter((c) => !c.resolved);

  return (
    <main className="page">
      <section className="page-head">
        <div>
          <p className="eyebrow">braille-trainer</p>
          <h1>同步中心</h1>
        </div>
        <StatusBadge value={online ? "ONLINE" : "OFFLINE"} />
      </section>

      <section className="metrics">
        <StatCard label="待同步批次" value={pendingCount} />
        <StatCard label="失败批次" value={failedCount} />
        <StatCard label="未解决冲突" value={unresolvedConflicts.length} />
        <StatCard label="已处理批次" value={processedCount} />
      </section>

      <section className="panel">
        <h2>回场合并</h2>
        <p className="sync-tip">
          志愿者断网时练习进度先存本机，回场后合并练习会话、答题记录与课程进度。同一答题记录被两边改过时保留两份来源，冲突未处理前不计入掌握等级。
        </p>
        <div className="sync-actions">
          <button onClick={onPush} disabled={loading}>推送本机批次</button>
          <button onClick={onPull} disabled={loading}>模拟志愿者回场</button>
          <button className={offline ? "active" : ""} onClick={toggleOffline}>
            {offline ? "恢复网络" : "模拟断网"}
          </button>
          <button className={failNext ? "active" : ""} onClick={toggleFail}>
            {failNext ? "取消失败注入" : "模拟同步失败"}
          </button>
        </div>
        {msg ? <p className="sync-msg">{msg}</p> : null}
      </section>

      <section className="panel">
        <h2>冲突记录（未解决前不计入掌握等级）</h2>
        {unresolvedConflicts.length === 0 ? (
          <div className="empty">暂无未解决冲突</div>
        ) : (
          <div className="conflict-list">
            {unresolvedConflicts.map((c) => (
              <ConflictResolver key={c.id} conflict={c} />
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>同步批次</h2>
        <SyncBatchList batches={batches} onRetry={onRetry} />
      </section>
    </main>
  );
}
