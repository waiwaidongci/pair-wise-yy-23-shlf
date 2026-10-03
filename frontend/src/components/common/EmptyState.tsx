import type { ReactNode } from "react";

export function EmptyState({ title = "暂无数据", children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
    </div>
  );
}
