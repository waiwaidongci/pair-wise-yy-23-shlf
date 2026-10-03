import { useMemo, useState } from "react";
import { useSyncStore } from "../stores/SyncStore";
import { startSession, recordAnswer, finishSession } from "../api/Practice";
import { BrailleCell } from "../components/common/BrailleCell";
import { PracticePanel } from "../components/common/PracticePanel";
import { ResultBadge } from "../components/common/ResultBadge";
import { EmptyState } from "../components/common/EmptyState";
import { isMainSource } from "../utils/syncMeta";
import { isOnline } from "../utils/connectivity";
import type { SyncedPracticeSession } from "../types/PracticeSession";

export function PracticePage() {
  const { lessons, symbols, source, refresh, setMessage } = useSyncStore();
  const [lessonId, setLessonId] = useState<number>(lessons[0]?.id ?? 1);
  const [session, setSession] = useState<SyncedPracticeSession | null>(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Array<{ symbol_id: number; correct: boolean }>>([]);
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);

  const lesson = lessons.find((item) => item.id === lessonId) ?? lessons[0];
  const queue = useMemo(
    () => symbols.filter((symbol) => lesson?.symbol_ids.includes(symbol.id)),
    [symbols, lesson]
  );
  const current = queue[index];

  const begin = async () => {
    const created = await startSession(lesson?.id ?? 1, "CELL_TO_TEXT");
    setSession(created as SyncedPracticeSession);
    setIndex(0);
    setResults([]);
    setFeedback(null);
    setStartedAt(Date.now());
    await refresh();
  };

  const submit = async (correct: boolean) => {
    if (!session || !current) return;
    await recordAnswer({
      sessionUuid: session.uuid ?? "",
      lesson_id: lesson?.id ?? 1,
      symbol_id: current.id,
      user_answer: correct ? current.letter : "",
      correct,
      latency_ms: Date.now() - startedAt,
      mistake_reason: correct ? "" : "DOT_CONFUSED"
    });
    setResults((list) => [...list, { symbol_id: current.id, correct }]);
    setFeedback(correct);
  };

  const next = async () => {
    setFeedback(null);
    setStartedAt(Date.now());
    if (index + 1 >= queue.length && session) {
      const score = Math.round((results.filter((item) => item.correct).length / Math.max(1, queue.length)) * 100);
      await finishSession(session.uuid ?? "", score, results.filter((item) => !item.correct).length);
      await refresh();
      setMessage(isMainSource(source) ? "练习已写入主设备" : isOnline() ? "练习已存入本机并排队同步" : "断网中：练习已存入本机，恢复网络后重试");
      setSession(null);
      return;
    }
    setIndex((value) => value + 1);
  };

  if (!lesson) return <main className="page"><EmptyState title="暂无课程" /></main>;

  return (
    <main className="page">
      <section className="page-head">
        <div>
          <p className="eyebrow">practice</p>
          <h1>练习模式</h1>
        </div>
        <label className="toolbar">
          课程：
          <select value={lessonId} onChange={(event) => setLessonId(Number(event.target.value))} disabled={Boolean(session)}>
            {lessons.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      </section>

      <PracticePanel title={session ? `进行中 · ${lesson.title}（${index + 1}/${queue.length}）` : "开始点阵识别练习"} footer={
        !session ? (
          <button className="btn primary" onClick={begin}>开始练习</button>
        ) : feedback === null ? (
          <div className="toolbar">
            <button className="btn" onClick={() => void submit(false)}>不认识 / 答错</button>
            <button className="btn primary" onClick={() => void submit(true)}>认得，写对</button>
          </div>
        ) : (
          <button className="btn primary" onClick={() => void next()}>{index + 1 >= queue.length ? "结束并保存" : "下一题"}</button>
        )
      }>
        {session && current ? (
          <div className="practice-question">
            <BrailleCell pattern={current.cell_pattern} size={120} />
            <div>
              <p className="muted">请识别这个点字</p>
              {feedback !== null ? <ResultBadge correct={feedback} /> : <p>作答后即时反馈</p>}
            </div>
          </div>
        ) : (
          <p className="muted">
            当前设备：{isMainSource(source) ? "主设备（直接合并）" : "志愿者设备（断网先存本机，回场后上传）"}。一次会话的会话头、答题记录、课程进度会作为同一批合并。
          </p>
        )}
      </PracticePanel>
    </main>
  );
}
