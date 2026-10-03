// Course progress bar for one lesson: completed symbols / total symbols.
export function LessonProgress({
  title,
  completed = 0,
  total = 0
}: {
  title?: string;
  completed?: number;
  total?: number;
}) {
  const ratio = total === 0 ? 0 : completed / total;
  return (
    <div className="lesson-progress">
      {title ? <strong>{title}</strong> : null}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      <span className="progress-label">
        {completed}/{total}（{Math.round(ratio * 100)}%）
      </span>
    </div>
  );
}
