// AuthOrigin — kCv Projection Engine
// Phase 4 — Runtime projection over the Origin Journal
// kCv is never stored. It is always derived from evidence.
// Constitution v1.0 — June 22, 2026

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { createHash } from "node:crypto";

// ─────────────────────────────────────────────
// CONSTITUTIONAL PARAMETERS (v1.0, locked)
// ─────────────────────────────────────────────

const CONSTITUTION_VERSION = "v1.0";

// Aggregate weights — versioned governance molecules in production
// Stored here as constitutional defaults
const KCV_AGGREGATE_WEIGHTS = {
  kCv_v: 0.35,   // constitutional — verification is primary
  kCv_r: 0.25,   // constitutional — survival under pressure
  kCv_i: 0.20,   // constitutional — demonstrated impact
  kCv_u: 0.12,   // operational  — utility/reuse
  kCv_o: 0.08,   // operational  — originality
};

// Longevity decay: value of time in VERIFIED_STRONG or REINFORCED (months)
const LONGEVITY_FULL_VALUE_MONTHS = 36;   // max credit at 36 months
const LONGEVITY_DECAY_HALFLIFE   = 24;    // halves every 24 months of inactivity

// Lineage damping (C-7 / kCvRank)
const DEFAULT_DAMPING = 0.6;
const LINEAGE_WEIGHTS: Record<string, number> = {
  direct_inheritance: 1.0,
  primary_citation:   0.8,
  decision_reference: 0.7,
  secondary_citation: 0.4,
  tangential_mention: 0.1,
};

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface KCvProjection {
  molecule_id:    string;
  canonicalHash:  string;
  projected_at:   string;
  constitution_version: string;

  // Dimensional scores (0.0 – 1.0 each)
  kCv_o: number;    // Originality
  kCv_u: number;    // Utility
  kCv_v: number;    // Verification  (constitutional weight)
  kCv_i: number;    // Impact         (gated by kCv_v)
  kCv_r: number;    // Resilience     (gated by kCv_v)
  kCvRank: number;  // Lineage authority

  // Aggregate
  kCv_aggregate: number;

  // Metadata
  kCv_v_quality:  "NONE" | "WEAK" | "STRONG";
  evidence_gap_flag: boolean;
  observation_density: number;

  // Evidence counts (auditable trace)
  evidence: {
    survived_challenges:    number;
    total_challenges:       number;
    reuse_citations:        number;
    decision_references:    number;
    outcome_observations:   number;
    longevity_months:       number;
    ancestors_evaluated:    number;
  };

  // Projection trace — which facts/observations contributed
  projection_trace: Array<{
    component: string;
    source_type: "JournalFact" | "JournalObservation";
    source_id: string;
    contribution: number;
    note?: string;
  }>;
}

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

function monthsBetween(dateA: string, dateB: string = new Date().toISOString()): number {
  return Math.max(0, (new Date(dateB).getTime() - new Date(dateA).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
}

function clamp(val: number): number {
  return Math.min(1.0, Math.max(0.0, val));
}

// ─────────────────────────────────────────────
// kCv_o — ORIGINALITY
// Projection source: JournalFact (state_transition CREATED→EXPLORED)
// Measures: how unique is this molecule's canonicalHash in the journal?
// Penalised by: number of molecules with same lineage_type parent
// ─────────────────────────────────────────────

async function projectOriginality(
  molecule_id: string,
  canonicalHash: string,
  parent_molecule_ids: string[],
  allMolecules: any[],
  trace: any[]
): Promise<number> {

  // Penalise if molecule shares same parent as many siblings
  // (many siblings = lower originality — not unique contribution)
  const siblings = allMolecules.filter(m =>
    m.molecule_id !== molecule_id &&
    Array.isArray(m.parent_molecule_ids) &&
    m.parent_molecule_ids.some((p: string) => parent_molecule_ids.includes(p))
  );

  // Base originality: starts at 1.0, decays with sibling count
  // Logarithmic penalty: 1 / (1 + log(siblings+1))
  const sibling_count = siblings.length;
  const sibling_penalty = sibling_count > 0
    ? 1 / (1 + Math.log(sibling_count + 1))
    : 1.0;

  // Root molecule (no parents) gets full originality
  const is_root = parent_molecule_ids.length === 0;
  const base_originality = is_root ? 1.0 : sibling_penalty;

  const kCv_o = clamp(base_originality);

  trace.push({
    component: "kCv_o",
    source_type: "JournalFact",
    source_id: `lineage_graph:${molecule_id}`,
    contribution: kCv_o,
    note: `siblings_sharing_parent=${sibling_count}, is_root=${is_root}`,
  });

  return kCv_o;
}

// ─────────────────────────────────────────────
// kCv_u — UTILITY
// Projection source: JournalObservation (reuse, decision_reference)
//   + JournalFact (lineage citations)
// Measures: distinct downstream uses
// ─────────────────────────────────────────────

async function projectUtility(
  molecule_id: string,
  observations: any[],
  allMolecules: any[],
  trace: any[]
): Promise<{ score: number; reuse_citations: number; decision_references: number }> {

  // Count molecules that cite this one as a parent
  const direct_citations = allMolecules.filter(m =>
    Array.isArray(m.parent_molecule_ids) &&
    m.parent_molecule_ids.includes(molecule_id)
  ).length;

  // Count reuse observations
  const reuse_obs = observations.filter(o =>
    o.molecule_id === molecule_id &&
    ["reuse_event","decision_reference","primary_citation","secondary_citation"].includes(o.observation_type)
  );
  const decision_obs = reuse_obs.filter(o => o.observation_type === "decision_reference");

  const total_uses = direct_citations + reuse_obs.length;
  const decision_count = decision_obs.length;

  // Utility score: saturates at 100 uses (log scale)
  // Decision references carry 3× weight
  const weighted_uses = total_uses + (decision_count * 2); // extra weight already in direct count
  const kCv_u = clamp(Math.log(weighted_uses + 1) / Math.log(101));

  trace.push({
    component: "kCv_u",
    source_type: "JournalObservation",
    source_id: `observations:${molecule_id}`,
    contribution: kCv_u,
    note: `direct_citations=${direct_citations}, reuse_obs=${reuse_obs.length}, decision_refs=${decision_count}`,
  });

  return { score: kCv_u, reuse_citations: direct_citations + reuse_obs.length, decision_references: decision_count };
}

// ─────────────────────────────────────────────
// kCv_v — VERIFICATION
// Projection source: JournalFact (survived_challenge, governance_approved)
// Two-tier: WEAK (0.5 base) vs STRONG (1.0 base per survived challenge)
// Compounds with each survival: kCv_v grows with each challenge survived
// ─────────────────────────────────────────────

async function projectVerification(
  molecule_id: string,
  facts: any[],
  trace: any[]
): Promise<{ score: number; quality: "NONE"|"WEAK"|"STRONG"; survived: number; total_challenges: number }> {

  const mol_facts = facts.filter(f => f.molecule_id === molecule_id);

  // Count challenge lifecycle facts
  const survived_strong = mol_facts.filter(f => f.fact_type === "survived_challenge");
  const survived_weak   = mol_facts.filter(f => f.fact_type === "governance_approved" && f.from_state === "UNDER_GOVERNANCE");
  const total_challenges = mol_facts.filter(f =>
    f.fact_type === "survived_challenge" ||
    (f.fact_type === "state_transition" && f.to_state === "COLLAPSING")
  ).length;

  if (survived_strong.length === 0 && survived_weak.length === 0) {
    trace.push({ component: "kCv_v", source_type: "JournalFact", source_id: `none:${molecule_id}`, contribution: 0, note: "No verification facts found" });
    return { score: 0, quality: "NONE", survived: 0, total_challenges };
  }

  // WEAK verification: base 0.4
  // Each STRONG survival: +0.2 compounding, capped at 1.0
  // Quality score of the challenge contributes to magnitude
  let base = survived_weak.length > 0 ? 0.4 : 0;
  let strong_score = 0;

  for (const f of survived_strong) {
    const q = f.challenge_quality_score ?? 0.5;
    // Higher quality challenge = more valuable survival
    strong_score += 0.2 * (1 + q * 0.5);
  }

  const kCv_v = clamp(base + strong_score);
  const quality: "NONE"|"WEAK"|"STRONG" = survived_strong.length > 0 ? "STRONG" : "WEAK";

  for (const f of survived_strong) {
    trace.push({
      component: "kCv_v",
      source_type: "JournalFact",
      source_id: f.fact_id,
      contribution: 0.2 * (1 + (f.challenge_quality_score ?? 0.5) * 0.5),
      note: `survived_challenge quality=${f.challenge_quality_score?.toFixed(3)}, type=${f.survival_type}`,
    });
  }

  return { score: kCv_v, quality, survived: survived_strong.length + survived_weak.length, total_challenges };
}

// ─────────────────────────────────────────────
// kCv_i — IMPACT
// Projection source: JournalObservation (outcome events, impact_observed)
// JournalFact (impact_observed, materialised)
// C-2: gated by kCv_v > 0
// ─────────────────────────────────────────────

async function projectImpact(
  molecule_id: string,
  facts: any[],
  observations: any[],
  kCv_v: number,
  trace: any[]
): Promise<{ score: number; outcome_observations: number }> {

  // C-2 gate
  if (kCv_v === 0) {
    trace.push({ component: "kCv_i", source_type: "JournalFact", source_id: `gated:${molecule_id}`, contribution: 0, note: "C-2: gated — kCv_v is 0" });
    return { score: 0, outcome_observations: 0 };
  }

  const mol_facts = facts.filter(f => f.molecule_id === molecule_id);
  const mol_obs   = observations.filter(o => o.molecule_id === molecule_id);

  // Impact facts: state reaching MATERIALISED or REINFORCED
  const materialised_facts = mol_facts.filter(f =>
    f.fact_type === "state_transition" &&
    ["MATERIALISED","REINFORCED"].includes(f.to_state)
  );

  // Outcome observations: direct impact signals
  const outcome_obs = mol_obs.filter(o =>
    ["outcome_observed","impact_observed","decision_materialised","value_generated"].includes(o.observation_type)
  );

  // Payment facts signal realised value (strongest impact signal)
  const payment_facts = mol_facts.filter(f => f.payment_amount && f.payment_amount > 0);

  const base_impact = materialised_facts.length > 0 ? 0.4 : 0;
  const obs_impact  = clamp(Math.log(outcome_obs.length + 1) / Math.log(51)) * 0.4; // saturates at 50 outcome obs
  const payment_signal = payment_facts.length > 0 ? 0.2 : 0;

  const kCv_i = clamp(base_impact + obs_impact + payment_signal);

  if (materialised_facts.length > 0) {
    trace.push({
      component: "kCv_i",
      source_type: "JournalFact",
      source_id: materialised_facts[0].fact_id,
      contribution: base_impact,
      note: `reached MATERIALISED/REINFORCED — ${materialised_facts.length} transition(s)`,
    });
  }

  if (outcome_obs.length > 0) {
    trace.push({
      component: "kCv_i",
      source_type: "JournalObservation",
      source_id: `outcome_obs:${molecule_id}`,
      contribution: obs_impact,
      note: `${outcome_obs.length} outcome observations`,
    });
  }

  return { score: kCv_i, outcome_observations: outcome_obs.length };
}

// ─────────────────────────────────────────────
// kCv_r — RESILIENCE
// Projection source: JournalFact (survival, rejection, deprecation)
// + time in active verified states (longevity)
// C-2: gated by kCv_v > 0
// ─────────────────────────────────────────────

async function projectResilience(
  molecule_id: string,
  facts: any[],
  current_state: string,
  state_since: string,
  kCv_v: number,
  trace: any[]
): Promise<{ score: number; longevity_months: number }> {

  // C-2 gate
  if (kCv_v === 0) {
    trace.push({ component: "kCv_r", source_type: "JournalFact", source_id: `gated:${molecule_id}`, contribution: 0, note: "C-2: gated — kCv_v is 0" });
    return { score: 0, longevity_months: 0 };
  }

  const mol_facts = facts.filter(f => f.molecule_id === molecule_id);

  // Survival ratio: survived / (survived + collapsed_to_rejected)
  const survived = mol_facts.filter(f => f.fact_type === "survived_challenge").length;
  const rejected = mol_facts.filter(f => f.fact_type === "rejected").length;
  const deprecated = mol_facts.filter(f => f.fact_type === "deprecated").length;
  const total_resolved = survived + rejected + deprecated;

  const survival_rate = total_resolved > 0 ? survived / total_resolved : (survived > 0 ? 1.0 : 0.5);

  // Longevity: time spent in active verified states
  const active_states = ["VERIFIED_WEAK","VERIFIED_STRONG","MATERIALISED","REINFORCED"];
  const longevity_months = active_states.includes(current_state)
    ? monthsBetween(state_since)
    : 0;

  // Longevity score: grows to 1.0 over LONGEVITY_FULL_VALUE_MONTHS, then decays slowly
  const longevity_score = clamp(
    longevity_months < LONGEVITY_FULL_VALUE_MONTHS
      ? longevity_months / LONGEVITY_FULL_VALUE_MONTHS
      : 1.0 - Math.max(0, (longevity_months - LONGEVITY_FULL_VALUE_MONTHS) / (LONGEVITY_FULL_VALUE_MONTHS * 3))
  );

  // Combine survival rate (60%) + longevity (40%)
  const kCv_r = clamp(survival_rate * 0.60 + longevity_score * 0.40);

  trace.push({
    component: "kCv_r",
    source_type: "JournalFact",
    source_id: `survival_history:${molecule_id}`,
    contribution: kCv_r,
    note: `survival_rate=${survival_rate.toFixed(3)} (${survived}/${total_resolved}), longevity=${longevity_months.toFixed(1)}m, longevity_score=${longevity_score.toFixed(3)}`,
  });

  return { score: kCv_r, longevity_months };
}

// ─────────────────────────────────────────────
// kCvRank — LINEAGE AUTHORITY
// Projection source: ancestor kCv_r scores + domain trust
// Recursive: each ancestor contributes damped by depth and lineage type
// ─────────────────────────────────────────────

async function projectKCvRank(
  molecule_id: string,
  parent_molecule_ids: string[],
  lineage_types: string[],
  allMolecules: any[],
  allFacts: any[],
  allObservations: any[],
  depth: number = 1,
  visited: Set<string> = new Set(),
  trace: any[]
): Promise<number> {

  if (depth > 4) return 0; // max recursion depth
  if (visited.has(molecule_id)) return 0;
  visited.add(molecule_id);

  if (parent_molecule_ids.length === 0) return 0;

  let rank = 0;

  for (let i = 0; i < parent_molecule_ids.length; i++) {
    const parent_id = parent_molecule_ids[i];
    const lineage_type = lineage_types?.[i] ?? "secondary_citation";
    const lineage_weight = LINEAGE_WEIGHTS[lineage_type] ?? 0.1;

    // Find parent molecule
    const parent = allMolecules.find((m: any) => m.molecule_id === parent_id);
    if (!parent) continue;

    // Get parent's domain damping factor
    const damping = parent.damping_factor ?? DEFAULT_DAMPING;
    const depth_attenuation = Math.pow(damping, depth - 1);

    // Compute parent's kCv_r (its survival score contributes to our rank)
    // We project it rather than reading from DB (pure journal projection)
    const parent_kCv_v_result = await projectVerification(parent_id, allFacts, []);
    const parent_kCv_r_result = await projectResilience(
      parent_id, allFacts,
      parent.current_state ?? "CREATED",
      parent.state_since ?? parent.created_date,
      parent_kCv_v_result.score, []
    );

    const parent_kCv_r = parent_kCv_r_result.score;
    const contribution = parent_kCv_r * lineage_weight * depth_attenuation;
    rank += contribution;

    trace.push({
      component: "kCvRank",
      source_type: "JournalFact",
      source_id: `ancestor:${parent_id}`,
      contribution,
      note: `depth=${depth}, lineage_type=${lineage_type}, parent_kCv_r=${parent_kCv_r.toFixed(3)}, attenuation=${depth_attenuation.toFixed(3)}`,
    });

    // Recurse into parent's lineage
    if (parent.parent_molecule_ids?.length > 0) {
      rank += await projectKCvRank(
        parent_id,
        parent.parent_molecule_ids ?? [],
        parent.lineage_types ?? [],
        allMolecules, allFacts, allObservations,
        depth + 1, visited, trace
      );
    }
  }

  return clamp(rank);
}

// ─────────────────────────────────────────────
// AGGREGATE kCv
// Constitutional weighted sum
// Weights from KCV_AGGREGATE_WEIGHTS (v1.0 defaults)
// In production these are versioned governance molecules
// ─────────────────────────────────────────────

function computeAggregate(components: {
  kCv_o: number; kCv_u: number; kCv_v: number; kCv_i: number; kCv_r: number;
}): number {
  return clamp(
    components.kCv_o * KCV_AGGREGATE_WEIGHTS.kCv_o +
    components.kCv_u * KCV_AGGREGATE_WEIGHTS.kCv_u +
    components.kCv_v * KCV_AGGREGATE_WEIGHTS.kCv_v +
    components.kCv_i * KCV_AGGREGATE_WEIGHTS.kCv_i +
    components.kCv_r * KCV_AGGREGATE_WEIGHTS.kCv_r
  );
}

// ─────────────────────────────────────────────
// MAIN ACTION: PROJECT KCV
// Full projection for a single molecule
// ─────────────────────────────────────────────

async function projectKCv(payload: any, base44: any): Promise<any> {
  const { molecule_id } = payload;
  if (!molecule_id) return { success: false, error: "molecule_id required" };

  // ── Fetch molecule ────────────────────────────────────────────
  const molecules = await base44.asServiceRole.entities.Molecule.filter({ molecule_id });
  const mol = molecules[0];
  if (!mol) return { success: false, error: `Molecule ${molecule_id} not found` };

  // ── Fetch all relevant journal data ───────────────────────────
  const [allMolecules, allFacts, allObservations] = await Promise.all([
    base44.asServiceRole.entities.Molecule.list(),
    base44.asServiceRole.entities.JournalFact.list(),
    base44.asServiceRole.entities.JournalObservation.list(),
  ]);

  const trace: any[] = [];
  const now = new Date().toISOString();

  // ── Project each component ────────────────────────────────────
  const kCv_o = await projectOriginality(
    molecule_id, mol.canonicalHash,
    mol.parent_molecule_ids ?? [], allMolecules, trace
  );

  const { score: kCv_u, reuse_citations, decision_references } = await projectUtility(
    molecule_id, allObservations, allMolecules, trace
  );

  const { score: kCv_v, quality: kCv_v_quality, survived: survived_challenges, total_challenges } = await projectVerification(
    molecule_id, allFacts, trace
  );

  const { score: kCv_i, outcome_observations } = await projectImpact(
    molecule_id, allFacts, allObservations, kCv_v, trace
  );

  const { score: kCv_r, longevity_months } = await projectResilience(
    molecule_id, allFacts,
    mol.current_state ?? "CREATED",
    mol.state_since ?? mol.created_date,
    kCv_v, trace
  );

  const kCvRank = await projectKCvRank(
    molecule_id,
    mol.parent_molecule_ids ?? [],
    mol.lineage_types ?? [],
    allMolecules, allFacts, allObservations,
    1, new Set<string>(), trace
  );

  const kCv_aggregate = computeAggregate({ kCv_o, kCv_u, kCv_v, kCv_i, kCv_r });

  // ── Evidence gap detection ────────────────────────────────────
  const mol_observations = allObservations.filter((o: any) => o.molecule_id === molecule_id);
  const observation_density = mol_observations.length;
  const evidence_gap_flag = kCv_v === 0 && observation_density < 3;

  const projection: KCvProjection = {
    molecule_id,
    canonicalHash: mol.canonicalHash,
    projected_at: now,
    constitution_version: CONSTITUTION_VERSION,

    kCv_o,
    kCv_u,
    kCv_v,
    kCv_i,
    kCv_r,
    kCvRank,
    kCv_aggregate,

    kCv_v_quality,
    evidence_gap_flag,
    observation_density,

    evidence: {
      survived_challenges,
      total_challenges,
      reuse_citations,
      decision_references,
      outcome_observations,
      longevity_months: Math.round(longevity_months * 10) / 10,
      ancestors_evaluated: (mol.parent_molecule_ids ?? []).length,
    },

    projection_trace: trace,
  };

  return { success: true, projection };
}

// ─────────────────────────────────────────────
// ACTION: PROJECT KCV INDEX
// Aggregate across a set of molecules
// Returns ranked list + system-level kCv health
// ─────────────────────────────────────────────

async function projectKCvIndex(payload: any, base44: any): Promise<any> {
  const { molecule_ids, limit = 50 } = payload;

  // Fetch all data once
  const [allMolecules, allFacts, allObservations] = await Promise.all([
    base44.asServiceRole.entities.Molecule.list(),
    base44.asServiceRole.entities.JournalFact.list(),
    base44.asServiceRole.entities.JournalObservation.list(),
  ]);

  // Use provided IDs or all active molecules
  const targetMolecules = molecule_ids
    ? allMolecules.filter((m: any) => molecule_ids.includes(m.molecule_id))
    : allMolecules
        .filter((m: any) => !["DEPRECATED","REJECTED","SUPERSEDED"].includes(m.current_state))
        .slice(0, limit);

  const projections: any[] = [];

  for (const mol of targetMolecules) {
    const trace: any[] = [];
    const kCv_o = await projectOriginality(mol.molecule_id, mol.canonicalHash, mol.parent_molecule_ids ?? [], allMolecules, trace);
    const { score: kCv_u } = await projectUtility(mol.molecule_id, allObservations, allMolecules, trace);
    const { score: kCv_v, quality } = await projectVerification(mol.molecule_id, allFacts, trace);
    const { score: kCv_i } = await projectImpact(mol.molecule_id, allFacts, allObservations, kCv_v, trace);
    const { score: kCv_r, longevity_months } = await projectResilience(mol.molecule_id, allFacts, mol.current_state ?? "CREATED", mol.state_since ?? mol.created_date, kCv_v, trace);
    const kCv_aggregate = computeAggregate({ kCv_o, kCv_u, kCv_v, kCv_i, kCv_r });

    projections.push({
      molecule_id: mol.molecule_id,
      current_state: mol.current_state,
      kCv_o, kCv_u, kCv_v, kCv_i, kCv_r,
      kCv_aggregate,
      kCv_v_quality: quality,
      longevity_months,
    });
  }

  // Sort by aggregate descending
  projections.sort((a, b) => b.kCv_aggregate - a.kCv_aggregate);

  // System-level kCv health
  const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const kCv_system = {
    mean_aggregate: avg(projections.map(p => p.kCv_aggregate)),
    mean_verification: avg(projections.map(p => p.kCv_v)),
    mean_resilience:   avg(projections.map(p => p.kCv_r)),
    verified_count:    projections.filter(p => p.kCv_v > 0).length,
    unverified_count:  projections.filter(p => p.kCv_v === 0).length,
    strong_count:      projections.filter(p => p.kCv_v_quality === "STRONG").length,
    total_projected:   projections.length,
  };

  return { success: true, projections, kCv_system, projected_at: new Date().toISOString() };
}

// ─────────────────────────────────────────────
// ACTION: PROJECT KCV VELOCITY
// Rate of kCv generation over a time window
// ─────────────────────────────────────────────

async function projectKCvVelocity(payload: any, base44: any): Promise<any> {
  const { window_days = 30 } = payload;
  const window_start = new Date(Date.now() - window_days * 24 * 60 * 60 * 1000).toISOString();

  const allFacts = await base44.asServiceRole.entities.JournalFact.list();

  // Facts in window
  const recent_facts = allFacts.filter((f: any) => f.created_date >= window_start);

  // Constitutional-weight facts are the primary velocity signal
  const constitutional_facts = recent_facts.filter((f: any) => f.weight_class === "constitutional");
  const positive_facts = recent_facts.filter((f: any) => f.polarity === 1);
  const negative_facts = recent_facts.filter((f: any) => f.polarity === -1);

  // Verification events = molecules gaining verified status
  const verification_events = recent_facts.filter((f: any) =>
    ["survived_challenge","governance_approved"].includes(f.fact_type)
  );

  // Net kCv velocity = positive constitutional facts - negative constitutional facts
  const positive_constitutional = constitutional_facts.filter((f: any) => f.polarity === 1).length;
  const negative_constitutional = constitutional_facts.filter((f: any) => f.polarity === -1).length;
  const net_velocity = positive_constitutional - negative_constitutional;

  return {
    success: true,
    window_days,
    window_start,
    kCv_velocity: {
      net: net_velocity,
      positive_constitutional_facts: positive_constitutional,
      negative_constitutional_facts: negative_constitutional,
      total_facts_in_window: recent_facts.length,
      verification_events: verification_events.length,
      positive_to_negative_ratio: negative_constitutional > 0
        ? (positive_constitutional / negative_constitutional).toFixed(2)
        : positive_constitutional > 0 ? "∞" : "0",
    },
    projected_at: new Date().toISOString(),
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

    if (action === "project_kcv")          return Response.json(await projectKCv(payload, base44));
    if (action === "project_kcv_index")    return Response.json(await projectKCvIndex(payload, base44));
    if (action === "project_kcv_velocity") return Response.json(await projectKCvVelocity(payload, base44));

    return Response.json({
      error: `Unknown action: ${action}`,
      valid_actions: ["project_kcv","project_kcv_index","project_kcv_velocity"],
    }, { status: 400 });

  } catch (err: any) {
    return Response.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
});
