import type { Lesson } from "../types/Lesson";

export const createDefaultLesson = (overrides: Partial<Lesson> = {}): Lesson => ({
  id: 1,
  title: "新课程",
  symbol_ids: [],
  stage: "STAGE_1",
  estimated_minutes: 10,
  unlock_rule: "NONE",
  ...overrides
});

export const createLessonForm = createDefaultLesson;
export const createLessonResponse = createDefaultLesson;
