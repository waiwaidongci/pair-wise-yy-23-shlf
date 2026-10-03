import { useMemo, useState } from "react";
import { useSyncStore } from "../stores/SyncStore";
import type { SyncedAnswerRecord } from "../types/AnswerRecord";

export type MistakeReasonFilter = "ALL" | "PENDING_CONFLICT" | string;

// 错题本 query: soft-deleted losers stay hidden from the notebook, but BOTH
// pending two-source copies remain visible until resolved.
export function useMistakes() {
  const answers = useSyncStore((state) => state.answers);
  const conflicts = useSyncStore((state) => state.conflicts);
  const [reason, setReason] = useState<MistakeReasonFilter>("ALL");

  const pendingLineages = useMemo(
    () => new Set(conflicts.filter((conflict) => conflict.status === "PENDING").map((conflict) => conflict.id)),
    [conflicts]
  );

  const rows = useMemo(() => {
    return answers
      .filter((answer) => !answer.deleted)
      .filter((answer) => !answer.correct || (answer.lineage_id ? pendingLineages.has(answer.lineage_id) : false))
      .filter((answer) => {
        if (reason === "ALL") return true;
        if (reason === "PENDING_CONFLICT") return Boolean(answer.lineage_id && pendingLineages.has(answer.lineage_id));
        return answer.mistake_reason === reason;
      })
      .slice()
      .sort((a, b) => (a.answered_at < b.answered_at ? 1 : -1));
  }, [answers, reason, pendingLineages]);

  const reasons = useMemo(() => Array.from(new Set(answers.filter((answer) => answer.mistake_reason).map((answer) => answer.mistake_reason))), [answers]);

  return { rows: rows as SyncedAnswerRecord[], reason, setReason, reasons, pendingLineages };
}
