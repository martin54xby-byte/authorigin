// Stage 3 — CANONICALISED  (this is the CST: Canonical Structure Tree anchor)
// Pure function given explicit context: normalised unit + known-hash index → canonical unit
// Produces the stable identity anchor (canonicalHash) used for hashing, comparison, dedup.
// Context is passed in as plain data by the orchestrator — no live DB handle here.

import { NormalisedUnit } from "./normalise.ts";
import { createHash } from "node:crypto";

export interface CanonicaliseContext {
  existingHashMap: Record<string, { molecule_id: string }>;
}

export interface CanonicalUnit extends NormalisedUnit {
  stage: "CANONICALISED";
  canonicalHash: string;
  molecule_id: string;
  is_duplicate: boolean;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function canonicalise(unit: NormalisedUnit, ctx: CanonicaliseContext): CanonicalUnit {
  const hash = sha256(unit.normalised_text);
  const existing = ctx.existingHashMap[hash];
  const molecule_id = existing ? existing.molecule_id : "mol-" + hash.substring(0, 16);
  return {
    ...unit,
    stage: "CANONICALISED",
    canonicalHash: hash,
    molecule_id,
    is_duplicate: !!existing,
  };
}
