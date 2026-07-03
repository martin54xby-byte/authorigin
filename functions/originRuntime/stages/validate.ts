// Stage 6 — VALIDATED
// Pure function: linked unit → validated unit
// Structural admissibility checks only. Not epistemic verification (that's kCv_v, over time).

import { LinkedUnit } from "./link.ts";

export interface ValidatedUnit extends LinkedUnit {
  stage: "VALIDATED";
  evidence_gap_flag: boolean;
  validation_issues: string[];
}

export function validate(unit: LinkedUnit): ValidatedUnit {
  const issues: string[] = [];
  const wordCount = unit.normalised_text.split(/\s+/).length;

  if (wordCount < 15) issues.push("content_too_short");
  if (!unit.molecule_type) issues.push("unclassified");
  if (!unit.canonicalHash) issues.push("missing_canonical_hash");
  if (unit.parent_molecule_ids.length === 0) issues.push("no_lineage");

  return {
    ...unit,
    stage: "VALIDATED",
    evidence_gap_flag: issues.length > 0,
    validation_issues: issues,
  };
}
