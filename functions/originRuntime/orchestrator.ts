// Origin Runtime Orchestrator
// Drives the 9-stage deterministic lifecycle. All I/O happens here, at the boundary —
// the stage functions themselves stay pure. This is the only file that knows about
// persistence; everything else is host-agnostic and could run in Node, WASM, anywhere.

import { received, RawInput } from "./stages/received.ts";
import { normalise } from "./stages/normalise.ts";
import { canonicalise } from "./stages/canonicalise.ts";
import { classify } from "./stages/classify.ts";
import { link } from "./stages/link.ts";
import { validate } from "./stages/validate.ts";
import { trust } from "./stages/trust.ts";
import { register } from "./stages/register.ts";
import { searchable } from "./stages/searchable.ts";
import { PersistencePort } from "./persistencePort.ts";

export interface RuntimeResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  molecule_id?: string;
  molecule_type?: string;
  lineage_type?: string;
  kCv_q?: number;
  stages_completed?: number;
  evidence_gap_flag?: boolean;
}

// Decomposition happens BEFORE the runtime — it produces the raw units that each
// individually enter the 9-stage pipeline. This keeps stage 1 (RECEIVED) a true
// one-unit-in pipeline, matching "Input Molecule → Output Molecule".

function isHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 120) return false;
  return /^(\d+\.?\d*\.?\s+\w|[A-Z][A-Z\s]{3,40}$)/.test(t) || /^#{1,4}\s/.test(t);
}

export function decompose(text: string, sourceName: string): string[] {
  const chunks: string[] = [];
  const lines = text.split("\n");
  let buf: string[] = [];
  const flush = () => {
    const c = buf.join(" ").replace(/\s+/g, " ").trim();
    if (c.split(/\s+/).length >= 25) chunks.push(c);
    buf = [];
  };
  for (const line of lines) {
    if (isHeading(line)) { flush(); }
    else if (line.trim() === "") { if (buf.join(" ").split(/\s+/).length >= 35) flush(); }
    else buf.push(line.trim());
  }
  flush();
  if (chunks.length < 2) {
    chunks.length = 0;
    for (const p of text.split(/\n\s*\n/)) {
      const c = p.replace(/\s+/g, " ").trim();
      if (c.split(/\s+/).length >= 25) chunks.push(c);
    }
  }
  return chunks;
}

// Runs ONE unit through the full 9-stage deterministic runtime.
export async function runOriginRuntime(raw: RawInput, port: PersistencePort): Promise<RuntimeResult> {
  let unit: any = received(raw);
  await port.recordStageObservation(unit, "RECEIVED");

  unit = normalise(unit);
  await port.recordStageObservation(unit, "NORMALISED");

  const hashIndex = await port.getHashIndex();
  unit = canonicalise(unit, { existingHashMap: hashIndex });
  await port.recordStageObservation(unit, "CANONICALISED");

  if (unit.is_duplicate) {
    return { success: true, skipped: true, reason: "duplicate_content", molecule_id: unit.molecule_id };
  }

  unit = classify(unit);
  await port.recordStageObservation(unit, "CLASSIFIED");

  const containerId = await port.ensureContainer(unit.source_name, unit.author_id, unit.author_domain_id, unit.hol_context);
  unit = link(unit, { containerId });
  await port.recordStageObservation(unit, "LINKED");

  unit = validate(unit);
  await port.recordStageObservation(unit, "VALIDATED");

  const corpusTexts = await port.getCorpusTexts();
  unit = trust(unit, { corpusTexts });
  await port.recordStageObservation(unit, "TRUST_SCORED");

  unit = register(unit);
  await port.recordStageObservation(unit, "REGISTERED");

  unit = searchable(unit);
  await port.recordStageObservation(unit, "SEARCHABLE");

  await port.persistMolecule(unit);

  // The ONE constitutional fact this pipeline produces: the molecule's birth.
  await port.recordConstitutionalFact({
    molecule_id: unit.molecule_id,
    canonicalHash: unit.canonicalHash,
    fact_type: "molecule_created",
    from_state: "CREATED",
    to_state: "EXPLORED",
    weight_class: unit.weight_class,
    evidence_hash: unit.canonicalHash,
    actor_id: unit.author_id,
    actor_domain_id: unit.author_domain_id,
  });

  return {
    success: true,
    molecule_id: unit.molecule_id,
    molecule_type: unit.molecule_type,
    lineage_type: unit.lineage_types[0],
    kCv_q: unit.kCv_rank,
    stages_completed: 9,
    evidence_gap_flag: unit.evidence_gap_flag,
  };
}

// Document-level entry point: decompose, then run each chunk through the runtime.
export async function ingestDocumentViaRuntime(payload: any, port: PersistencePort) {
  const chunks = decompose(payload.document_text, payload.source_name || "document");
  const results: RuntimeResult[] = [];
  for (const chunkText of chunks) {
    const result = await runOriginRuntime({
      document_text: chunkText,
      source_name: payload.source_name,
      author_id: payload.author_id,
      author_domain_id: payload.author_domain_id,
      hol_context: payload.hol_context,
    }, port);
    results.push(result);
  }
  const created = results.filter(r => !r.skipped);
  const byType: Record<string, number> = {};
  for (const r of created) if (r.molecule_type) byType[r.molecule_type] = (byType[r.molecule_type] || 0) + 1;

  return {
    success: true,
    source_name: payload.source_name,
    units_processed: chunks.length,
    molecules_created: created.length,
    molecules_skipped: results.length - created.length,
    molecules_by_type: byType,
    results,
  };
}
