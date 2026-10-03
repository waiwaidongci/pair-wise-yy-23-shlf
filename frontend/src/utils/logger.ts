import { LOG_TEMPLATES } from "../constants/logTemplates";

type Entity = keyof typeof LOG_TEMPLATES;
type Template<E extends Entity> = (typeof LOG_TEMPLATES)[E][number];

// 统一日志出口：所有写操作经此记录，模板集中在 constants/logTemplates
export function logWrite<E extends Entity>(entity: E, template: Template<E>, detail: Record<string, unknown> = {}): void {
  const line = `[${entity}] ${template}`;
  // eslint-disable-next-line no-console
  console.info(line, detail);
}

export function logSync(template: Template<"Sync">, detail: Record<string, unknown> = {}): void {
  logWrite("Sync", template, detail);
}
