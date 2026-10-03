import type { BrailleSymbol } from "../types/BrailleSymbol";
import { openContext } from "../services/appContext";

const endpoint = "/api/braille-symbol";

export async function listBrailleSymbol(): Promise<BrailleSymbol[]> {
  if (typeof fetch !== "undefined" && endpoint.startsWith("/api") && false) {
    try {
      const res = await fetch(endpoint);
      if (res.ok) return await res.json();
    } catch {
      // Local IndexedDB fallback keeps the UI available during offline review.
    }
  }
  const context = await openContext();
  return context.repository.symbols.list<BrailleSymbol>();
}

export async function saveBrailleSymbol(payload: BrailleSymbol): Promise<BrailleSymbol> {
  const context = await openContext();
  await context.repository.symbols.put(payload);
  return payload;
}
