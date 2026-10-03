import { useEffect, useMemo, useState } from "react";
import { useLessonStore } from "../stores/LessonStore";
import { useBrailleSymbolStore } from "../stores/BrailleSymbolStore";
import { savePracticeSession } from "../api/PracticeSession";
import { saveAnswerRecords } from "../api/AnswerRecord";
import { getDeviceId } from "../utils/device";
import { recordKey } from "../utils/merge";
import { createDefaultPracticeSession } from "../constructors/PracticeSessionConstructor";
import { createDefaultAnswerRecord } from "../constructors/AnswerRecordConstructor";
import { BrailleCell } from "../components/common/BrailleCell";
import { PracticePanel } from "../components/common/PracticePanel";
import { ResultBadge } from "../components/common/ResultBadge";
import { StatusBadge } from "../components/common/StatusBadge";
import { SyncStatusBadge } from "../components/common/SyncStatusBadge";
import { logWrite } from "../utils/logger";

type Phase = "select" | "playing" | "done";

export function PracticePage() {
  const { rows: lessons, load: loadLessons } = useLessonStore();
  const { rows: symbols, load: loadSymbols } = useBrailleSymbolStore();
  const [phase, setPhase] = useState<Phase>("select");
  const [lessonId, setLessonId] = useState<number>(0);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<{ symbol_id: number; correct: boolean; user_answer: string; latency: number }[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadLessons();
    loadSymbols();
  }, [loadLessons, loadSymbols]);

  const lesson = useMemo(() => lessons.find((l) => l.id === lessonId), [lessons, lessonId]);
  const quizSymbols = useMemo(() => {
    if (!lesson) return [];
    return lesson.symbol_ids
      .map((id) => symbols.find((s) => s.id === id))
      .filter((s): s is (typeof symbols)[number] => s !== undefined);
  }, [lesson, symbols]);
  const current = quizSymbols[idx];

  const start = (id: number) => {
    setLessonId(id);
    setIdx(0);
    setAnswers([]);
    setSaved(false);
    setPhase("playing");
  };

  const answer = (letter: string) => {
    if (!current) return;
    const correct = letter === current.letter;
    const next = [...answers, { symbol_id: current.id, correct, user_answer: letter, latency: 1000 + Math.floor(Math.random() * 1500) }];
    setAnswers(next);
    if (idx + 1 < quizSymbols.length) {
      setIdx(idx + 1);
    } else {
      finish(next);
    }
  };

  const finish = async (finalAnswers: typeof answers) => {
    setPhase("done");
    const deviceId = await getDeviceId();
    const correctCount = finalAnswers.filter((a) => a.correct).length;
    const score = Math.round((correctCount / finalAnswers.length) * 100);
    const sessionId = Date.now();
    const session = createDefaultPracticeSession({
      id: sessionId,
      recordKey: recordKey(sessionId, deviceId),
      lesson_id: lessonId,
      mode: "CELL_TO_TEXT",
      started_at: new Date(Date.now() - finalAnswers.length * 5000).toISOString(),
      finished_at: new Date().toISOString(),
      score,
      mistake_count: finalAnswers.length - correctCount,
      source: deviceId,
      revision: 1,
      sync_status: "local"
    });
    const records = finalAnswers.map((a, i) =>
      createDefaultAnswerRecord({
        id: sessionId * 100 + i,
        recordKey: recordKey(sessionId * 100 + i, deviceId),
        session_id: sessionId,
        symbol_id: a.symbol_id,
        user_answer: a.user_answer,
        correct: a.correct ? "true" : "false",
        latency_ms: String(a.latency),
        mistake_reason: a.correct ? "" : "CELL_ORDER",
        source: deviceId,
        revision: 1,
        sync_status: "local"
      })
    );
    await savePracticeSession(session);
    await saveAnswerRecords(records);
    logWrite("PracticeSession", "练习会话创建", { sessionId, score });
    logWrite("AnswerRecord", "答题记录创建", { count: records.length });
    setSaved(true);
  };

  if (phase === "select") {
    return (
      <main className="page">
        <section className="page-head">
          <div>
            <p className="eyebrow">braille-trainer</p>
            <h1>练习模式</h1>
          </div>
          <StatusBadge value="PRACTICE" />
        </section>
        <section className="panel">
          <h2>选择课程开始练习（进度先存本机，联网后可同步）</h2>
          <div className="lesson-list">
            {lessons.map((l) => (
              <article key={l.id} className="row lesson-row">
                <strong>{l.title}</strong>
                <span>{l.symbol_ids.length} 个字符 · 约 {l.estimated_minutes} 分钟</span>
                <button onClick={() => start(l.id)}>开始练习</button>
              </article>
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (phase === "done") {
    const correctCount = answers.filter((a) => a.correct).length;
    const score = Math.round((correctCount / answers.length) * 100);
    return (
      <main className="page">
        <section className="page-head">
          <div>
            <p className="eyebrow">braille-trainer</p>
            <h1>练习结果</h1>
          </div>
          <ResultBadge title="得分" value={String(score)} />
        </section>
        <section className="panel">
          <PracticePanel title="本次成绩" value={`${correctCount}/${answers.length}`} />
          <p>{saved ? "练习会话与答题记录已存本机（sync_status=local），可到同步中心推送。" : "保存中…"}</p>
          <SyncStatusBadge status="local" />
          <div className="sync-actions">
            <button onClick={() => setPhase("select")}>再来一组</button>
          </div>
        </section>
      </main>
    );
  }

  const options = quizSymbols.map((s) => s.letter).sort(() => Math.random() - 0.5);
  return (
    <main className="page">
      <section className="page-head">
        <div>
          <p className="eyebrow">braille-trainer</p>
          <h1>练习中 {idx + 1}/{quizSymbols.length}</h1>
        </div>
        <StatusBadge value="CELL_TO_TEXT" />
      </section>
      <section className="panel practice-quiz">
        <h2>这是哪个字符？</h2>
        {current ? <BrailleCell title="点阵" value={current.cell_pattern} /> : null}
        <div className="option-grid">
          {options.map((letter) => (
            <button key={letter} className="option-btn" onClick={() => answer(letter)}>{letter}</button>
          ))}
        </div>
      </section>
    </main>
  );
}
