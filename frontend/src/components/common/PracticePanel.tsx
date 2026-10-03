import type { ReactNode } from "react";

export function PracticePanel({
  title,
  children,
  footer
}: {
  title?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="panel practice-panel">
      {title ? <h2>{title}</h2> : null}
      <div className="practice-body">{children}</div>
      {footer ? <div className="practice-footer">{footer}</div> : null}
    </section>
  );
}
