// Stage 2 — NORMALISED
// Pure function: draft unit → normalised text unit
// Whitespace collapse, trim. No semantic interpretation yet.

import { DraftUnit } from "./received.ts";

export interface NormalisedUnit extends DraftUnit {
  stage: "NORMALISED";
  normalised_text: string;
}

export function normalise(unit: DraftUnit): NormalisedUnit {
  const cleaned = unit.raw_text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  return { ...unit, stage: "NORMALISED", normalised_text: cleaned };
}
