// Sync metadata carried by every entity that participates in offline merging.
// `source`     device that produced this revision (来源)
// `revision`   per-source monotonic counter within a lineage (修订号)
// `uuid`       unique storage key of this physical row
// `lineage_id` logical identity shared by forked copies of the same record
export type SyncSource = string;

export interface SyncMeta {
  uuid: string;
  lineage_id: string;
  source: SyncSource;
  revision: number;
  updated_at: string;
  deleted: boolean;
}

// Legacy rows are backfilled during the v2 migration; optional here so that
// old constructor / form shapes stay assignable before migration runs.
export type Synced<T> = T & Partial<SyncMeta>;

export type SyncEntityName = "practiceSession" | "answerRecord" | "lessonProgress";
