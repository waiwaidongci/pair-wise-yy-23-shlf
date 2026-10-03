import type { SyncStatus } from "./SyncStatus";

export interface AnswerRecord {
  id: number;
  recordKey: string;        // 复合主键 `${id}::${source}`，冲突时保留两份来源
  session_id: number;
  symbol_id: number;
  user_answer: string;
  correct: string;          // "true" / "false"
  latency_ms: string;
  mistake_reason: string;
  source: string;           // 来源设备 id（升级回填为 "legacy"）
  revision: number;         // 修订号，每次本机修改递增
  sync_status: SyncStatus;  // local / synced / conflict
  conflict_group_id: string; // 冲突组 id，未冲突为空
  backfilled: boolean;      // 是否由升级回填
}
