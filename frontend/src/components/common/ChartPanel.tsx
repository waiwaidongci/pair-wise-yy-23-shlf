import type { ReactNode } from "react";

// Simple labeled bar list used by the progress page (keeps ECharts out of the
// offline-critical merge path).
export interface ChartPoint {
  label: string;
  value: number;
  hint?: string;
}

export function ChartPanel({ title, points, max }: { title: string; points: ChartPoint[]; max?: number }) {
  const top = max ?? Math.max(1, ...points.map((point) => point.value));
  return (
    <section className="panel chart-panel">
      <h2>{title}</h2>
      <div className="chart-bars">
        {points.map((point) => (
          <div className="chart-row" key={point.label}>
            <span className="chart-label">{point.label}</span>
            <span className="chart-track">
              <span className="chart-fill" style={{ width: `${(point.value / top) * 100}%` }} />
            </span>
            <span className="chart-value">{point.hint ?? point.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ChartFallback({ children }: { children: ReactNode }) {
  return <section className="panel chart-panel">{children}</section>;
}
