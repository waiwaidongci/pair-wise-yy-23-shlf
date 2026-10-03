import type { AnswerRecord } from "../types/AnswerRecord";
import type { PracticeSession } from "../types/PracticeSession";
import type { BrailleSymbol } from "../types/BrailleSymbol";
import type { Lesson } from "../types/Lesson";

// 旧数据：部分记录缺少 source/revision，用于演示升级回填；
// 另含已同步记录与一对冲突记录（同 id 不同来源）。
const answerRecord: AnswerRecord[] = [
  // —— 旧数据：缺少 source/revision，升级时回填为 legacy ——
  {
    id: 1,
    recordKey: "",
    session_id: 1,
    symbol_id: 1,
    user_answer: "⠁",
    correct: "true",
    latency_ms: "1200",
    mistake_reason: "",
    source: "",
    revision: 0,
    sync_status: "local",
    conflict_group_id: "",
    backfilled: false
  },
  {
    id: 2,
    recordKey: "",
    session_id: 1,
    symbol_id: 2,
    user_answer: "⠃",
    correct: "false",
    latency_ms: "2300",
    mistake_reason: "CELL_ORDER",
    source: "",
    revision: 0,
    sync_status: "local",
    conflict_group_id: "",
    backfilled: false
  },
  {
    id: 3,
    recordKey: "",
    session_id: 2,
    symbol_id: 3,
    user_answer: "⠉",
    correct: "true",
    latency_ms: "980",
    mistake_reason: "",
    source: "",
    revision: 0,
    sync_status: "local",
    conflict_group_id: "",
    backfilled: false
  },
  // —— 已同步记录（主设备来源）——
  {
    id: 4,
    recordKey: "4::main",
    session_id: 2,
    symbol_id: 1,
    user_answer: "⠁",
    correct: "true",
    latency_ms: "1100",
    mistake_reason: "",
    source: "main",
    revision: 2,
    sync_status: "synced",
    conflict_group_id: "",
    backfilled: false
  },
  // —— 冲突对：同 id=5，主设备与志愿者 A 各改一份 ——
  {
    id: 5,
    recordKey: "5::main",
    session_id: 3,
    symbol_id: 2,
    user_answer: "⠃",
    correct: "true",
    latency_ms: "1500",
    mistake_reason: "",
    source: "main",
    revision: 1,
    sync_status: "conflict",
    conflict_group_id: "cg-demo-5",
    backfilled: false
  },
  {
    id: 5,
    recordKey: "5::volunteer-a",
    session_id: 3,
    symbol_id: 2,
    user_answer: "⠃",
    correct: "false",
    latency_ms: "2600",
    mistake_reason: "CELL_ORDER",
    source: "volunteer-a",
    revision: 1,
    sync_status: "conflict",
    conflict_group_id: "cg-demo-5",
    backfilled: false
  },
  // —— 主设备已同步记录（远程批次合并时与之冲突）——
  {
    id: 7,
    recordKey: "7::main",
    session_id: 2,
    symbol_id: 4,
    user_answer: "⠙",
    correct: "true",
    latency_ms: "1300",
    mistake_reason: "",
    source: "main",
    revision: 1,
    sync_status: "synced",
    conflict_group_id: "",
    backfilled: false
  },
  // —— 志愿者 A 已同步记录（远程批次带来同来源更高修订号 → 更新）——
  {
    id: 8,
    recordKey: "8::volunteer-a",
    session_id: 1,
    symbol_id: 5,
    user_answer: "⠑",
    correct: "false",
    latency_ms: "2100",
    mistake_reason: "DOT_MISSING",
    source: "volunteer-a",
    revision: 1,
    sync_status: "synced",
    conflict_group_id: "",
    backfilled: false
  }
];

const practiceSession: PracticeSession[] = [
  {
    id: 1,
    recordKey: "",
    lesson_id: 1,
    mode: "CELL_TO_TEXT",
    started_at: "2026-09-20T09:00:00Z",
    finished_at: "2026-09-20T09:12:00Z",
    score: 80,
    mistake_count: 2,
    source: "",
    revision: 0,
    sync_status: "local",
    conflict_group_id: "",
    backfilled: false
  },
  {
    id: 2,
    recordKey: "",
    lesson_id: 2,
    mode: "TEXT_TO_CELL",
    started_at: "2026-09-22T10:00:00Z",
    finished_at: "2026-09-22T10:18:00Z",
    score: 65,
    mistake_count: 4,
    source: "",
    revision: 0,
    sync_status: "local",
    conflict_group_id: "",
    backfilled: false
  },
  {
    id: 3,
    recordKey: "3::main",
    lesson_id: 3,
    mode: "LISTENING",
    started_at: "2026-09-25T14:00:00Z",
    finished_at: "2026-09-25T14:25:00Z",
    score: 90,
    mistake_count: 1,
    source: "main",
    revision: 2,
    sync_status: "synced",
    conflict_group_id: "",
    backfilled: false
  }
];

const brailleSymbol: BrailleSymbol[] = [
  { id: 1, cell_pattern: "⠁", letter: "A", pinyin: "a", category: "LETTER", difficulty: "L1", audio_hint_key: "a" },
  { id: 2, cell_pattern: "⠃", letter: "B", pinyin: "b", category: "LETTER", difficulty: "L1", audio_hint_key: "b" },
  { id: 3, cell_pattern: "⠉", letter: "C", pinyin: "c", category: "LETTER", difficulty: "L1", audio_hint_key: "c" },
  { id: 4, cell_pattern: "⠙", letter: "D", pinyin: "d", category: "LETTER", difficulty: "L2", audio_hint_key: "d" },
  { id: 5, cell_pattern: "⠑", letter: "E", pinyin: "e", category: "LETTER", difficulty: "L2", audio_hint_key: "e" },
  { id: 6, cell_pattern: "⠿", letter: "数", pinyin: "shu", category: "NUMBER", difficulty: "L3", audio_hint_key: "shu" }
];

const lesson: Lesson[] = [
  { id: 1, title: "第一课 认识点位", symbol_ids: [1, 2, 3], stage: "入门", estimated_minutes: 15, unlock_rule: "默认解锁" },
  { id: 2, title: "第二课 听写练习", symbol_ids: [1, 2, 3, 4, 5], stage: "基础", estimated_minutes: 20, unlock_rule: "完成第一课" },
  { id: 3, title: "第三课 数字与标点", symbol_ids: [6], stage: "进阶", estimated_minutes: 25, unlock_rule: "完成第二课" }
];

export const mockData = { answerRecord, practiceSession, brailleSymbol, lesson };
