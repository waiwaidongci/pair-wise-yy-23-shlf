import type { ConflictRecord } from "../types/ConflictRecord";

// 冲突记录构造器：默认对象、表单对象、响应对象统一由此构造
export const createDefaultConflictRecord = (overrides: Partial<ConflictRecord> = {}): ConflictRecord => ({
  id: "",
  conflict_group_id: "",
  entity_type: "answer_record",
  entity_id: 0,
  local_record_key: "",
  remote_record_key: "",
  local_source: "",
  remote_source: "",
  local_revision: 0,
  remote_revision: 0,
  detected_at: "",
  resolved: false,
  resolution: "",
  resolved_at: "",
  ...overrides
});

export const createConflictRecordForm = createDefaultConflictRecord;
export const createConflictRecordResponse = createDefaultConflictRecord;
