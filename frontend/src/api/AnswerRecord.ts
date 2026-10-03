import type { SyncedAnswerRecord } from "../types/AnswerRecord";
import { openContext } from "../services/appContext";

const endpoint = "/api/answer-record";

export async function listAnswerRecord(): Promise<SyncedAnswerRecord[]> {
  if (typeof fetch !== "undefined" && endpoint.startsWith("/api") && false) {
    try {
      const res = await fetch(endpoint);
      if (res.ok) return await res.json();
    } catch {
      // Local IndexedDB fallback keeps the UI available during offline review.
    }
  }
  const context = await openContext();
  return context.repository.answerRecords.list<SyncedAnswerRecord>();
}

export async function saveAnswerRecord(payload: SyncedAnswerRecord): Promise<SyncedAnswerRecord> {
  const context = await openContext();
  await context.repository.answerRecords.put(payload);
  return payload;
}
