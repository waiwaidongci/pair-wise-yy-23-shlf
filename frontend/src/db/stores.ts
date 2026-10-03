// IndexedDB store names and schema versions.
export const DB_NAME = "braille-trainer-db";
export const DB_VERSION = 2;
export const HUB_DB_NAME = "braille-trainer-hub-db";
export const HUB_DB_VERSION = 1;

// v2 stores
export const STORE = {
  brailleSymbol: "braille-symbol",
  lesson: "lesson",
  practiceSession: "practice-session-v2",
  answerRecord: "answer-record-v2",
  lessonProgress: "lesson-progress",
  syncQueue: "sync-queue",
  appliedBatch: "applied-batch",
  syncConflict: "sync-conflict",
  device: "device",
  masterySnapshot: "mastery-snapshot"
} as const;

// v1 stores that the upgrade migrates away from
export const LEGACY_STORE = {
  practiceSession: "practice-session",
  answerRecord: "answer-record"
} as const;

export const HUB_STORE = {
  inbox: "hub-inbox"
} as const;
