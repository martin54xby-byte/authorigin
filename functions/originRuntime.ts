// Origin Runtime — deployable bundle of functions/originRuntime/{stages,persistencePort,orchestrator}.ts
// Source of truth for the modular architecture lives in that folder in the repo.
// This file is the compiled single-module form required by the deployment host.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { createHash } from "node:crypto";

function sha256(s) { return createHash("sha256").update(s).digest("hex"); }
function gid(...p) { return sha256(JSON.stringify(p) + Date.now() + Math.random()).substring(0, 24); }
function now() { return new Date().toISOString(); }
function tok(t) { return t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 3); }

// ── STAGE 1: RECEIVED ────────────────────────────────────────────────────
function received(raw) {
  return {
    stage: "RECEIVED",
    raw_text: raw.document_text,
    source_name: raw.source_name || "document",
    author_id: raw.author_id || "unknown",
    author_domain_id: raw.author_domain_id || "unknown",
    hol_context: raw.hol_context || "",
  };
}

// ── STAGE 2: NORMALISED ──────────────────────────────────────────────────
function normalise(unit) {
  const cleaned = unit.raw_text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  return { ...unit, stage: "NORMALISED", normalised_text: cleaned };
}

// ── STAGE 3: CANONICALISED (CST) ─────────────────────────────────────────
function canonicalise(unit, ctx) {
  const hash = sha256(unit.normalised_text);
  const existing = ctx.existingHashMap[hash];
  const molecule_id = existing ? existing.molecule_id : "mol-" + hash.substring(0, 16);
  return { ...unit, stage: "CANONICALISED", canonicalHash: hash, molecule_id, is_duplicate: !!existing };
}

// ── STAGE 4: CLASSIFIED ──────────────────────────────────────────────────
function classify(unit) {
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
  const observationScore = (t.match(/\b(measured|observed|found|recorded|tested|demonstrated|confirmed|showed|indicated|reported)\b/g) || []).length * 2;
  const definitionScore = (t.match(/\b(defined as|refers to|is the|are the|means|known as|term|concept)\b/g) || []).length * 2;

  const scores = { constraint: constraintScore, method: methodScore, claim: claimScore, observation: observationScore, definition: definitionScore };
  const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const molecule_type = top[1] < 2 ? "claim" : top[0];
  return { ...unit, stage: "CLASSIFIED", molecule_type };
}

// ── STAGE 5: LINKED (PVOR) ────────────────────────────────────────────────
function inferLineageType(moleculeType) {
  if (moleculeType === "constraint") return "constrains";
  if (moleculeType === "method") return "supports";
  if (moleculeType === "observation") return "supports";
  if (moleculeType === "definition") return "references";
  return "contains";
}
function link(unit, ctx) {
  const lineage_type = inferLineageType(unit.molecule_type);
  return { ...unit, stage: "LINKED", parent_molecule_ids: [ctx.containerId], lineage_types: [lineage_type] };
}

// ── STAGE 6: VALIDATED ────────────────────────────────────────────────────
function validate(unit) {
  const issues = [];
  const wc = unit.normalised_text.split(/\s+/).length;
  if (wc < 15) issues.push("content_too_short");
  if (!unit.molecule_type) issues.push("unclassified");
  if (!unit.canonicalHash) issues.push("missing_canonical_hash");
  if (unit.parent_molecule_ids.length === 0) issues.push("no_lineage");
  return { ...unit, stage: "VALIDATED", evidence_gap_flag: issues.length > 0, validation_issues: issues };
}

// ── STAGE 7: TRUST SCORED (kCv) ───────────────────────────────────────────
function scoreOriginality(text, corpus) {
  const w = tok(text);
  if (corpus.length === 0) return Math.min((new Set(w).size / Math.max(w.length, 1)) * 1.2, 1.0);
  const cw = new Set(corpus.flatMap(t => tok(t)));
  const novel = w.filter(x => !cw.has(x)).length;
  return Math.min(0.3 + (novel / Math.max(w.length, 1)) * 0.7, 1.0);
}
function scoreClarity(text) {
  const s = text.split(/[.!?]+/).filter(x => x.trim().length > 0);
  if (!s.length) return 0.5;
  const l = s.map(x => x.trim().split(/\s+/).length);
  const avg = l.reduce((a, b) => a + b, 0) / l.length;
  const asc = avg < 8 ? 0.6 : avg > 40 ? 0.4 : avg > 25 ? 0.7 : 0.9;
  const v = l.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / l.length;
  return Math.max(asc - Math.min(v / 200, 0.3), 0.2);
}
function scoreUtility(text, moleculeType) {
  const patterns = [
    /\b(should|must|recommend|use|apply|ensure|calculate|measure|check|verify)\b/gi,
    /\b(therefore|thus|consequently|as a result)\b/gi,
    /\b(equation|formula|value|result|procedure|method|approach)\b/gi,
    /\d+(\.\d+)?(\s)?(mm|m|kg|kPa|bar|kW|MW|%|Pa\/m|m\/s)/gi,
  ];
  let hits = 0;
  for (const p of patterns) { const m = text.match(p); if (m) hits += m.length; }
  let base = Math.min(0.3 + (hits / Math.max(text.split(/\s+/).length, 1)) * 8, 1.0);
  if (moleculeType === "constraint") base = Math.min(base + 0.15, 1.0);
  if (moleculeType === "method") base = Math.min(base + 0.1, 1.0);
  return base;
}
function scoreAccuracy(text, moleculeType) {
  let s = 0.6;
  const hedges = (text.match(/\b(may|might|could|possibly|approximately|roughly|estimated|assumed)\b/gi) || []).length;
  const grounding = (text.match(/\b(measured|verified|tested|confirmed|per|according to|standard|specification)\b/gi) || []).length;
  const numerical = (text.match(/\b\d+(\.\d+)?\b/g) || []).length;
  s -= hedges * 0.02; s += grounding * 0.04; s += Math.min(numerical * 0.01, 0.1);
  if (moleculeType === "constraint") s = Math.min(s + 0.1, 0.95);
  return Math.max(Math.min(s, 0.95), 0.2);
}
function trust(unit, ctx) {
  const A = scoreAccuracy(unit.normalised_text, unit.molecule_type);
  const U = scoreUtility(unit.normalised_text, unit.molecule_type);
  const O = scoreOriginality(unit.normalised_text, ctx.corpusTexts);
  const C = scoreClarity(unit.normalised_text);
  const kCv_q = Math.round((0.35 * A + 0.25 * U + 0.2 * O + 0.2 * C) * 100) / 100;
  return {
    ...unit, stage: "TRUST_SCORED",
    kCv_o: Math.round(O * 100) / 100, kCv_u: Math.round(U * 100) / 100,
    kCv_rank: kCv_q, capture_confidence: Math.round(((A + U + O + C) / 4) * 100) / 100,
  };
}

// ── STAGE 8: REGISTERED ───────────────────────────────────────────────────
function register(unit) {
  return {
    ...unit, stage: "REGISTERED", constitutional_status: "active", access_tier: "open",
    weight_class: unit.molecule_type === "constraint" ? "constitutional" : "operational",
    state_since: now(),
  };
}

// ── STAGE 9: SEARCHABLE ───────────────────────────────────────────────────
function searchable(unit) {
  return { ...unit, stage: "SEARCHABLE", current_state: "EXPLORED" };
}

// ── DECOMPOSITION (pre-runtime: splits document into per-unit inputs) ────
function isHeading(line) {
  const t = line.trim();
  if (!t || t.length > 120) return false;
  return /^(\d+\.?\d*\.?\s+\w|[A-Z][A-Z\s]{3,40}$)/.test(t) || /^#{1,4}\s/.test(t);
}
function decompose(text) {
  const chunks = [];
  const lines = text.split("\n");
  let buf = [];
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

// ── PERSISTENCE PORT (Base44 adapter) ─────────────────────────────────────
class Base44Adapter {
  constructor(base44) { this.base44 = base44; }

  async getHashIndex() {
    const all = await this.base44.asServiceRole.entities.Molecule.list();
    const idx = {};
    for (const m of all) if (m.canonicalHash) idx[m.canonicalHash] = { molecule_id: m.molecule_id };
    return idx;
  }

  async getCorpusTexts() {
    const all = await this.base44.asServiceRole.entities.Molecule.list();
    return all.filter(m => m.lexical_content && m.molecule_type !== "container").map(m => m.lexical_content);
  }

  async ensureContainer(source_name, author_id, author_domain_id, hol_context) {
    const all = await this.base44.asServiceRole.entities.Molecule.list();
    const existing = all.find(m => m.molecule_type === "container" && m.source_name === source_name);
    if (existing) return existing.molecule_id;
    const hash = sha256("container:" + source_name);
    const containerId = "mol-container-" + hash.substring(0, 12);
    await this.base44.asServiceRole.entities.Molecule.create({
      molecule_id: containerId, canonicalHash: hash, lexical_content: source_name, molecule_type: "container",
      current_state: "EXPLORED", constitutional_status: "active", access_tier: "open", weight_class: "operational",
      is_foundational: false, kCv_o: 0, kCv_u: 0, kCv_v_score: 0, kCv_v_quality: "UNVERIFIED",
      kCv_i_score: 0, kCv_i_status: "UNOBSERVED", kCv_r_score: 0, kCv_r_status: "NEW", kCv_rank: 0,
      capture_confidence: "1.0", observation_density: 0, reuse_count: 0,
      parent_molecule_ids: [], lineage_types: [], lineage_certainty: "1.0",
      scope_definition: source_name, section: source_name, source_name, hol_context,
      author_domain_id, vsid: author_id, constitution_version: "v1.0", state_since: now(),
    });
    return containerId;
  }

  async persistMolecule(unit) {
    await this.base44.asServiceRole.entities.Molecule.create({
      molecule_id: unit.molecule_id, canonicalHash: unit.canonicalHash, lexical_content: unit.normalised_text,
      molecule_type: unit.molecule_type, current_state: unit.current_state,
      constitutional_status: unit.constitutional_status, access_tier: unit.access_tier, weight_class: unit.weight_class,
      is_foundational: false, kCv_o: unit.kCv_o, kCv_u: unit.kCv_u,
      kCv_v_score: 0, kCv_v_quality: "UNVERIFIED", kCv_i_score: 0, kCv_i_status: "UNOBSERVED",
      kCv_r_score: 0, kCv_r_status: "NEW", kCv_rank: unit.kCv_rank,
      capture_confidence: String(unit.capture_confidence), observation_density: 0, reuse_count: 0,
      parent_molecule_ids: unit.parent_molecule_ids, lineage_types: unit.lineage_types, lineage_certainty: "0.9",
      scope_definition: unit.source_name + "::" + unit.source_name, section: unit.source_name, source_name: unit.source_name,
      hol_context: unit.hol_context, author_domain_id: unit.author_domain_id, vsid: unit.author_id,
      constitution_version: "v1.0", state_since: unit.state_since,
    });
  }

  async recordStageObservation(unit, stageName) {
    const allObs = await this.base44.asServiceRole.entities.JournalObservation.list();
    const ls = Math.max(0, ...allObs.map(o => o.journal_sequence || 0));
    const oid = gid("stage", stageName, unit.molecule_id || unit.canonicalHash || (unit.raw_text || "").substring(0, 20), now());
    await this.base44.asServiceRole.entities.JournalObservation.create({
      observation_id: oid, molecule_id: unit.molecule_id || "pending", canonicalHash: unit.canonicalHash || "",
      observation_type: "pipeline_stage:" + stageName.toLowerCase(), polarity: 1, conflict_flag: false,
      actor_id: unit.author_id || "runtime", actor_domain_id: unit.author_domain_id || "runtime", actor_trust_score: 1.0,
      evidence_hash: sha256(stageName + (unit.canonicalHash || unit.normalised_text || "")),
      constitution_version: "v1.0", journal_sequence: ls + 1,
      observation_hash: sha256(oid + stageName + now()),
      prior_entry_hash: allObs.length > 0 ? (allObs[allObs.length - 1].observation_hash || "genesis") : "genesis",
    });
  }

  async recordConstitutionalFact(fact) {
    const allFacts = await this.base44.asServiceRole.entities.JournalFact.list();
    const ls = Math.max(0, ...allFacts.map(f => f.journal_sequence || 0));
    const fid = gid("fact", fact.molecule_id, now());
    await this.base44.asServiceRole.entities.JournalFact.create({
      fact_id: fid, molecule_id: fact.molecule_id, canonicalHash: fact.canonicalHash,
      fact_type: fact.fact_type, weight_class: fact.weight_class, polarity: 1,
      from_state: fact.from_state, to_state: fact.to_state,
      actor_id: fact.actor_id || "runtime", actor_domain_id: fact.actor_domain_id || "runtime", actor_trust_score: 1.0,
      evidence_hash: fact.evidence_hash, constitution_version: "v1.0", journal_sequence: ls + 1,
      fact_hash: sha256(fid + fact.molecule_id + now()),
      prior_entry_hash: allFacts.length > 0 ? (allFacts[allFacts.length - 1].fact_hash || "genesis") : "genesis",
    });
  }
}

// ── ORCHESTRATOR ───────────────────────────────────────────────────────────
async function runOriginRuntime(raw, port) {
  let unit = received(raw);
  await port.recordStageObservation(unit, "RECEIVED");

  unit = normalise(unit);
  await port.recordStageObservation(unit, "NORMALISED");

  const hashIndex = await port.getHashIndex();
  unit = canonicalise(unit, { existingHashMap: hashIndex });
  await port.recordStageObservation(unit, "CANONICALISED");

  if (unit.is_duplicate) return { success: true, skipped: true, reason: "duplicate_content", molecule_id: unit.molecule_id };

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

  await port.recordConstitutionalFact({
    molecule_id: unit.molecule_id, canonicalHash: unit.canonicalHash,
    fact_type: "molecule_created", from_state: "CREATED", to_state: "EXPLORED",
    weight_class: unit.weight_class, evidence_hash: unit.canonicalHash,
    actor_id: unit.author_id, actor_domain_id: unit.author_domain_id,
  });

  return {
    success: true, molecule_id: unit.molecule_id, molecule_type: unit.molecule_type,
    lineage_type: unit.lineage_types[0], kCv_q: unit.kCv_rank, stages_completed: 9,
    evidence_gap_flag: unit.evidence_gap_flag,
  };
}

async function ingestDocumentViaRuntime(payload, port) {
  const chunks = decompose(payload.document_text);
  const results = [];
  for (const chunkText of chunks) {
    const result = await runOriginRuntime({
      document_text: chunkText, source_name: payload.source_name, author_id: payload.author_id,
      author_domain_id: payload.author_domain_id, hol_context: payload.hol_context,
    }, port);
    results.push(result);
  }
  const created = results.filter(r => !r.skipped);
  const byType = {};
  for (const r of created) if (r.molecule_type) byType[r.molecule_type] = (byType[r.molecule_type] || 0) + 1;
  return {
    success: true, source_name: payload.source_name, units_processed: chunks.length,
    molecules_created: created.length, molecules_skipped: results.length - created.length,
    molecules_by_type: byType, results,
  };
}

// ── ACTION: get_stage_trace — proves execution provenance for a molecule ──
async function getStageTrace(payload, base44) {
  const molecule_id = payload.molecule_id;
  if (!molecule_id) return { success: false, error: "molecule_id required" };
  const allObs = await base44.asServiceRole.entities.JournalObservation.list();
  const trace = allObs
    .filter(o => o.molecule_id === molecule_id && (o.observation_type || "").startsWith("pipeline_stage:"))
    .sort((a, b) => (a.journal_sequence || 0) - (b.journal_sequence || 0))
    .map(o => ({ stage: o.observation_type.replace("pipeline_stage:", ""), journal_sequence: o.journal_sequence, evidence_hash: o.evidence_hash, observation_hash: o.observation_hash }));
  const allFacts = await base44.asServiceRole.entities.JournalFact.list();
  const facts = allFacts.filter(f => f.molecule_id === molecule_id)
    .map(f => ({ fact_type: f.fact_type, from_state: f.from_state, to_state: f.to_state, journal_sequence: f.journal_sequence }));
  return { success: true, molecule_id, stage_trace: trace, stages_recorded: trace.length, constitutional_facts: facts };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const port = new Base44Adapter(base44);
  try {
    const body = await req.json();
    const action = body.action;
    const payload = Object.assign({}, body); delete payload.action;

    if (action === "ingest_document") return Response.json(await ingestDocumentViaRuntime(payload, port));
    if (action === "get_stage_trace") return Response.json(await getStageTrace(payload, base44));

    return Response.json({ error: "Unknown action: " + action, valid_actions: ["ingest_document", "get_stage_trace"] }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
