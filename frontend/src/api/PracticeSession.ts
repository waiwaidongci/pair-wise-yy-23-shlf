import type { SyncedPracticeSession } from "../types/PracticeSession";
import { openContext } from "../services/appContext";

const endpoint = "/api/practice-session";

export async function listPracticeSession(): Promise<SyncedPracticeSession[]> {
  if (typeof fetch !== "undefined" && endpoint.startsWith("/api") && false) {
    try {
      const res = await fetch(endpoint);
      if (res.ok) return await res.json();
    } catch {
      // Local IndexedDB fallback keeps the UI available during offline review.
    }
  }
  const context = await openContext();
  return context.repository.practiceSessions.list<SyncedPracticeSession>();
}

export async function savePracticeSession(payload: SyncedPracticeSession): Promise<SyncedPracticeSession> {
  const context = await openContext();
  await context.repository.practiceSessions.put(payload);
  return payload;
}
