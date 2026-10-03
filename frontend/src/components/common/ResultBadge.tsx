export function ResultBadge({ correct, label }: { correct: boolean; label?: string }) {
  return (
    <span className={correct ? "badge result-correct" : "badge result-wrong"}>
      {label ?? (correct ? "答对" : "答错")}
    </span>
  );
}
