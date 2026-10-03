import { DB_NAME, DB_VERSION, STORE, LEGACY_STORE } from "./stores";
import { migrateLegacyTable } from "./migration";
import { mockData } from "../mocks/seedData";
import { computeMastery } from "../utils/mastery";
import type { SyncEntityName, Synced } from "../types/SyncMeta";

type AnyRow = Record<string, unknown>;

// Copy a legacy object store into a v2 store inside the SAME upgrade
// transaction. Uses request callback chaining (never await): waiting on a
// promise would let the versionchange transaction auto-commit halfway.
function migrateStore(
  src: IDBObjectStore,
  dst: IDBObjectStore,
  entity: SyncEntityName,
  done: (migrated: Array<Synced<AnyRow>>) => void
): void {
  const migrated: Array<Synced<AnyRow>> = [];
  const request = src.openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (cursor) {
      const [row] = migrateLegacyTable(entity, [cursor.value as AnyRow]);
      migrated.push(row);
      dst.put(row);
      cursor.continue();
    } else {
      done(migrated);
    }
  };
  request.onerror = () => done(migrated);
}

function createV2Stores(db: IDBDatabase): {
  sessions: IDBObjectStore;
  answers: IDBObjectStore;
  progress: IDBObjectStore;
} {
  const sessions = db.createObjectStore(STORE.practiceSession, { keyPath: "uuid" });
  sessions.createIndex("lineage_idx", "lineage_id");
  sessions.createIndex("lesson_idx", "lesson_id");

  const answers = db.createObjectStore(STORE.answerRecord, { keyPath: "uuid" });
  answers.createIndex("lineage_idx", "lineage_id");
  answers.createIndex("symbol_idx", "symbol_id");
  answers.createIndex("session_idx", "session_id");

  const progress = db.createObjectStore(STORE.lessonProgress, { keyPath: "uuid" });
  progress.createIndex("lineage_idx", "lineage_id");
  progress.createIndex("lesson_idx", "lesson_id");

  db.createObjectStore(STORE.syncQueue, { keyPath: "batch_id" }).createIndex("status_idx", "status");
  db.createObjectStore(STORE.appliedBatch, { keyPath: "batch_id" });

  const conflicts = db.createObjectStore(STORE.syncConflict, { keyPath: "id" });
  conflicts.createIndex("entity_idx", "entity");
  conflicts.createIndex("status_idx", "status");

  db.createObjectStore(STORE.device, { keyPath: "source" });
  db.createObjectStore(STORE.masterySnapshot, { keyPath: "symbol_id" });
  return { sessions, answers, progress };
}

function upgradeDatabase(db: IDBDatabase, oldVersion: number, tx: IDBTransaction): void {
  if (oldVersion < 1) {
    // Fresh device seeds the v1 schema first and then migrates it, so every
    // install exercises the 回填 path rather than only legacy devices.
    const symbols = db.createObjectStore(STORE.brailleSymbol, { keyPath: "id" });
    const lessons = db.createObjectStore(STORE.lesson, { keyPath: "id" });
    const legacySessions = db.createObjectStore(LEGACY_STORE.practiceSession, { keyPath: "id" });
    const legacyAnswers = db.createObjectStore(LEGACY_STORE.answerRecord, { keyPath: "id" });
    mockData.brailleSymbol.forEach((row) => symbols.add(row));
    mockData.lesson.forEach((row) => lessons.add(row));
    mockData.practiceSession.forEach((row) => legacySessions.add(row));
    mockData.answerRecord.forEach((row) => legacyAnswers.add(row));
  }

  if (oldVersion < 2) {
    const { sessions, answers } = createV2Stores(db);
    const snapshotStore = tx.objectStore(STORE.masterySnapshot);

    const migrateAnswers = () => {
      if (!db.objectStoreNames.contains(LEGACY_STORE.answerRecord)) return;
      const src = tx.objectStore(LEGACY_STORE.answerRecord);
      migrateStore(src, answers, "answerRecord", (migratedAnswers) => {
        // 学习进度按合并后的有效答题重算 — seed answers are valid (no conflict).
        const snapshots = computeMastery(migratedAnswers as AnyRow[], mockData.brailleSymbol);
        snapshots.forEach((snapshot) => snapshotStore.put(snapshot));
        db.deleteObjectStore(LEGACY_STORE.answerRecord);
      });
    };

    if (db.objectStoreNames.contains(LEGACY_STORE.practiceSession)) {
      const src = tx.objectStore(LEGACY_STORE.practiceSession);
      migrateStore(src, sessions, "practiceSession", () => {
        db.deleteObjectStore(LEGACY_STORE.practiceSession);
        migrateAnswers();
      });
    } else {
      migrateAnswers();
    }
  }
}

export function openDatabase(name: string = DB_NAME, version: number = DB_VERSION): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = (event) => {
      const tx = request.transaction;
      if (tx) upgradeDatabase(request.result, event.oldVersion, tx);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("open failed"));
    request.onblocked = () => reject(new Error("database upgrade blocked"));
  });
}

// Generic typed accessor bound to one opened database.
export class LocalDatabase {
  constructor(private readonly db: IDBDatabase) {}

  getAll<T>(store: string): Promise<T[]> {
    return this.request(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
  }

  getAllByIndex<T>(store: string, index: string, value: IDBValidKey | IDBKeyRange): Promise<T[]> {
    return this.request(store, "readonly", (s) => s.index(index).getAll(value) as IDBRequest<T[]>);
  }

  get<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
    return this.request(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
  }

  put<T>(store: string, value: T): Promise<IDBValidKey> {
    return this.request(store, "readwrite", (s) => s.put(value));
  }

  bulkPut<T>(store: string, values: T[]): Promise<void> {
    return this.transaction([store], "readwrite", (stores) => {
      values.forEach((value) => stores[0].put(value));
    });
  }

  delete(store: string, key: IDBValidKey): Promise<void> {
    return this.request(store, "readwrite", (s) => s.delete(key)).then(() => undefined);
  }

  clear(store: string): Promise<void> {
    return this.request(store, "readwrite", (s) => s.clear()).then(() => undefined);
  }

  transaction(
    stores: string[],
    mode: IDBTransactionMode,
    fn: (stores: IDBObjectStore[]) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(stores, mode);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      fn(stores.map((name) => tx.objectStore(name)));
    });
  }

  private request<T>(
    store: string,
    mode: IDBTransactionMode,
    make: (s: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, mode);
      const request = make(tx.objectStore(store));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
