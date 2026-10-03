// IndexedDB 轻量封装：为离线练习、本机批次与冲突保留提供持久化能力。
// 数据存 IndexedDB；若环境不可用则回退到 localStorage，保证断网可写、恢复可传。

const DB_NAME = "braille-trainer-db";
const DB_VERSION = 2;

export const STORES = {
  ANSWER_RECORDS: "answerRecords",
  PRACTICE_SESSIONS: "practiceSessions",
  LESSONS: "lessons",
  SYNC_BATCHES: "syncBatches",
  CONFLICTS: "conflicts",
  PROCESSED_BATCHES: "processedBatches",
  META: "meta"
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase> | null = null;
let memoryFallback: Map<string, Map<string, unknown>> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const ensure = (name: string, keyPath: string) => {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath });
          if (name === STORES.ANSWER_RECORDS) {
            store.createIndex("by_id", "id", { unique: false });
            store.createIndex("by_source", "source", { unique: false });
          }
          if (name === STORES.PRACTICE_SESSIONS) {
            store.createIndex("by_id", "id", { unique: false });
            store.createIndex("by_source", "source", { unique: false });
          }
        }
      };
      ensure(STORES.ANSWER_RECORDS, "recordKey");
      ensure(STORES.PRACTICE_SESSIONS, "recordKey");
      ensure(STORES.LESSONS, "id");
      ensure(STORES.SYNC_BATCHES, "id");
      ensure(STORES.CONFLICTS, "id");
      ensure(STORES.PROCESSED_BATCHES, "batchId");
      ensure(STORES.META, "key");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
  return dbPromise;
}

function fallbackStore(store: string): Map<string, unknown> {
  if (!memoryFallback) memoryFallback = new Map();
  let s = memoryFallback.get(store);
  if (!s) {
    s = new Map();
    memoryFallback.set(store, s);
  }
  return s;
}

function keyOf(value: unknown, keyPath: string): string {
  const v = value as Record<string, unknown>;
  return String(v[keyPath]);
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  try {
    const db = await openDB();
    return await new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return Array.from(fallbackStore(store).values()) as T[];
  }
}

export async function get<T>(store: StoreName, key: string): Promise<T | undefined> {
  try {
    const db = await openDB();
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return fallbackStore(store).get(key) as T | undefined;
  }
}

export async function put<T extends Record<string, unknown>>(store: StoreName, value: T, keyPath: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    fallbackStore(store).set(keyOf(value, keyPath), value);
  }
}

export async function putAll<T extends Record<string, unknown>>(store: StoreName, values: T[], keyPath: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      const os = tx.objectStore(store);
      values.forEach((v) => os.put(v));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const s = fallbackStore(store);
    values.forEach((v) => s.set(keyOf(v, keyPath), v));
  }
}

export async function remove(store: StoreName, key: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    fallbackStore(store).delete(key);
  }
}

export async function clear(store: StoreName): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    fallbackStore(store).clear();
  }
}
