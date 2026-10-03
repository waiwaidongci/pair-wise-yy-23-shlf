// Deterministic content key of a business payload, excluding sync metadata.
// Two rows delivered with the same lineage uuid AND same payload are the same
// edit (idempotent merge); differing payloads are a real two-source conflict.
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !META_KEY_SET.has(key))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(",")}}`;
}

const META_KEY_SET = new Set(["uuid", "lineage_id", "source", "revision", "updated_at", "deleted", "legacy_ref"]);

export function sameBusinessPayload(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return stableStringify(a) === stableStringify(b);
}
