import { getAll, put, putAll, STORES } from "../utils/storage";
import { ensureSeeded } from "./init";
import type { PracticeSession } from "../types/PracticeSession";

export async function listPracticeSession(): Promise<PracticeSession[]> {
  await ensureSeeded();
  return getAll<PracticeSession>(STORES.PRACTICE_SESSIONS);
}

export async function savePracticeSession(payload: PracticeSession): Promise<PracticeSession> {
  await ensureSeeded();
  await put(STORES.PRACTICE_SESSIONS, payload as unknown as Record<string, unknown>, "recordKey");
  return payload;
}

export async function savePracticeSessions(payloads: PracticeSession[]): Promise<void> {
  await ensureSeeded();
  await putAll(STORES.PRACTICE_SESSIONS, payloads as unknown as Record<string, unknown>[], "recordKey");
}
