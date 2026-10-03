// RFC4122-ish v4 id. Crypto is available in every modern browser and in
// jsdom/Node test environments; the Math.random fallback only covers ancient webviews.
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Numeric ids remain for the legacy seed schema; they are never used as
// merge keys (numeric ids collide across devices).
export function nextNumericId<T extends { id?: number | string }>(existing: T[]): number {
  return existing.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1;
}
