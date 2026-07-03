// Stage 4 — CLASSIFIED
// Pure function: canonical unit → typed unit
// Determines constitutional molecule_type from lexical signals.
// This is epistemic differentiation — the core of FPA.

import { CanonicalUnit } from "./canonicalise.ts";

export type MoleculeType = "claim" | "method" | "constraint" | "observation" | "definition";

export interface ClassifiedUnit extends CanonicalUnit {
  stage: "CLASSIFIED";
  molecule_type: MoleculeType;
}

export function classify(unit: CanonicalUnit): ClassifiedUnit {
  const t = unit.normalised_text.toLowerCase();

  const constraintScore =
    (t.match(/\b(must not exceed|shall not|minimum|maximum|limit|threshold|not less than|not more than|required to|comply|compliance|regulation|standard|code)\b/g) || []).length * 2 +
    (t.match(/\b(bs |cibse|ashrae|part l|part f|tm\d+|bsen|iso \d+)\b/gi) || []).length * 3 +
    (t.match(/\d+(\.\d+)?\s*(pa\/m|w\/l\/s|m\/s|kpa|bar|°c|%)\b/g) || []).length * 2;

  const methodScore =
    (t.match(/\b(calculated|using|equation|formula|method|procedure|determined|derived|compute|apply|step|process|algorithm)\b/g) || []).length * 2 +
    (t.match(/\b(darcy|moody|reynolds|bernoulli|nusselt|colebrook|dittus)\b/g) || []).length * 3;

  const claimScore =
    (t.match(/\b(therefore|typically|generally|recommend|suggest|should|evidence shows|results in|causes|prevents|improves|reduces|increases)\b/g) || []).length * 2 +
    (t.match(/\b(can reduce|up to|between \d+ and \d+|accounts for|represent)\b/g) || []).length * 2;

  const observationScore =
    (t.match(/\b(measured|observed|found|recorded|tested|demonstrated|confirmed|showed|indicated|reported)\b/g) || []).length * 2;

  const definitionScore =
    (t.match(/\b(defined as|refers to|is the|are the|means|known as|term|concept)\b/g) || []).length * 2;

  const scores: Record<MoleculeType, number> = {
    constraint: constraintScore,
    method: methodScore,
    claim: claimScore,
    observation: observationScore,
    definition: definitionScore,
  };

  const top = (Object.entries(scores) as [MoleculeType, number][]).sort((a, b) => b[1] - a[1])[0];
  const molecule_type: MoleculeType = top[1] < 2 ? "claim" : top[0];

  return { ...unit, stage: "CLASSIFIED", molecule_type };
}
