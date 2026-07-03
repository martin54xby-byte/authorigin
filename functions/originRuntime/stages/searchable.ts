// Stage 9 — SEARCHABLE  (terminal pipeline stage)
// Pure function: registered unit → final unit
// Sets current_state to the constitutional lifecycle's entry point (EXPLORED).
// current_state then belongs to JournalFact's from_state/to_state enum going forward —
// pipeline "stage" and constitutional "current_state" are deliberately different fields.

import { RegisteredUnit } from "./register.ts";

export interface FinalUnit extends RegisteredUnit {
  stage: "SEARCHABLE";
  current_state: "EXPLORED";
}

export function searchable(unit: RegisteredUnit): FinalUnit {
  return { ...unit, stage: "SEARCHABLE", current_state: "EXPLORED" };
}
