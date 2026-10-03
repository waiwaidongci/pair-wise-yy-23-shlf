import { LocalDatabase } from "../db/database";
import { STORE } from "../db/stores";

// Raw persistence over one opened IndexedDB database. Contains NO business
// rules: batching, revision bumps and mastery recompute live in services.
export class Repository {
  constructor(private readonly db: LocalDatabase) {}

  transaction(
    stores: string[],
    mode: IDBTransactionMode,
    fn: (stores: IDBObjectStore[]) => void
  ): Promise<void> {
    return this.db.transaction(stores, mode, fn);
  }

  get practiceSessions() {
    return new EntityRepository(this.db, STORE.practiceSession);
  }
  get answerRecords() {
    return new EntityRepository(this.db, STORE.answerRecord);
  }
  get lessonProgress() {
    return new EntityRepository(this.db, STORE.lessonProgress);
  }
  get symbols() {
    return new EntityRepository(this.db, STORE.brailleSymbol);
  }
  get lessons() {
    return new EntityRepository(this.db, STORE.lesson);
  }
  get queue() {
    return new EntityRepository(this.db, STORE.syncQueue);
  }
  get appliedBatches() {
    return new EntityRepository(this.db, STORE.appliedBatch);
  }
  get conflicts() {
    return new EntityRepository(this.db, STORE.syncConflict);
  }
  get masterySnapshots() {
    return new EntityRepository(this.db, STORE.masterySnapshot);
  }
}

export class EntityRepository {
  constructor(
    private readonly db: LocalDatabase,
    private readonly store: string
  ) {}

  list<T>(): Promise<T[]> {
    return this.db.getAll<T>(this.store);
  }

  get<T>(key: IDBValidKey): Promise<T | undefined> {
    return this.db.get<T>(this.store, key);
  }

  put<T>(value: T): Promise<void> {
    return this.db.put(this.store, value).then(() => undefined);
  }

  putMany<T>(values: T[]): Promise<void> {
    return this.db.bulkPut(this.store, values);
  }

  remove(key: IDBValidKey): Promise<void> {
    return this.db.delete(this.store, key);
  }
}
