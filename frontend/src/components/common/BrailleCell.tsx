// Six-dot braille cell: `pattern` is a string of raised dot numbers 1..6
// (dots numbered 1,2,3 left column top-down, 4,5,6 right column top-down).
export function BrailleCell({ pattern = "", size = 56, title }: { pattern?: string; size?: number; title?: string }) {
  const raised = new Set(String(pattern).split(/[^1-6]*/).filter(Boolean).map(Number));
  const dots = [1, 2, 3, 4, 5, 6];
  return (
    <span className="braille-cell" title={title} style={{ width: size * 0.72, height: size }} aria-label={`点阵 ${pattern}`}>
      {dots.map((dot) => (
        <span key={dot} className={raised.has(dot) ? "dot raised" : "dot"} data-dot={dot} />
      ))}
    </span>
  );
}
