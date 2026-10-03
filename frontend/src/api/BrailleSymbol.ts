import { listBrailleSymbol } from "./init";
import type { BrailleSymbol } from "../types/BrailleSymbol";

export { listBrailleSymbol };

export async function saveBrailleSymbol(payload: BrailleSymbol): Promise<BrailleSymbol> {
  console.info("save BrailleSymbol", payload);
  return payload;
}
