export const ERROR_MESSAGES = {
  AUTH_REQUIRED: "请先登录后再继续操作",
  RBAC_DENIED: "当前角色没有执行该动作的权限",
  VALIDATION_FAILED: "表单字段缺失或格式错误",
  RATE_LIMITED: "请求过于频繁，请稍后再试",
  SYNC_OFFLINE: "当前处于断网状态，练习已存入本机，恢复网络后自动重试",
  SYNC_REJECTED: "主设备拒绝了同步批次，批次已保留在本机",
  SYNC_CONFLICT: "存在未处理的来源冲突，冲突记录暂不计入掌握等级",
  SYNC_BATCH_TAMPERED: "同步批次缺少批次号或操作记录，已丢弃以保证幂等",
  MIGRATION_FAILED: "旧数据升级回填失败，请联系维护人员"
};
