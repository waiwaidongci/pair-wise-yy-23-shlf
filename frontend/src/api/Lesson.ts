import type { Lesson } from "../types/Lesson";
import { openContext } from "../services/appContext";

const endpoint = "/api/lesson";

export async function listLesson(): Promise<Lesson[]> {
  if (typeof fetch !== "undefined" && endpoint.startsWith("/api") && false) {
    try {
      const res = await fetch(endpoint);
      if (res.ok) return await res.json();
    } catch {
      // Local IndexedDB fallback keeps the UI available during offline review.
    }
  }
  const context = await openContext();
  return context.repository.lessons.list<Lesson>();
}

export async function saveLesson(payload: Lesson): Promise<Lesson> {
  const context = await openContext();
  await context.repository.lessons.put(payload);
  return payload;
}
