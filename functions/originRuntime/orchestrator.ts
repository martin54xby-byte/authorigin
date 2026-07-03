// Origin Runtime Orchestrator — v2
// Adds Runtime Context (execution metadata spanning the whole run) and Runtime Events
// (pre-identity stage telemetry — deliberately no molecule_id, because none exists yet).
// Identity is created at CANONICALISED. Everything from there on is a Molecule Event.

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
import { createHash } from "node:crypto";

function sha256(s: string): string { return createHash("sha256").update(s).digest("hex"); }
function gid(...p: any[]): string { return sha256(JSON.stringify(p) + Date.now() + Math.random()).substring(0, 24); }
function now(): string { return new Date().toISOString(); }

const PIPELINE_VERSION = "1.0.0";
const CANONICALISATION_VERSION = "1.0.0";
const TRUST_VERSION = "1.0.0";

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
  runtime_id: string;
}

function isHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 120) return false;
  return /^(\d+\.?\d*\.?\s+\w|[A-Z][A-Z\s]{3,40}$)/.test(t) || /^#{1,4}\s/.test(t);
}

export function decompose(text: string): string[] {
  const chunks: string[] = [];
  const lines = text.split("\n");
  let buf: string[] = [];
  const flush = () => {
    const c = buf.join(" ").replace(/\s+/g, " ").trim();
    if (c.split(/\s+/).length >= 25) chunks.push(c);
    buf = [];
  };
  for (const line of lines) {
    if (isHeading(line)) flush();
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

// Runs ONE unit through the full 9-stage deterministic runtime, with its own
// Runtime Context. Pre-identity stages (RECEIVED, NORMALISED) log Runtime Events.
// Post-identity stages (CANONICALISED onward) log Molecule Events.
export async function runOriginRuntime(
  raw: RawInput,
  port: PersistencePort,
  batch_id: string,
  session_id: string
): Promise<RuntimeResult> {
  const runtime_id = gid("runtime", raw.source_name, now());
  const started = now();

  await port.createRuntimeContext({
    runtime_id, session_id, user_id: raw.author_id || "unknown", batch_id,
    parent_runtime: "", pipeline_version: PIPELINE_VERSION,
    canonicalisation_version: CANONICALISATION_VERSION, trust_version: TRUST_VERSION,
    started, finished: "", status: "running", source_name: raw.source_name || "document",
    resulting_molecule_id: "",
  });

  let unit: any = received(raw);
  await port.recordRuntimeEvent(runtime_id, session_id, "received", sha256(unit.raw_text), "normalised");

  unit = normalise(unit);
  await port.recordRuntimeEvent(runtime_id, session_id, "normalised", sha256(unit.normalised_text), "canonicalised");

  const hashIndex = await port.getHashIndex();
  unit = canonicalise(unit, { existingHashMap: hashIndex });
  unit.runtime_id = runtime_id;

  if (unit.is_duplicate) {
    await port.updateRuntimeContext(runtime_id, { status: "skipped_duplicate", finished: now(), resulting_molecule_id: unit.molecule_id });
    return { success: true, skipped: true, reason: "duplicate_content", molecule_id: unit.molecule_id, runtime_id };
  }

  // Identity now exists. From here on, every stage is a Molecule Event.
  await port.recordMoleculeEvent(unit, "canonicalised");

  unit = classify(unit);
  await port.recordMoleculeEvent(unit, "classified");

  const containerId = await port.ensureContainer(unit.source_name, unit.author_id, unit.author_domain_id, unit.hol_context);
  unit = link(unit, { containerId });
  await port.recordMoleculeEvent(unit, "linked");

  unit = validate(unit);
  await port.recordMoleculeEvent(unit, "validated");

  const corpusTexts = await port.getCorpusTexts();
  unit = trust(unit, { corpusTexts });
  await port.recordMoleculeEvent(unit, "trust_scored");

  unit = register(unit);
  await port.recordMoleculeEvent(unit, "registered");

  unit = searchable(unit);
  await port.recordMoleculeEvent(unit, "searchable");

  await port.persistMolecule(unit);

  await port.recordConstitutionalFact({
    molecule_id: unit.molecule_id, canonicalHash: unit.canonicalHash,
    fact_type: "molecule_created", from_state: "CREATED", to_state: "EXPLORED",
    weight_class: unit.weight_class, evidence_hash: unit.canonicalHash,
    actor_id: unit.author_id, actor_domain_id: unit.author_domain_id, runtime_id,
  });

  await port.updateRuntimeContext(runtime_id, { status: "completed", finished: now(), resulting_molecule_id: unit.molecule_id });

  return {
    success: true, molecule_id: unit.molecule_id, molecule_type: unit.molecule_type,
    lineage_type: unit.lineage_types[0], kCv_q: unit.kCv_rank, stages_completed: 9,
    evidence_gap_flag: unit.evidence_gap_flag, runtime_id,
  };
}

// Document-level entry: decompose, then run each chunk as its own runtime,
// all sharing one batch_id.
export async function ingestDocumentViaRuntime(payload: any, port: PersistencePort) {
  const batch_id = gid("batch", payload.source_name, now());
  const session_id = payload.session_id || batch_id;
  const chunks = decompose(payload.document_text);
  const results: RuntimeResult[] = [];

  for (const chunkText of chunks) {
    const result = await runOriginRuntime({
      document_text: chunkText, source_name: payload.source_name, author_id: payload.author_id,
      author_domain_id: payload.author_domain_id, hol_context: payload.hol_context,
    }, port, batch_id, session_id);
    results.push(result);
  }

  const created = results.filter(r => !r.skipped);
  const byType: Record<string, number> = {};
  for (const r of created) if (r.molecule_type) byType[r.molecule_type] = (byType[r.molecule_type] || 0) + 1;

  return {
    success: true, source_name: payload.source_name, batch_id, units_processed: chunks.length,
    molecules_created: created.length, molecules_skipped: results.length - created.length,
    molecules_by_type: byType, results,
  };
}
