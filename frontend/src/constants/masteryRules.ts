import { MasteryLevel } from "./MasteryLevel";

// Valid answers are the only inputs to mastery; records pending conflict
// resolution never count (see utils/mastery.ts).
export const MASTERY_RULES = {
  // at least this many VALID answers required to leave NEW
  MIN_ANSWERS_LEAVING_NEW: 1,
  // reaching FAMILIAR requires ...
  MIN_ANSWERS_FAMILIAR: 4,
  FAMILIAR_ACCURACY: 0.75,
  // reaching MASTERED requires ...
  MIN_ANSWERS_MASTERED: 6,
  MASTERED_ACCURACY: 0.9,
  // a recent wrong answer pulls the symbol back to LEARNING
  RECENT_WRONG_WINDOW_MS: 7 * 24 * 60 * 60 * 1000
} as const;

export const MASTERY_ORDER: Record<string, number> = {
  NEW: 0,
  LEARNING: 1,
  FAMILIAR: 2,
  MASTERED: 3
};

export type MasteryRules = typeof MASTERY_RULES;
export type { MasteryLevel };
