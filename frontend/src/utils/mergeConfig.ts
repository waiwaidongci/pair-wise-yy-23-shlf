// Per-entity merge strategy configuration.
// BRANCH: identity-edited on two sources => keep both copies, raise conflict.
// UNION:  course progress is a CRDT; set-valued fields merge as unions and
//         monotonic timestamp fields take the latest value, never conflicting.
export type MergeStrategy = "BRANCH" | "UNION";

export interface UnionConfig {
  setFields: string[]; // merged via set union
  latestFields: string[]; // latest timestamp wins
}

export const MERGE_STRATEGY: Record<string, MergeStrategy> = {
  practiceSession: "BRANCH",
  answerRecord: "BRANCH",
  lessonProgress: "UNION"
};

export const UNION_CONFIG: Record<string, UnionConfig> = {
  lessonProgress: {
    setFields: ["completed_symbol_ids"],
    latestFields: ["last_practiced_at"]
  }
};
