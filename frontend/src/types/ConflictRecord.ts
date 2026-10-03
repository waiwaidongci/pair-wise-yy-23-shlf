// 冲突解决策略：保留本机 / 保留对方 / 两者都保留
export const ConflictResolution = ["KEEP_LOCAL", "KEEP_REMOTE", "KEEP_BOTH"] as const;
export type ConflictResolution = (typeof ConflictResolution)[number];
export const ConflictResolutionText: Record<ConflictResolution, string> = {
  KEEP_LOCAL: "保留本机版本",
  KEEP_REMOTE: "保留对方版本",
  KEEP_BOTH: "两者都保留"
};

// 冲突记录：同一逻辑 id 被两边修改后保留两份来源，未解决前不计入掌握等级
export interface ConflictRecord {
  id: string;                 // 冲突记录 id
  conflict_group_id: string;  // 冲突组 id，冲突的两份记录共享
  entity_type: "answer_record" | "practice_session";
  entity_id: number;          // 逻辑 id
  local_record_key: string;   // 本机副本 recordKey
  remote_record_key: string;  // 对方副本 recordKey
  local_source: string;
  remote_source: string;
  local_revision: number;
  remote_revision: number;
  detected_at: string;
  resolved: boolean;
  resolution: ConflictResolution | "";
  resolved_at: string;
}
