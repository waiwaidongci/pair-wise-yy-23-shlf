import { HUB_DB_NAME, HUB_DB_VERSION, HUB_STORE } from "./stores";
import type { SyncBatch } from "../types/SyncBatch";

// Simulated "主设备" rendezvous point. A real deployment would replace this
// with a server endpoint; locally it is a second IndexedDB database so the
// volunteer -> 回场 -> merge flow is fully exercisable in one browser.
interface HubInboxEntry extends SyncBatch {
  received_at: string;
}

function openHub(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HUB_DB_NAME, HUB_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HUB_STORE.inbox)) db.createObjectStore(HUB_STORE.inbox, { keyPath: "batch_id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("hub open failed"));
  });
}

function requestHub<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openHub().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(HUB_STORE.inbox, mode);
        const request = run(tx.objectStore(HUB_STORE.inbox));
        request.onsuccess = () => {
          db.close();
          resolve(request.result);
        };
        request.onerror = () => {
          db.close();
          reject(request.error);
        };
      })
  );
}

export function pushBatchToHub(batch: SyncBatch): Promise<void> {
  const entry: HubInboxEntry = { ...batch, received_at: new Date().toISOString() };
  return requestHub("readwrite", (store) => store.put(entry) as IDBRequest<IDBValidKey>).then(() => undefined);
}

export function listHubBatches(): Promise<HubInboxEntry[]> {
  return requestHub("readonly", (store) => store.getAll() as IDBRequest<HubInboxEntry[]>);
}

export function clearHubBatches(): Promise<void> {
  return requestHub("readwrite", (store) => store.clear() as IDBRequest<undefined>).then(() => undefined);
}
