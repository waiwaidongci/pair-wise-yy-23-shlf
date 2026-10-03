import { syncController } from "../controllers/syncController";
import type { SyncReport } from "../services/syncService";

// API surface consumed by stores/pages. Even though transport is local
// (IndexedDB hub), calls stay async like a real endpoint.
export async function pushOutbox(): Promise<SyncReport> {
  return syncController.pushOutbox();
}

export async function mergeHubIntoMain(): Promise<SyncReport> {
  return syncController.mergeHubIntoMain();
}
