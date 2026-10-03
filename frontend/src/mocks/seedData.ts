import type { BrailleSymbol } from "../types/BrailleSymbol";
import type { Lesson } from "../types/Lesson";
import type { PracticeSession } from "../types/PracticeSession";
import type { AnswerRecord } from "../types/AnswerRecord";

// v1-shaped seed: intentionally WITHOUT uuid/source/revision so that a fresh
// install exercises the same v1 -> v2 backfill path as an upgraded device.
export const seedBrailleSymbols: BrailleSymbol[] = [
  { id: 1, cell_pattern: "1", letter: "a", pinyin: "a", category: "LETTER", difficulty: "EASY", audio_hint_key: "letter_a" },
  { id: 2, cell_pattern: "12", letter: "b", pinyin: "bo", category: "LETTER", difficulty: "EASY", audio_hint_key: "letter_b" },
  { id: 3, cell_pattern: "14", letter: "c", pinyin: "ci", category: "LETTER", difficulty: "EASY", audio_hint_key: "letter_c" },
  { id: 4, cell_pattern: "145", letter: "d", pinyin: "de", category: "LETTER", difficulty: "MEDIUM", audio_hint_key: "letter_d" },
  { id: 5, cell_pattern: "15", letter: "e", pinyin: "e", category: "LETTER", difficulty: "EASY", audio_hint_key: "letter_e" },
  { id: 6, cell_pattern: "124", letter: "f", pinyin: "fo", category: "LETTER", difficulty: "MEDIUM", audio_hint_key: "letter_f" },
  { id: 7, cell_pattern: "1234", letter: "数字", pinyin: "shu zi fu", category: "NUMBER", difficulty: "HARD", audio_hint_key: "number_sign" },
  { id: 8, cell_pattern: "2", letter: "，", pinyin: "dou hao", category: "PUNCTUATION", difficulty: "MEDIUM", audio_hint_key: "comma" }
];

export const seedLessons: Lesson[] = [
  { id: 1, title: "第一课：元音入门", symbol_ids: [1, 3, 5], stage: "STAGE_1", estimated_minutes: 10, unlock_rule: "NONE" },
  { id: 2, title: "第二课：辅音 b d f", symbol_ids: [2, 4, 6], stage: "STAGE_2", estimated_minutes: 15, unlock_rule: "FINISH_STAGE_1" }
];

export const seedPracticeSessions: PracticeSession[] = [
  { id: 1, lesson_id: 1, mode: "CELL_TO_TEXT", started_at: "2026-09-20T09:00:00Z", finished_at: "2026-09-20T09:08:00Z", score: 100, mistake_count: 0 },
  { id: 2, lesson_id: 1, mode: "MIXED", started_at: "2026-09-27T09:00:00Z", finished_at: "2026-09-27T09:12:00Z", score: 67, mistake_count: 1 }
];

export const seedAnswerRecords: AnswerRecord[] = [
  { id: 1, session_id: 1, symbol_id: 1, user_answer: "a", correct: true, latency_ms: 2100, mistake_reason: "", answered_at: "2026-09-20T09:01:00Z" },
  { id: 2, session_id: 1, symbol_id: 3, user_answer: "c", correct: true, latency_ms: 2600, mistake_reason: "", answered_at: "2026-09-20T09:03:00Z" },
  { id: 3, session_id: 1, symbol_id: 5, user_answer: "e", correct: true, latency_ms: 1900, mistake_reason: "", answered_at: "2026-09-20T09:06:00Z" },
  { id: 4, session_id: 2, symbol_id: 1, user_answer: "a", correct: true, latency_ms: 1700, mistake_reason: "", answered_at: "2026-09-27T09:03:00Z" },
  { id: 5, session_id: 2, symbol_id: 3, user_answer: "e", correct: false, latency_ms: 4200, mistake_reason: "DOT_CONFUSED", answered_at: "2026-09-27T09:07:00Z" },
  { id: 6, session_id: 2, symbol_id: 5, user_answer: "e", correct: true, latency_ms: 2000, mistake_reason: "", answered_at: "2026-09-27T09:10:00Z" }
];

export const mockData = {
  brailleSymbol: seedBrailleSymbols,
  lesson: seedLessons,
  practiceSession: seedPracticeSessions,
  answerRecord: seedAnswerRecords
};
