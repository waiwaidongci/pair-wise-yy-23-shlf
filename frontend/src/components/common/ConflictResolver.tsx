import { useState } from "react";
import type { ConflictRecord } from "../../types/ConflictRecord";
import { ConflictResolutionText, type ConflictResolution } from "../../types/ConflictRecord";
import { useConflictResolver } from "../../hooks/useConflictResolver";
import { SyncStatusBadge } from "./SyncStatusBadge";

// 冲突解决器：展示同一条记录的两份来源，提供保留本机/保留对方/两者都保留
export function ConflictResolver({ conflict }: { conflict: ConflictRecord }) {
  const { resolve } = useConflictResolver();
  const [busy, setBusy] = useState(false);

  const pick = async (resolution: ConflictResolution) => {
    setBusy(true);
    try {
      await resolve(conflict.id, resolution);
    } finally {
      setBusy(false);
    }
  };

  if (conflict.resolved) {
    return (
      <div className="conflict resolved">
        <span>已解决：{ConflictResolutionText[conflict.resolution as ConflictResolution]}</span>
      </div>
    );
  }

  return (
    <div className="conflict">
      <div className="conflict-head">
        <strong>冲突 {conflict.entity_type === "answer_record" ? "答题记录" : "练习会话"} #{conflict.entity_id}</strong>
        <SyncStatusBadge status="conflict" />
      </div>
      <div className="conflict-sources">
        <div className="source">
          <span className="source-tag">本机来源 {conflict.local_source}</span>
          <span>修订号 {conflict.local_revision}</span>
        </div>
        <div className="source">
          <span className="source-tag">对方来源 {conflict.remote_source}</span>
          <span>修订号 {conflict.remote_revision}</span>
        </div>
      </div>
      <div className="conflict-actions">
        <button disabled={busy} onClick={() => pick("KEEP_LOCAL")}>{ConflictResolutionText.KEEP_LOCAL}</button>
        <button disabled={busy} onClick={() => pick("KEEP_REMOTE")}>{ConflictResolutionText.KEEP_REMOTE}</button>
        <button disabled={busy} onClick={() => pick("KEEP_BOTH")}>{ConflictResolutionText.KEEP_BOTH}</button>
      </div>
    </div>
  );
}
