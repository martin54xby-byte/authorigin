// AuthOrigin — Constitutional Retrieval Layer
// Phase 5 — Two-phase kCv-gated knowledge retrieval
// Every response carries a constitutional receipt.
// Constitution v1.0 — June 22, 2026

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { createHash } from "node:crypto";

// ─────────────────────────────────────────────
// CONSTITUTIONAL PARAMETERS (v1.0, locked)
// ─────────────────────────────────────────────

const CONSTITUTION_VERSION = "v1.0";

// Retrieval gates (C-R1 through C-R5)
const RETRIEVAL_GATES = {
  MIN_KCV_V:          0.0,   // C-R1: > 0 means must have some verification
  MIN_KCV_AGGREGATE:  0.10,  // C-R2: minimum aggregate floor
  BLOCKED_PROPAGATION: ["PROVISIONAL", "WEAKENED"],  // C-R3
  AUTHORITATIVE_STATES: ["VERIFIED_WEAK","VERIFIED_STRONG","MATERIALISED","REINFORCED"], // C-R4
};

// Access tier thresholds (higher tier = stricter gate)
const TIER_GATES: Record<string, { min_kCv_v: number; min_aggregate: number; label: string }> = {
  open:         { min_kCv_v: 0.0,  min_aggregate: 0.0,  label: "open — no kCv gate" },
  standard:     { min_kCv_v: 0.01, min_aggregate: 0.10, label: "standard — verified only" },
  verified:     { min_kCv_v: 0.20, min_aggregate: 0.25, label: "verified — WEAK or STRONG" },
  authoritative:{ min_kCv_v: 0.27, min_aggregate: 0.30, label: "authoritative — STRONG survival required" },
  foundational: { min_kCv_v: 0.50, min_aggregate: 0.50, label: "foundational — high-resilience only" },
};

const KCV_AGGREGATE_WEIGHTS = { kCv_v: 0.35, kCv_r: 0.25, kCv_i: 0.20, kCv_u: 0.12, kCv_o: 0.08 };
const DEFAULT_DAMPING = 0.6;
const LINEAGE_WEIGHTS: Record<string, number> = {
  direct_inheritance: 1.0, primary_citation: 0.8, decision_reference: 0.7,
  secondary_citation: 0.4, tangential_mention: 0.1,
};

// ─────────────────────────────────────────────
// UTILITIES (inline kCv projection — no external call)
// ─────────────────────────────────────────────

function clamp(v: number): number { return Math.min(1.0, Math.max(0.0, v)); }
function monthsBetween(a: string, b: string = new Date().toISOString()): number {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
}
function computeHash(...parts: any[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}
function generateId(...parts: any[]): string {
  return createHash("sha256").update(JSON.stringify(parts) + Date.now() + Math.random()).digest("hex").substring(0, 24);
}

function inlineProjectVerification(molecule_id: string, facts: any[]): { score: number; quality: string } {
  const mf = facts.filter(f => f.molecule_id === molecule_id);
  const strong = mf.filter(f => f.fact_type === "survived_challenge");
  const weak   = mf.filter(f => f.fact_type === "governance_approved" && f.from_state === "UNDER_GOVERNANCE");
  if (!strong.length && !weak.length) return { score: 0, quality: "NONE" };
  let score = weak.length > 0 ? 0.4 : 0;
  for (const f of strong) score += 0.2 * (1 + (f.challenge_quality_score ?? 0.5) * 0.5);
  return { score: clamp(score), quality: strong.length > 0 ? "STRONG" : "WEAK" };
}

function inlineProjectResilience(molecule_id: string, facts: any[], current_state: string, state_since: string, kCv_v: number): number {
  if (kCv_v === 0) return 0;
  const mf = facts.filter(f => f.molecule_id === molecule_id);
  const survived   = mf.filter(f => f.fact_type === "survived_challenge").length;
  const rejected   = mf.filter(f => f.fact_type === "rejected").length;
  const deprecated = mf.filter(f => f.fact_type === "deprecated").length;
  const total = survived + rejected + deprecated;
  const sr = total > 0 ? survived / total : (survived > 0 ? 1.0 : 0.5);
  const lm = ["VERIFIED_WEAK","VERIFIED_STRONG","MATERIALISED","REINFORCED"].includes(current_state) ? monthsBetween(state_since) : 0;
  const ls = clamp(lm < 36 ? lm / 36 : 1.0 - Math.max(0, (lm - 36) / 108));
  return clamp(sr * 0.60 + ls * 0.40);
}

function inlineProjectUtility(molecule_id: string, observations: any[], allMolecules: any[]): number {
  const direct = allMolecules.filter(m => Array.isArray(m.parent_molecule_ids) && m.parent_molecule_ids.includes(molecule_id)).length;
  const reuse  = observations.filter(o => o.molecule_id === molecule_id && ["reuse_event","decision_reference","primary_citation","secondary_citation"].includes(o.observation_type)).length;
  return clamp(Math.log(direct + reuse + 1) / Math.log(101));
}

function inlineProjectOriginality(molecule_id: string, parent_ids: string[], allMolecules: any[]): number {
  if (!parent_ids.length) return 1.0;
  const siblings = allMolecules.filter(m => m.molecule_id !== molecule_id && Array.isArray(m.parent_molecule_ids) && m.parent_molecule_ids.some((p: string) => parent_ids.includes(p))).length;
  return clamp(siblings > 0 ? 1 / (1 + Math.log(siblings + 1)) : 1.0);
}

function inlineProjectImpact(molecule_id: string, facts: any[], observations: any[], kCv_v: number): number {
  if (kCv_v === 0) return 0;
  const mat = facts.filter(f => f.molecule_id === molecule_id && f.fact_type === "state_transition" && ["MATERIALISED","REINFORCED"].includes(f.to_state)).length;
  const out = observations.filter(o => o.molecule_id === molecule_id && ["outcome_observed","impact_observed","decision_materialised","value_generated"].includes(o.observation_type)).length;
  const pay = facts.filter(f => f.molecule_id === molecule_id && f.payment_amount > 0).length;
  return clamp((mat > 0 ? 0.4 : 0) + clamp(Math.log(out + 1) / Math.log(51)) * 0.4 + (pay > 0 ? 0.2 : 0));
}

function computeAggregate(c: { kCv_o: number; kCv_u: number; kCv_v: number; kCv_i: number; kCv_r: number }): number {
  return clamp(c.kCv_o * 0.08 + c.kCv_u * 0.12 + c.kCv_v * 0.35 + c.kCv_i * 0.20 + c.kCv_r * 0.25);
}

// Full inline projection for a molecule record
function projectMoleculeKCv(mol: any, allMolecules: any[], allFacts: any[], allObservations: any[]) {
  const { molecule_id, current_state, state_since, created_date, parent_molecule_ids = [], canonicalHash } = mol;
  const kCv_v_result = inlineProjectVerification(molecule_id, allFacts);
  const kCv_v = kCv_v_result.score;
  const kCv_r = inlineProjectResilience(molecule_id, allFacts, current_state, state_since ?? created_date, kCv_v);
  const kCv_u = inlineProjectUtility(molecule_id, allObservations, allMolecules);
  const kCv_o = inlineProjectOriginality(molecule_id, parent_molecule_ids, allMolecules);
  const kCv_i = inlineProjectImpact(molecule_id, allFacts, allObservations, kCv_v);
  const kCv_aggregate = computeAggregate({ kCv_o, kCv_u, kCv_v, kCv_i, kCv_r });
  return { kCv_o, kCv_u, kCv_v, kCv_i, kCv_r, kCv_aggregate, kCv_v_quality: kCv_v_result.quality };
}

// ─────────────────────────────────────────────
// PHASE 1 — CONSTITUTIONAL PRE-FILTER
// Returns ranked, gated candidate molecules
// ─────────────────────────────────────────────

interface GateResult {
  molecule_id: string;
  passed: boolean;
  gates_failed: string[];
  kCv: { kCv_o: number; kCv_u: number; kCv_v: number; kCv_i: number; kCv_r: number; kCv_aggregate: number; kCv_v_quality: string };
  current_state: string;
  propagation_status: string;
  canonicalHash: string;
  scope_definition?: string;
  evidence_gap_flag: boolean;
}

function applyConstitutionalGates(
  mol: any,
  kCv: ReturnType<typeof projectMoleculeKCv>,
  tier: string = "standard"
): { passed: boolean; gates_failed: string[] } {
  const gates_failed: string[] = [];
  const tier_gate = TIER_GATES[tier] ?? TIER_GATES.standard;

  // C-R1: verification gate
  if (kCv.kCv_v <= tier_gate.min_kCv_v) gates_failed.push(`C-R1: kCv_v=${kCv.kCv_v.toFixed(3)} ≤ tier floor ${tier_gate.min_kCv_v}`);

  // C-R2: aggregate floor
  if (kCv.kCv_aggregate < tier_gate.min_aggregate) gates_failed.push(`C-R2: kCv_aggregate=${kCv.kCv_aggregate.toFixed(3)} < tier floor ${tier_gate.min_aggregate}`);

  // C-R3: no PROVISIONAL or WEAKENED propagation status
  if (RETRIEVAL_GATES.BLOCKED_PROPAGATION.includes(mol.propagation_status)) gates_failed.push(`C-R3: propagation_status=${mol.propagation_status} is blocked`);

  // C-R4: must be in an authoritative state
  if (!RETRIEVAL_GATES.AUTHORITATIVE_STATES.includes(mol.current_state)) gates_failed.push(`C-R4: state=${mol.current_state} is not retrieval-authoritative`);

  return { passed: gates_failed.length === 0, gates_failed };
}

// ─────────────────────────────────────────────
// ACTION: FILTER BY kCv (Phase 1 only)
// ─────────────────────────────────────────────

async function filterByKCv(payload: any, base44: any): Promise<any> {
  const {
    molecule_ids,
    access_tier = "standard",
    include_failed = false,
    limit = 50,
  } = payload;

  const [allMolecules, allFacts, allObservations] = await Promise.all([
    base44.asServiceRole.entities.Molecule.list(),
    base44.asServiceRole.entities.JournalFact.list(),
    base44.asServiceRole.entities.JournalObservation.list(),
  ]);

  const candidates = molecule_ids
    ? allMolecules.filter((m: any) => molecule_ids.includes(m.molecule_id))
    : allMolecules.slice(0, limit);

  const results: GateResult[] = [];

  for (const mol of candidates) {
    const kCv = projectMoleculeKCv(mol, allMolecules, allFacts, allObservations);
    const mol_obs = allObservations.filter((o: any) => o.molecule_id === mol.molecule_id);
    const evidence_gap_flag = kCv.kCv_v === 0 && mol_obs.length < 3;
    const { passed, gates_failed } = applyConstitutionalGates(mol, kCv, access_tier);

    if (passed || include_failed) {
      results.push({
        molecule_id: mol.molecule_id,
        passed,
        gates_failed,
        kCv,
        current_state: mol.current_state,
        propagation_status: mol.propagation_status ?? "NONE",
        canonicalHash: mol.canonicalHash,
        scope_definition: mol.scope_definition,
        evidence_gap_flag,
      });
    }
  }

  // Sort passing molecules by kCv_aggregate descending
  const passing = results.filter(r => r.passed).sort((a, b) => b.kCv.kCv_aggregate - a.kCv.kCv_aggregate);
  const failed  = results.filter(r => !r.passed);

  return {
    success: true,
    access_tier,
    tier_label: TIER_GATES[access_tier]?.label ?? "unknown",
    passing_count: passing.length,
    failed_count: failed.length,
    total_evaluated: candidates.length,
    passing_molecules: passing,
    failed_molecules: include_failed ? failed : [],
    projected_at: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────
// ACTION: GET LINEAGE BUNDLE
// Returns a molecule + all its ancestors with kCv scores
// Builds a constitutional provenance chain
// ─────────────────────────────────────────────

async function getLineageBundle(payload: any, base44: any): Promise<any> {
  const { molecule_id, max_depth = 5 } = payload;
  if (!molecule_id) return { success: false, error: "molecule_id required" };

  const [allMolecules, allFacts, allObservations] = await Promise.all([
    base44.asServiceRole.entities.Molecule.list(),
    base44.asServiceRole.entities.JournalFact.list(),
    base44.asServiceRole.entities.JournalObservation.list(),
  ]);

  const visited = new Set<string>();
  const bundle: any[] = [];

  async function walkLineage(mol_id: string, depth: number, lineage_type: string) {
    if (depth > max_depth || visited.has(mol_id)) return;
    visited.add(mol_id);

    const mol = allMolecules.find((m: any) => m.molecule_id === mol_id);
    if (!mol) return;

    const kCv = projectMoleculeKCv(mol, allMolecules, allFacts, allObservations);
    const { passed, gates_failed } = applyConstitutionalGates(mol, kCv, "standard");

    bundle.push({
      molecule_id: mol_id,
      depth,
      lineage_type,
      current_state: mol.current_state,
      canonicalHash: mol.canonicalHash,
      scope_definition: mol.scope_definition,
      kCv,
      constitutional_status: passed ? "retrieval_authoritative" : "below_gate",
      gates_failed,
    });

    // Recurse into parents
    const parents: string[] = mol.parent_molecule_ids ?? [];
    const types: string[]   = mol.lineage_types ?? [];
    for (let i = 0; i < parents.length; i++) {
      await walkLineage(parents[i], depth + 1, types[i] ?? "secondary_citation");
    }
  }

  await walkLineage(molecule_id, 0, "root");

  // Build lineage authority score (damped)
  const lineage_authority = bundle.reduce((acc, node) => {
    if (node.depth === 0) return acc;
    const lw = LINEAGE_WEIGHTS[node.lineage_type] ?? 0.1;
    const attenuation = Math.pow(DEFAULT_DAMPING, node.depth - 1);
    return acc + node.kCv.kCv_r * lw * attenuation;
  }, 0);

  return {
    success: true,
    molecule_id,
    lineage_depth_reached: Math.max(...bundle.map(b => b.depth), 0),
    lineage_authority: clamp(lineage_authority),
    molecules_in_bundle: bundle.length,
    bundle,
    projected_at: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────
// ACTION: CONSTITUTIONAL QUERY (Full two-phase)
// Phase 1: gate and rank candidates
// Phase 2: assemble constitutional answer with provenance
// ─────────────────────────────────────────────

async function constitutionalQuery(payload: any, base44: any): Promise<any> {
  const {
    query_molecule_ids,
    query_scope,          // optional scope filter
    query_type,           // optional type filter
    access_tier = "standard",
    max_results = 10,
    include_lineage = true,
    include_trace = false,
  } = payload;

  const query_id = generateId("query", query_scope ?? "all", access_tier, Date.now());
  const queried_at = new Date().toISOString();

  // ── Phase 1: Fetch and gate ───────────────────────────────────
  const [allMolecules, allFacts, allObservations] = await Promise.all([
    base44.asServiceRole.entities.Molecule.list(),
    base44.asServiceRole.entities.JournalFact.list(),
    base44.asServiceRole.entities.JournalObservation.list(),
  ]);

  let candidates = query_molecule_ids
    ? allMolecules.filter((m: any) => query_molecule_ids.includes(m.molecule_id))
    : allMolecules;

  // Optional filters
  if (query_scope) candidates = candidates.filter((m: any) => m.scope_definition === query_scope);
  if (query_type)  candidates = candidates.filter((m: any) => m.molecule_type === query_type);

  const phase1_results: any[] = [];
  const gate_log: any[] = [];

  for (const mol of candidates) {
    const kCv = projectMoleculeKCv(mol, allMolecules, allFacts, allObservations);
    const mol_obs = allObservations.filter((o: any) => o.molecule_id === mol.molecule_id);
    const evidence_gap_flag = kCv.kCv_v === 0 && mol_obs.length < 3;
    const { passed, gates_failed } = applyConstitutionalGates(mol, kCv, access_tier);

    gate_log.push({
      molecule_id: mol.molecule_id,
      passed,
      gates_failed,
      kCv_aggregate: kCv.kCv_aggregate,
      kCv_v: kCv.kCv_v,
      state: mol.current_state,
    });

    if (passed) {
      phase1_results.push({ mol, kCv, evidence_gap_flag });
    }
  }

  // Sort by kCv_aggregate descending, take top max_results
  phase1_results.sort((a, b) => b.kCv.kCv_aggregate - a.kCv.kCv_aggregate);
  const top_candidates = phase1_results.slice(0, max_results);

  // ── Phase 2: Assemble constitutional answer ───────────────────
  const answer_components: any[] = [];

  for (const { mol, kCv, evidence_gap_flag } of top_candidates) {
    const component: any = {
      molecule_id:        mol.molecule_id,
      canonicalHash:      mol.canonicalHash,
      scope_definition:   mol.scope_definition,
      molecule_type:      mol.molecule_type,
      current_state:      mol.current_state,
      kCv_aggregate:      kCv.kCv_aggregate,
      kCv_v:              kCv.kCv_v,
      kCv_v_quality:      kCv.kCv_v_quality,
      kCv_r:              kCv.kCv_r,
      kCv_u:              kCv.kCv_u,
      evidence_gap_flag,
      constitutional_status: "retrieval_authoritative",
    };

    // Optionally attach lineage provenance
    if (include_lineage && mol.parent_molecule_ids?.length > 0) {
      const parents: any[] = [];
      for (const pid of mol.parent_molecule_ids) {
        const parent = allMolecules.find((m: any) => m.molecule_id === pid);
        if (parent) {
          const parent_kCv = projectMoleculeKCv(parent, allMolecules, allFacts, allObservations);
          parents.push({
            molecule_id: pid,
            canonicalHash: parent.canonicalHash,
            current_state: parent.current_state,
            kCv_v: parent_kCv.kCv_v,
            kCv_v_quality: parent_kCv.kCv_v_quality,
          });
        }
      }
      component.lineage = parents;
    }

    if (include_trace) {
      const trace: any[] = [];
      const kCv_v_r = inlineProjectVerification(mol.molecule_id, allFacts);
      trace.push({ component: "kCv_v", value: kCv_v_r.score, quality: kCv_v_r.quality });
      component.projection_trace = trace;
    }

    answer_components.push(component);
  }

  // ── Constitutional receipt (C-R5) ────────────────────────────
  const receipt_hash = computeHash(query_id, answer_components.map(a => a.molecule_id), access_tier, queried_at, CONSTITUTION_VERSION);

  const constitutional_receipt = {
    query_id,
    queried_at,
    constitution_version: CONSTITUTION_VERSION,
    access_tier,
    tier_label: TIER_GATES[access_tier]?.label ?? "unknown",
    total_candidates:   candidates.length,
    phase1_passed:      top_candidates.length,
    phase1_failed:      gate_log.filter(g => !g.passed).length,
    answer_components:  answer_components.length,
    receipt_hash,
    // Integrity: can this receipt be reproduced by re-projecting the same journal at the same sequence?
    integrity_note: "Re-project the Origin Journal at the sequence numbers in each molecule's last_fact_id to reproduce this receipt.",
  };

  // ── Write retrieval observation to journal ────────────────────
  // Every query is observable — this is what kCv_u and kCv_i are built from
  for (const { mol } of top_candidates) {
    try {
      const obs_id = generateId("obs", mol.molecule_id, query_id);
      const allObs = await base44.asServiceRole.entities.JournalObservation.list();
      const last_seq = Math.max(0, ...allObs.map((o: any) => o.journal_sequence ?? 0));
      await base44.asServiceRole.entities.JournalObservation.create({
        observation_id: obs_id,
        molecule_id: mol.molecule_id,
        observation_type: "reuse_event",
        polarity: 1,
        conflict_flag: false,
        actor_id: `query:${query_id}`,
        actor_domain_id: "authorigin:retrieval",
        actor_trust_score: 1.0,
        metadata: { query_id, access_tier, retrieved_at: queried_at },
        constitution_version: CONSTITUTION_VERSION,
        journal_sequence: last_seq + 1,
        observation_hash: computeHash(obs_id, mol.molecule_id, query_id, last_seq + 1),
        prior_entry_hash: mol.last_observation_id ?? "genesis",
      });
    } catch (_) { /* non-blocking — retrieval observation failure does not block the response */ }
  }

  return {
    success: true,
    constitutional_receipt,
    answer_components,
    gate_log: gate_log.filter(g => !g.passed).map(g => ({
      molecule_id: g.molecule_id,
      gates_failed: g.gates_failed,
      kCv_aggregate: g.kCv_aggregate,
    })),
  };
}

// ─────────────────────────────────────────────
// ACTION: RETRIEVAL AUDIT LOG
// What was returned for a given query_id, and why
// ─────────────────────────────────────────────

async function getRetrievalAuditLog(payload: any, base44: any): Promise<any> {
  const { query_id, molecule_id } = payload;
  if (!query_id && !molecule_id) return { success: false, error: "query_id or molecule_id required" };

  const allObs = await base44.asServiceRole.entities.JournalObservation.list();

  const retrieval_obs = allObs.filter((o: any) => {
    if (query_id) return o.metadata?.query_id === query_id;
    if (molecule_id) return o.molecule_id === molecule_id && o.observation_type === "reuse_event";
    return false;
  });

  return {
    success: true,
    query_id,
    molecule_id,
    retrieval_events: retrieval_obs.length,
    events: retrieval_obs.map((o: any) => ({
      observation_id: o.observation_id,
      molecule_id: o.molecule_id,
      observation_type: o.observation_type,
      retrieved_at: o.created_date,
      access_tier: o.metadata?.access_tier,
      query_id: o.metadata?.query_id,
      journal_sequence: o.journal_sequence,
    })).sort((a: any, b: any) => (a.journal_sequence ?? 0) - (b.journal_sequence ?? 0)),
  };
}

// ─────────────────────────────────────────────
// HTTP HANDLER
// ─────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const body = await req.json();
    const { action, ...payload } = body;

    if (action === "constitutional_query")    return Response.json(await constitutionalQuery(payload, base44));
    if (action === "filter_by_kcv")           return Response.json(await filterByKCv(payload, base44));
    if (action === "get_lineage_bundle")      return Response.json(await getLineageBundle(payload, base44));
    if (action === "get_retrieval_audit_log") return Response.json(await getRetrievalAuditLog(payload, base44));

    return Response.json({
      error: `Unknown action: ${action}`,
      valid_actions: ["constitutional_query","filter_by_kcv","get_lineage_bundle","get_retrieval_audit_log"],
    }, { status: 400 });

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
