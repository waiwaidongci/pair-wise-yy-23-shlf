import { LOG_TEMPLATES } from "../constants/logTemplates";

// Single structured-log sink. All write paths call logEvent so field/entity
// renames force an update of logTemplates as well (per project convention).
export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  at: string;
  level: LogLevel;
  entity: keyof typeof LOG_TEMPLATES | string;
  action: string;
  detail?: Record<string, unknown>;
}

const MAX_BUFFER = 500;
const buffer: LogEntry[] = [];

export function logEvent(
  entity: keyof typeof LOG_TEMPLATES | string,
  action: string,
  detail?: Record<string, unknown>,
  level: LogLevel = "info"
): LogEntry {
  const entry: LogEntry = { at: new Date().toISOString(), level, entity, action, detail };
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  const line = `[${entry.at}] ${level.toUpperCase()} ${entity}.${action}`;
  if (level === "error") console.error(line, detail ?? "");
  else if (level === "warn") console.warn(line, detail ?? "");
  else console.info(line, detail ?? "");
  return entry;
}

export function getLogBuffer(): readonly LogEntry[] {
  return buffer;
}
