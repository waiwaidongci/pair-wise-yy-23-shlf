import { listLesson } from "./init";
import type { Lesson } from "../types/Lesson";

export { listLesson };

export async function saveLesson(payload: Lesson): Promise<Lesson> {
  console.info("save Lesson", payload);
  return payload;
}
