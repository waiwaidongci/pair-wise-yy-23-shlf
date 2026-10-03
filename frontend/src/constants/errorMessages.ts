export const ERROR_MESSAGES = {
  AUTH_REQUIRED: "请先登录后再继续操作",
  RBAC_DENIED: "当前角色没有执行该动作的权限",
  VALIDATION_FAILED: "表单字段缺失或格式错误",
  RATE_LIMITED: "请求过于频繁，请稍后再试",
  SYNC_OFFLINE: "当前离线，已保留本机批次，联网后自动重试",
  SYNC_BATCH_FAILED: "同步失败，本机批次已保留，可稍后重试",
  SYNC_CONFLICT_UNRESOLVED: "存在未解决的冲突，冲突记录暂不计入掌握等级",
  SYNC_DUPLICATE_BATCH: "该批次已处理，重复合并不多算",
  SYNC_BACKFILL_FAILED: "升级回填来源或修订号失败",
  SYNC_MERGE_FAILED: "合并练习会话与答题记录失败"
};
