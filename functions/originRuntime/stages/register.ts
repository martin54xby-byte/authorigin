// Stage 8 — REGISTERED
// Pure function: scored unit → registered unit
// Finalises constitutional envelope fields. Does not persist — that's the orchestrator's job.

import { ScoredUnit } from "./trust.ts";

export interface RegisteredUnit extends ScoredUnit {
  stage: "REGISTERED";
  constitutional_status: string;
  access_tier: string;
  weight_class: string;
  state_since: string;
}

export function register(unit: ScoredUnit): RegisteredUnit {
  return {
    ...unit,
    stage: "REGISTERED",
    constitutional_status: "active",
    access_tier: "open",
    weight_class: unit.molecule_type === "constraint" ? "constitutional" : "operational",
    state_since: new Date().toISOString(),
  };
}
