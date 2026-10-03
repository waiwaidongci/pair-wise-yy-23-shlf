// 合并核心逻辑（纯函数）：离线回场合并练习会话与答题记录。
// 规则：
//  - 同 (id, source)：同一条记录，按修订号更新（revision 更大者胜）
//  - 同 id 不同 source：两边各自修改过 → 冲突，保留两份来源，标记 conflict，未解决前不计入掌握等级
//  - 新 id：直接插入
import type { SyncStatus } from "../types/SyncStatus";
import type { ConflictRecord } from "../types/ConflictRecord";
import { createDefaultConflictRecord } from "../constructors/ConflictRecordConstructor";

export interface SyncableRecord {
  id: number;
  recordKey: string;
  source: string;
  revision: number;
  sync_status: SyncStatus;
  conflict_group_id: string;
}

export function recordKey(id: number, source: string): string {
  return `${id}::${source}`;
}

export function newConflictGroupId(entityType: string, id: number): string {
  return `cg-${entityType}-${id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isNewer(remote: SyncableRecord, local: SyncableRecord): boolean {
  return remote.revision > local.revision;
}

// 可比较的内容字段（排除同步元数据）
export function contentSignature(record: SyncableRecord): string {
  const r = record as unknown as Record<string, unknown>;
  return JSON.stringify({
    session_id: r.session_id,
    symbol_id: r.symbol_id,
    user_answer: r.user_answer,
    correct: r.correct,
    latency_ms: r.latency_ms,
    mistake_reason: r.mistake_reason,
    lesson_id: r.lesson_id,
    mode: r.mode,
    started_at: r.started_at,
    finished_at: r.finished_at,
    score: r.score,
    mistake_count: r.mistake_count
  });
}

export interface MergePlan {
  recordsToPut: SyncableRecord[];
  conflictsToCreate: ConflictRecord[];
  insertedCount: number;
  updatedCount: number;
  conflictCount: number;
  skippedCount: number;
}

// 规划一次远程批次的合并，返回需要持久化的记录与冲突
export function planMerge<T extends SyncableRecord>(
  localRecords: T[],
  remoteRecords: T[],
  entityType: "answer_record" | "practice_session"
): MergePlan {
  const recordsToPut: SyncableRecord[] = [];
  const conflictsToCreate: ConflictRecord[] = [];
  let insertedCount = 0;
  let updatedCount = 0;
  let conflictCount = 0;
  let skippedCount = 0;

  const localById = new Map<number, T[]>();
  localRecords.forEach((r) => {
    const arr = localById.get(r.id) ?? [];
    arr.push(r);
    localById.set(r.id, arr);
  });

  for (const remote of remoteRecords) {
    const locals = localById.get(remote.id) ?? [];
    if (locals.length === 0) {
      // 新 id：直接插入（来源保留远程设备）
      recordsToPut.push({ ...remote, recordKey: recordKey(remote.id, remote.source), sync_status: "synced" });
      insertedCount += 1;
      continue;
    }
    const sameSource = locals.find((l) => l.source === remote.source);
    if (sameSource) {
      // 同一条记录：仅当远程修订号更大时更新
      if (isNewer(remote, sameSource)) {
        recordsToPut.push({ ...remote, recordKey: recordKey(remote.id, remote.source), sync_status: "synced" });
        updatedCount += 1;
      } else {
        skippedCount += 1;
      }
      continue;
    }
    // 同 id 不同来源：两边都改过 → 冲突，保留两份来源
    const groupId = newConflictGroupId(entityType, remote.id);
    const remoteCopy: SyncableRecord = {
      ...remote,
      recordKey: recordKey(remote.id, remote.source),
      sync_status: "conflict",
      conflict_group_id: groupId
    };
    recordsToPut.push(remoteCopy);
    // 本机已有副本一并标记为冲突
    locals.forEach((l) => {
      recordsToPut.push({ ...l, sync_status: "conflict", conflict_group_id: groupId });
    });
    conflictsToCreate.push(
      createDefaultConflictRecord({
        conflict_group_id: groupId,
        entity_type: entityType,
        entity_id: remote.id,
        local_record_key: locals[0].recordKey,
        remote_record_key: remoteCopy.recordKey,
        local_source: locals[0].source,
        remote_source: remote.source,
        local_revision: locals[0].revision,
        remote_revision: remote.revision,
        detected_at: new Date().toISOString(),
        resolved: false
      })
    );
    conflictCount += 1;
  }

  return { recordsToPut, conflictsToCreate, insertedCount, updatedCount, conflictCount, skippedCount };
}
