export const ConflictResolution = ["KEEP_LOCAL", "KEEP_REMOTE", "KEEP_BOTH"] as const;
export type ConflictResolution = (typeof ConflictResolution)[number];
export const ConflictResolutionText: Record<ConflictResolution, string> = {
  KEEP_LOCAL: "保留本机版本",
  KEEP_REMOTE: "保留对方版本",
  KEEP_BOTH: "两者都保留"
};
