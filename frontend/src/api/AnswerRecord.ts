import { getAll, put, putAll, STORES } from "../utils/storage";
import { ensureSeeded } from "./init";
import type { AnswerRecord } from "../types/AnswerRecord";

export async function listAnswerRecord(): Promise<AnswerRecord[]> {
  await ensureSeeded();
  return getAll<AnswerRecord>(STORES.ANSWER_RECORDS);
}

export async function saveAnswerRecord(payload: AnswerRecord): Promise<AnswerRecord> {
  await ensureSeeded();
  await put(STORES.ANSWER_RECORDS, payload as unknown as Record<string, unknown>, "recordKey");
  return payload;
}

export async function saveAnswerRecords(payloads: AnswerRecord[]): Promise<void> {
  await ensureSeeded();
  await putAll(STORES.ANSWER_RECORDS, payloads as unknown as Record<string, unknown>[], "recordKey");
}
