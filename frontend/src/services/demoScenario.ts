import { openContext } from "./appContext";
import { createSyncBatch, createSyncOp } from "../constructors/SyncBatchConstructor";
import { nextNumericId } from "../utils/id";
import { withRevisionBump } from "../utils/syncMeta";
import type { AnswerRecord } from "../types/AnswerRecord";
import type { SyncBatch, SyncQueueEntry } from "../types/SyncBatch";

// Demo scenario helper. A real volunteer device accumulates these rows by
// practicing offline; here we stage them so reviewers can reproduce:
// 1. volunteer copies the main lineage (shared legacy lineage ids)
// 2. volunteer edits the SAME answer the main also edits
// 3. the batch stays local until 回场 + 恢复网络重试
export async function stageVolunteerScenario(
  source: string,
  opts: { diverge?: boolean } = {}
): Promise<{ batchId: string; divergedLineage: string | null }> {
  const context = await openContext(source);

  // Clone reference + synced rows from the main lineage so uuid/lineage match.
  const main = await openContext("main");
  const [symbols, lessons, mainSessions, mainAnswers, mainProgress] = await Promise.all([
    main.repository.symbols.list(),
    main.repository.lessons.list(),
    main.repository.practiceSessions.list<Array<Record<string, unknown>>>(),
    main.repository.answerRecords.list<Array<Record<string, unknown>>>(),
    main.repository.lessonProgress.list<Array<Record<string, unknown>>>()
  ]);

  await context.repository.transaction(
    ["braille-symbol", "lesson", "practice-session-v2", "answer-record-v2", "lesson-progress"],
    "readwrite",
    ([symbolStore, lessonStore, sessionStore, answerStore, progressStore]) => {
      symbolStore.clear();
      lessonStore.clear();
      sessionStore.clear();
      answerStore.clear();
      progressStore.clear();
      symbols.forEach((row) => symbolStore.put(row));
      lessons.forEach((row) => lessonStore.put(row));
      mainSessions.forEach((row) => sessionStore.put(row));
      mainAnswers.forEach((row) => answerStore.put(row));
      mainProgress.forEach((row) => progressStore.put(row));
    }
  );

  const now = new Date().toISOString();
  const sessions = await context.repository.practiceSessions.list<Record<string, unknown>>();
  const session = sessions[0];
  const answers = await context.repository.answerRecords.list<AnswerRecord & Record<string, unknown>>();
  const target = answers.find((row) => row.id === 5) ?? answers[0];
  let divergedLineage: string | null = null;

  // A brand-new offline answer (unique uuid; merges cleanly).
  const offlineAnswer = withRevisionBump(
    {
      id: nextNumericId(answers),
      session_id: Number(session?.id ?? 1),
      symbol_id: 2,
      user_answer: "b",
      correct: true,
      latency_ms: 3100,
      mistake_reason: "",
      answered_at: now
    } as AnswerRecord,
    source,
    now
  );

  const ops = [createSyncOp("answerRecord", offlineAnswer)];

  if (opts.diverge && target) {
    // Volunteer edits the shared answer while the main device also edited it.
    divergedLineage = String(target.lineage_id);
    const volunteerCopy = withRevisionBump(
      { ...target, user_answer: "志愿者批改：c", correct: true, answered_at: now, mistake_reason: "" } as AnswerRecord,
      source,
      now
    );
    await context.repository.answerRecords.put(volunteerCopy);
    ops.push(createSyncOp("answerRecord", volunteerCopy));
  }

  const batch = createSyncBatch(source, ops, now);
  const entry: SyncQueueEntry = {
    batch_id: batch.batch_id,
    source,
    status: "PENDING",
    attempts: 0,
    last_error: "",
    payload: batch as SyncBatch,
    created_at: now,
    updated_at: now
  };
  await context.repository.queue.put(entry);
  return { batchId: batch.batch_id, divergedLineage };
}

// Create the main-side edit that makes the staged volunteer answer diverge.
export async function stageMainEdit(lineageId?: string): Promise<string | null> {
  const main = await openContext("main");
  const answers = await main.repository.answerRecords.list<AnswerRecord & Record<string, unknown>>();
  const target = lineageId
    ? answers.find((row) => row.lineage_id === lineageId)
    : answers.find((row) => row.id === 5) ?? answers[0];
  if (!target) return null;
  const edited = withRevisionBump(
    { ...target, user_answer: "主设备批改：i", correct: false, mistake_reason: "TEACHER_REVIEW" },
    "main",
    new Date().toISOString()
  );
  await main.repository.answerRecords.put(edited);
  const snapshots = await main.mergeService.recomputeMastery();
  await main.repository.masterySnapshots.putMany(snapshots);
  return String(edited.lineage_id);
}
