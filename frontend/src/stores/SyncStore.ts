import { create } from "zustand";
import type { AppContext } from "../services/appContext";
import { openContext } from "../services/appContext";
import { MAIN_SOURCE } from "../utils/syncMeta";
import { pendingConflictLineageIds } from "../utils/conflictResolution";
import type { BrailleSymbol } from "../types/BrailleSymbol";
import type { Lesson } from "../types/Lesson";
import type { SyncedPracticeSession } from "../types/PracticeSession";
import type { SyncedAnswerRecord } from "../types/AnswerRecord";
import type { LessonProgressRow } from "../types/LessonProgress";
import type { MasterySnapshot } from "../utils/mastery";
import type { SyncConflict } from "../types/SyncConflict";
import type { SyncQueueEntry } from "../types/SyncBatch";
import type { SyncSource } from "../types/SyncMeta";

export interface SyncState {
  source: SyncSource;
  context: AppContext | null;
  ready: boolean;
  online: boolean;
  symbols: BrailleSymbol[];
  lessons: Lesson[];
  sessions: SyncedPracticeSession[];
  answers: SyncedAnswerRecord[];
  progress: LessonProgressRow[];
  mastery: MasterySnapshot[];
  conflicts: SyncConflict[];
  queue: SyncQueueEntry[];
  lastMessage: string;
  switchSource: (source: SyncSource) => Promise<void>;
  refresh: () => Promise<void>;
  setOnline: (online: boolean) => void;
  setMessage: (message: string) => void;
}

async function loadRows(context: AppContext) {
  const [symbols, lessons, sessions, answers, progress, mastery, conflicts, queue] = await Promise.all([
    context.repository.symbols.list<BrailleSymbol>(),
    context.repository.lessons.list<Lesson>(),
    context.repository.practiceSessions.list<SyncedPracticeSession>(),
    context.repository.answerRecords.list<SyncedAnswerRecord>(),
    context.repository.lessonProgress.list<LessonProgressRow>(),
    context.repository.masterySnapshots.list<MasterySnapshot>(),
    context.repository.conflicts.list<SyncConflict>(),
    context.syncService.listOutbox()
  ]);
  return { symbols, lessons, sessions, answers, progress, mastery, conflicts, queue };
}

export const useSyncStore = create<SyncState>((set, get) => ({
  source: MAIN_SOURCE,
  context: null,
  ready: false,
  online: typeof navigator === "undefined" ? true : navigator.onLine !== false,
  symbols: [],
  lessons: [],
  sessions: [],
  answers: [],
  progress: [],
  mastery: [],
  conflicts: [],
  queue: [],
  lastMessage: "",

  async switchSource(source) {
    const previous = get().context;
    if (previous && previous.source === source) return;
    set({ ready: false });
    const context = await openContext(source);
    set({ source, context, ...(await loadRows(context)), ready: true });
  },

  async refresh() {
    const context = get().context;
    if (!context) return;
    set({ ...(await loadRows(context)) });
  },

  setOnline(online) {
    set({ online });
  },

  setMessage(lastMessage) {
    set({ lastMessage });
  }
}));

// Convenience selectors ------------------------------------------------------

export function selectPendingConflicts(state: SyncState): SyncConflict[] {
  return state.conflicts.filter((conflict) => conflict.status === "PENDING");
}

export function selectPendingLineageIds(state: SyncState): Set<string> {
  return pendingConflictLineageIds(state.conflicts);
}

// 冲突没有处理前不能计入掌握等级: answers belonging to a pending lineage.
export function selectExcludedAnswers(state: SyncState): SyncedAnswerRecord[] {
  const pending = selectPendingLineageIds(state);
  return state.answers.filter((answer) => answer.lineage_id && pending.has(answer.lineage_id));
}

export function selectVisibleAnswers(state: SyncState): SyncedAnswerRecord[] {
  // 错题本和历史仍要能查: include pending-conflict copies; only soft-deleted
  // losers of RESOLVED conflicts are hidden from history lists.
  return state.answers.filter((answer) => !answer.deleted);
}

export function selectOutboxOpen(state: SyncState): SyncQueueEntry[] {
  return state.queue.filter((entry) => entry.status !== "SYNCED");
}
