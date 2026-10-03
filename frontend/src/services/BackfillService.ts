// 升级回填服务：旧数据缺少 source/revision 时回填，保证错题本/历史可查、进度可算
import { listAnswerRecord, saveAnswerRecords } from "../api/AnswerRecord";
import { listPracticeSession, savePracticeSessions } from "../api/PracticeSession";
import { backfillAll } from "../utils/backfill";
import { logSync } from "../utils/logger";

export async function runBackfill(): Promise<{ answers: number; sessions: number }> {
  const [answers, sessions] = await Promise.all([listAnswerRecord(), listPracticeSession()]);
  const a = backfillAll(answers);
  const s = backfillAll(sessions);
  if (a.backfilledCount > 0) await saveAnswerRecords(a.records);
  if (s.backfilledCount > 0) await savePracticeSessions(s.records);
  logSync("升级回填来源", { answers: a.backfilledCount, sessions: s.backfilledCount });
  logSync("升级回填修订号", { answers: a.backfilledCount, sessions: s.backfilledCount });
  return { answers: a.backfilledCount, sessions: s.backfilledCount };
}
