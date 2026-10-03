import { LocalDatabase, openDatabase } from "../db/database";
import { DB_NAME } from "../db/stores";
import { Repository } from "./repository";
import { MergeService } from "./mergeService";
import { PracticeService } from "./practiceService";
import { SyncService } from "./syncService";
import { getDeviceSource, setDeviceSource, MAIN_SOURCE } from "../utils/syncMeta";
import type { SyncSource } from "../types/SyncMeta";

export interface AppContext {
  source: SyncSource;
  db: LocalDatabase;
  repository: Repository;
  mergeService: MergeService;
  practiceService: PracticeService;
  syncService: SyncService;
  dispose: () => void;
}

const cache = new Map<SyncSource, Promise<AppContext>>();

export async function openContext(source: SyncSource = MAIN_SOURCE): Promise<AppContext> {
  const cached = cache.get(source);
  // Repoint immediately (even before async DB setup resolves): revision
  // bumps and outbox writes read this module-global device source.
  setDeviceSource(source);
  if (cached) return cached;

  const created = (async (): Promise<AppContext> => {
    // Each volunteer device gets its own physical database, just like a real
    // laptop/tablet returning to the community center.
    const name = source === MAIN_SOURCE ? DB_NAME : `${DB_NAME}:${source}`;
    const idb = await openDatabase(name);
    const db = new LocalDatabase(idb);
    const repository = new Repository(db);
    const mergeService = new MergeService(repository);
    const practiceService = new PracticeService(repository, mergeService, source);
    const syncService = new SyncService(repository, mergeService, source);
    return {
      source,
      db,
      repository,
      mergeService,
      practiceService,
      syncService,
      dispose: () => {
        idb.close();
        cache.delete(source);
      }
    };
  })();

  cache.set(source, created);
  return created;
}

export function currentSource(): SyncSource {
  return getDeviceSource();
}

export async function closeAllContexts(): Promise<void> {
  for (const context of await Promise.all(cache.values())) context.dispose();
  cache.clear();
}
