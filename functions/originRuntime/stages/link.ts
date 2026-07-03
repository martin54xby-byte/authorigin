// Stage 5 — LINKED  (this is PVOR: relationship construction)
// Pure function given explicit context: typed unit + container id → linked unit
// Assigns typed lineage edges — not document position, semantic relationship.

import { ClassifiedUnit, MoleculeType } from "./classify.ts";

export type LineageType = "contains" | "supports" | "contradicts" | "derived_from" | "supersedes" | "constrains" | "references" | "exemplifies";

export interface LinkContext {
  containerId: string;
}

export interface LinkedUnit extends ClassifiedUnit {
  stage: "LINKED";
  parent_molecule_ids: string[];
  lineage_types: LineageType[];
}

function inferLineageType(moleculeType: MoleculeType): LineageType {
  if (moleculeType === "constraint") return "constrains";
  if (moleculeType === "method") return "supports";
  if (moleculeType === "observation") return "supports";
  if (moleculeType === "definition") return "references";
  return "contains";
}

export function link(unit: ClassifiedUnit, ctx: LinkContext): LinkedUnit {
  const lineage_type = inferLineageType(unit.molecule_type);
  return {
    ...unit,
    stage: "LINKED",
    parent_molecule_ids: [ctx.containerId],
    lineage_types: [lineage_type],
  };
}
