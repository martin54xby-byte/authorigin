// AuthOrigin — CER State Machine Engine
// Constitution v1.0 — June 22, 2026
// Enforces all valid state transitions and produces JournalFacts

import crypto from "node:crypto";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type MoleculeState =
  | "CREATED" | "EXPLORED" | "COLLAPSING" | "UNDER_GOVERNANCE"
  | "VERIFIED_WEAK" | "VERIFIED_STRONG" | "MATERIALISED" | "REINFORCED"
  | "SUPERSEDED" | "CONTEXTUAL" | "DEPRECATED" | "REJECTED";

export type TransitionTrigger =
  | "first_citation"          // CREATED → EXPLORED
  | "challenge_raised"        // any active → COLLAPSING
  | "mandatory_review"        // EXPLORED (C-6) → COLLAPSING
  | "governance_invoked"      // COLLAPSING → UNDER_GOVERNANCE
  | "governance_approved_no_challenge"  // UNDER_GOVERNANCE → VERIFIED_WEAK
  | "survived_challenge"      // UNDER_GOVERNANCE → VERIFIED_STRONG
  | "impact_observed"         // VERIFIED_* → MATERIALISED
  | "reinforcement_confirmed" // MATERIALISED → REINFORCED
  | "supersession"            // REINFORCED|VERIFIED_* → SUPERSEDED
  | "contextualisation"       // REINFORCED|VERIFIED_* → CONTEXTUAL
  | "deprecation"             // any non-terminal → DEPRECATED
  | "rejection"               // UNDER_GOVERNANCE → REJECTED
  | "challenge_withdrawn";    // COLLAPSING → prior state

export type PropagationStatus = "PROVISIONAL" | "WEAKENED" | "NOTED" | "CLEAR";

export interface TransitionRequest {
  molecule_id: string;
  canonicalHash: string;
  current_state: MoleculeState;
  trigger: TransitionTrigger;
  actor_id: string;
  actor_domain_id: string;
  actor_trust_score: number;
  governance_ref_id?: string;
  challenge_id?: string;
  challenge_quality_score?: number;
  survival_type?: "intact" | "refined" | "strengthened";
  successor_id?: string;
  scope_definition?: string;
  observation_refs?: string[];
  prior_entry_hash: string;
  journal_sequence: number;
  constitution_version: string;
}

export interface TransitionResult {
  valid: boolean;
  new_state?: MoleculeState;
  fact?: JournalFact;
  error?: string;
  invariant_violated?: string;
}

export interface JournalFact {
  fact_id: string;
  molecule_id: string;
  canonicalHash: string;
  fact_type: string;
  weight_class: "constitutional" | "operational";
  polarity: 1 | 0 | -1;
  from_state: MoleculeState;
  to_state: MoleculeState;
  governance_ref_id?: string;
  observation_refs?: string[];
  challenge_id?: string;
  challenge_quality_score?: number;
  survival_type?: string;
  successor_id?: string;
  scope_definition?: string;
  actor_id: string;
  actor_domain_id: string;
  actor_trust_score: number;  // FROZEN at creation — C-8
  constitution_version: string;
  journal_sequence: number;
  fact_hash: string;
  prior_entry_hash: string;
}

// ─────────────────────────────────────────────
// VALID TRANSITION MAP
// Each trigger defines: allowed from-states, to-state, weight class
// ─────────────────────────────────────────────

const TRANSITION_MAP: Record<TransitionTrigger, {
  from: MoleculeState[];
  to: MoleculeState;
  fact_type: string;
  weight_class: "constitutional" | "operational";
  polarity: 1 | 0 | -1;
  requires_governance: boolean;
}> = {
  first_citation: {
    from: ["CREATED"],
    to: "EXPLORED",
    fact_type: "state_transition",
    weight_class: "operational",
    polarity: 1,
    requires_governance: false,
  },
  challenge_raised: {
    from: ["EXPLORED", "VERIFIED_WEAK", "VERIFIED_STRONG", "MATERIALISED", "REINFORCED"],
    to: "COLLAPSING",
    fact_type: "state_transition",
    weight_class: "constitutional",
    polarity: -1,
    requires_governance: false,  // challenge_raised is a fact, not a governance record
  },
  mandatory_review: {
    from: ["EXPLORED"],
    to: "COLLAPSING",
    fact_type: "state_transition",
    weight_class: "constitutional",
    polarity: 0,
    requires_governance: false,  // C-6 automated trigger
  },
  governance_invoked: {
    from: ["COLLAPSING"],
    to: "UNDER_GOVERNANCE",
    fact_type: "state_transition",
    weight_class: "constitutional",
    polarity: 0,
    requires_governance: true,
  },
  governance_approved_no_challenge: {
    from: ["UNDER_GOVERNANCE"],
    to: "VERIFIED_WEAK",
    fact_type: "governance_approved",
    weight_class: "constitutional",
    polarity: 1,
    requires_governance: true,
  },
  survived_challenge: {
    from: ["UNDER_GOVERNANCE"],
    to: "VERIFIED_STRONG",
    fact_type: "survived_challenge",
    weight_class: "constitutional",
    polarity: 1,
    requires_governance: true,
  },
  impact_observed: {
    from: ["VERIFIED_WEAK", "VERIFIED_STRONG"],
    to: "MATERIALISED",
    fact_type: "state_transition",
    weight_class: "operational",
    polarity: 1,
    requires_governance: false,
  },
  reinforcement_confirmed: {
    from: ["MATERIALISED"],
    to: "REINFORCED",
    fact_type: "state_transition",
    weight_class: "constitutional",
    polarity: 1,
    requires_governance: true,
  },
  supersession: {
    from: ["REINFORCED", "VERIFIED_WEAK", "VERIFIED_STRONG", "MATERIALISED", "CONTEXTUAL"],
    to: "SUPERSEDED",
    fact_type: "superseded",
    weight_class: "constitutional",
    polarity: 0,
    requires_governance: true,
  },
  contextualisation: {
    from: ["REINFORCED", "VERIFIED_WEAK", "VERIFIED_STRONG", "MATERIALISED"],
    to: "CONTEXTUAL",
    fact_type: "state_transition",
    weight_class: "constitutional",
    polarity: 0,
    requires_governance: true,
  },
  deprecation: {
    from: ["CREATED", "EXPLORED", "COLLAPSING", "UNDER_GOVERNANCE",
           "VERIFIED_WEAK", "VERIFIED_STRONG", "MATERIALISED", "REINFORCED", "CONTEXTUAL"],
    to: "DEPRECATED",
    fact_type: "deprecated",
    weight_class: "constitutional",
    polarity: -1,
    requires_governance: true,
  },
  rejection: {
    from: ["UNDER_GOVERNANCE"],
    to: "REJECTED",
    fact_type: "rejected",
    weight_class: "constitutional",
    polarity: -1,
    requires_governance: true,
  },
  challenge_withdrawn: {
    // Returns to the state before the challenge — caller must pass correct from/to
    from: ["COLLAPSING"],
    to: "EXPLORED",  // default rollback — will be overridden by caller if different
    fact_type: "state_transition",
    weight_class: "constitutional",
    polarity: 0,
    requires_governance: true,
  },
};

// Terminal states — no further transitions permitted
const TERMINAL_STATES: MoleculeState[] = ["SUPERSEDED", "DEPRECATED", "REJECTED"];

// States requiring VERIFIED_STRONG (kCv_v gates kCv_i and kCv_r — C-2)
const VERIFICATION_GATED_STATES: MoleculeState[] = ["MATERIALISED", "REINFORCED"];

// ─────────────────────────────────────────────
// CONSTITUTIONAL INVARIANT CHECKS
// ─────────────────────────────────────────────

function checkInvariants(req: TransitionRequest): string | null {
  const rule = TRANSITION_MAP[req.trigger];

  // C-1: Cannot transition to a state that implies Realised Contribution
  // without governance backing
  if (VERIFICATION_GATED_STATES.includes(rule.to)) {
    if (!req.governance_ref_id) {
      return "C-2: Transition to MATERIALISED or REINFORCED requires governance_ref_id — kCv_v gates progression";
    }
  }

  // C-3 / C-5: survived_challenge requires challenge_quality_score and challenge_id
  if (req.trigger === "survived_challenge") {
    if (!req.challenge_id) {
      return "C-5: survived_challenge fact requires challenge_id — VERIFIED_STRONG cannot be produced without a challenge on record";
    }
    if (req.challenge_quality_score === undefined || req.challenge_quality_score <= 0) {
      return "C-9: survived_challenge requires challenge_quality_score > 0 computed from C-9 formula";
    }
    if (!req.governance_ref_id) {
      return "C-5: survived_challenge requires governance_ref_id — independent resolution authority required";
    }
  }

  // C-8: Facts cannot be produced without a sequence number
  if (!req.journal_sequence || req.journal_sequence < 1) {
    return "C-8: journal_sequence must be a positive integer — no gaps permitted in the sequence";
  }

  // C-11: constitution_version is mandatory
  if (!req.constitution_version) {
    return "C-11: constitution_version is mandatory on every JournalFact";
  }

  // Supersession requires successor_id
  if (req.trigger === "supersession" && !req.successor_id) {
    return "Constitutional: supersession fact requires successor_id — the replacement molecule must be declared";
  }

  // Contextualisation requires scope_definition
  if (req.trigger === "contextualisation" && !req.scope_definition) {
    return "Constitutional: contextualisation fact requires scope_definition — the applicable scope must be declared";
  }

  // Governance-required transitions need governance_ref_id
  if (rule.requires_governance && !req.governance_ref_id) {
    return `Constitutional: transition via ${req.trigger} requires governance_ref_id — this is a constitutional-weight transition`;
  }

  return null; // all invariants satisfied
}

// ─────────────────────────────────────────────
// HASH CHAIN
// ─────────────────────────────────────────────

function computeFactHash(fact: Omit<JournalFact, "fact_hash">, prior_entry_hash: string): string {
  const content = JSON.stringify({
    fact_id: fact.fact_id,
    molecule_id: fact.molecule_id,
    canonicalHash: fact.canonicalHash,
    fact_type: fact.fact_type,
    from_state: fact.from_state,
    to_state: fact.to_state,
    actor_id: fact.actor_id,
    actor_trust_score: fact.actor_trust_score,
    journal_sequence: fact.journal_sequence,
    constitution_version: fact.constitution_version,
    prior_entry_hash,
  });
  return crypto.createHash("sha256").update(content).digest("hex");
}

function generateFactId(molecule_id: string, sequence: number): string {
  const raw = `fact:${molecule_id}:${sequence}:${Date.now()}`;
  return crypto.createHash("sha256").update(raw).digest("hex").substring(0, 24);
}

// ─────────────────────────────────────────────
// CORE STATE MACHINE — TRANSITION EXECUTOR
// ─────────────────────────────────────────────

export function executeTransition(req: TransitionRequest): TransitionResult {
  const rule = TRANSITION_MAP[req.trigger];

  // 1. Check trigger exists
  if (!rule) {
    return { valid: false, error: `Unknown transition trigger: ${req.trigger}` };
  }

  // 2. Check terminal state
  if (TERMINAL_STATES.includes(req.current_state)) {
    return {
      valid: false,
      error: `Molecule is in terminal state ${req.current_state} — no further transitions permitted`,
    };
  }

  // 3. Check valid from-state
  if (!rule.from.includes(req.current_state)) {
    return {
      valid: false,
      error: `Invalid transition: ${req.current_state} → ${rule.to} via ${req.trigger}. ` +
             `Valid from-states: ${rule.from.join(", ")}`,
    };
  }

  // 4. Check all constitutional invariants
  const invariantViolation = checkInvariants(req);
  if (invariantViolation) {
    return {
      valid: false,
      error: invariantViolation,
      invariant_violated: invariantViolation,
    };
  }

  // 5. Determine actual to_state
  // challenge_withdrawn returns to the appropriate prior state
  let to_state = rule.to;
  if (req.trigger === "challenge_withdrawn") {
    // Caller is responsible for providing the rollback target
    // Default is EXPLORED — in practice caller will specify
    to_state = "EXPLORED";
  }

  // 6. Build the JournalFact
  const fact_id = generateFactId(req.molecule_id, req.journal_sequence);

  const factWithoutHash: Omit<JournalFact, "fact_hash"> = {
    fact_id,
    molecule_id: req.molecule_id,
    canonicalHash: req.canonicalHash,
    fact_type: rule.fact_type,
    weight_class: rule.weight_class,
    polarity: rule.polarity,
    from_state: req.current_state,
    to_state,
    governance_ref_id: req.governance_ref_id,
    observation_refs: req.observation_refs ?? [],
    challenge_id: req.challenge_id,
    challenge_quality_score: req.challenge_quality_score,
    survival_type: req.survival_type,
    successor_id: req.successor_id,
    scope_definition: req.scope_definition,
    actor_id: req.actor_id,
    actor_domain_id: req.actor_domain_id,
    actor_trust_score: req.actor_trust_score,  // FROZEN at this moment — never changes
    constitution_version: req.constitution_version,
    journal_sequence: req.journal_sequence,
    prior_entry_hash: req.prior_entry_hash,
  };

  const fact_hash = computeFactHash(factWithoutHash, req.prior_entry_hash);
  const fact: JournalFact = { ...factWithoutHash, fact_hash };

  return {
    valid: true,
    new_state: to_state,
    fact,
  };
}

// ─────────────────────────────────────────────
// C-6 MANDATORY REVIEW CHECK
// ─────────────────────────────────────────────

export function checkMandatoryReview(
  current_state: MoleculeState,
  reuse_count: number,
  state_since: string,  // ISO timestamp
  now: Date = new Date()
): { mandatory_review_required: boolean; reason?: string } {
  if (current_state !== "EXPLORED") {
    return { mandatory_review_required: false };
  }

  const N_THRESHOLD = 50;   // C-6 constitutional threshold
  const T_MONTHS = 24;      // C-6 constitutional threshold

  const since = new Date(state_since);
  const monthsElapsed = (now.getTime() - since.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

  const reuse_met = reuse_count >= N_THRESHOLD;
  const age_met = monthsElapsed >= T_MONTHS;

  if (reuse_met && age_met) {
    return {
      mandatory_review_required: true,
      reason: `C-6: molecule has ${reuse_count} citing molecules (≥${N_THRESHOLD}) ` +
              `and has been EXPLORED for ${monthsElapsed.toFixed(1)} months (≥${T_MONTHS}) ` +
              `without challenge — mandatory governance review required`,
    };
  }

  return { mandatory_review_required: false };
}

// ─────────────────────────────────────────────
// C-7 PROPAGATION ENGINE
// Computes what propagation status a molecule inherits
// from a challenged ancestor at a given depth
// ─────────────────────────────────────────────

export function computePropagationStatus(
  depth: number,
  is_foundational: boolean
): PropagationStatus {
  if (depth <= 0) return "CLEAR";
  if (depth === 1) return "PROVISIONAL";
  if (depth === 2) return "WEAKENED";
  // depth 3+: NOTED flat — C-7
  // FOUNDATIONAL exception: NOTED propagates indefinitely regardless of depth
  if (depth >= 3) return "NOTED";
  return "CLEAR";
}

export function shouldPropagateToDepth(
  depth: number,
  is_foundational: boolean
): boolean {
  // For foundational molecules, propagation always continues (NOTED indefinitely)
  if (is_foundational) return true;
  // For non-foundational, stop at depth 3 (NOTED is still recorded, just flat)
  // We propagate to depth 3 maximum, beyond that we stop
  return depth <= 3;
}

// ─────────────────────────────────────────────
// C-9 CHALLENGE QUALITY SCORE CALCULATOR
// ─────────────────────────────────────────────

export function computeChallengeQualityScore(
  challenger_trust_score: number,
  challenge_evidence_depth: number,
  challenge_novelty: number,
  challenger_challenge_history: number
): number {
  // C-9: trust(0.40) + evidence(0.30) + novelty(0.20) + history(0.10)
  // All inputs normalised 0.0-1.0
  const score =
    (challenger_trust_score        * 0.40) +
    (challenge_evidence_depth      * 0.30) +
    (challenge_novelty             * 0.20) +
    (challenger_challenge_history  * 0.10);

  return Math.min(1.0, Math.max(0.0, score));
}

// ─────────────────────────────────────────────
// kCvRANK CALCULATOR
// Computes lineage authority score from ancestor survival history
// ─────────────────────────────────────────────

const LINEAGE_WEIGHTS: Record<string, number> = {
  direct_inheritance:   1.0,
  primary_citation:     0.8,
  decision_reference:   0.7,
  secondary_citation:   0.4,
  tangential_mention:   0.1,
};

export function computeKCvRank(
  ancestors: Array<{
    molecule_id: string;
    kCv_r_score: number;
    lineage_type: string;
    depth: number;
    domain_damping_factor?: number;
  }>
): number {
  const DEFAULT_DAMPING = 0.6;  // Constitutional default

  let rank = 0;

  for (const ancestor of ancestors) {
    const damping = ancestor.domain_damping_factor ?? DEFAULT_DAMPING;
    const lineage_weight = LINEAGE_WEIGHTS[ancestor.lineage_type] ?? 0.1;
    const depth_attenuation = Math.pow(damping, ancestor.depth - 1);
    rank += ancestor.kCv_r_score * lineage_weight * depth_attenuation;
  }

  return Math.min(1.0, Math.max(0.0, rank));
}

// ─────────────────────────────────────────────
// CONSTITUTIONAL COMPLIANCE CHECKER
// Validates a molecule's current state against all active facts
// Returns violations if any
// ─────────────────────────────────────────────

export function checkConstitutionalCompliance(molecule: {
  current_state: MoleculeState;
  kCv_v_score: number;
  kCv_v_quality?: string;
  kCv_i_score?: number;
  kCv_r_score?: number;
  reuse_count: number;
  state_since: string;
  active_challenge_id?: string;
  last_fact_id?: string;
}): { compliant: boolean; violations: string[] } {
  const violations: string[] = [];

  // C-2: kCv_v gates kCv_i and kCv_r
  if ((molecule.kCv_i_score ?? 0) > 0 && (molecule.kCv_v_score ?? 0) === 0) {
    violations.push("C-2: kCv_i > 0 without kCv_v — verification must gate impact score");
  }
  if ((molecule.kCv_r_score ?? 0) > 0 && (molecule.kCv_v_score ?? 0) === 0) {
    violations.push("C-2: kCv_r > 0 without kCv_v — verification must gate resilience score");
  }

  // C-3/C-5: VERIFIED_STRONG requires challenge evidence
  if (molecule.current_state === "VERIFIED_STRONG" && molecule.kCv_v_quality !== "STRONG") {
    violations.push("C-5: molecule in VERIFIED_STRONG state but kCv_v_quality is not STRONG — requires survived_challenge fact");
  }

  // C-6: Mandatory review check
  const mandatoryReview = checkMandatoryReview(
    molecule.current_state,
    molecule.reuse_count,
    molecule.state_since
  );
  if (mandatoryReview.mandatory_review_required) {
    violations.push(`C-6: ${mandatoryReview.reason}`);
  }

  // COLLAPSING must have active_challenge_id
  if (molecule.current_state === "COLLAPSING" && !molecule.active_challenge_id) {
    violations.push("Constitutional: molecule in COLLAPSING state without active_challenge_id");
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}

// ─────────────────────────────────────────────
// CONSTITUTIONAL HEALTH METRICS
// GCPC, ECPC, VRPC
// ─────────────────────────────────────────────

export function computeHealthMetrics(snapshot: {
  total_governance_events: number;
  total_observation_events: number;
  total_contribution_events: number;
  total_payments_to_contributors: number;
}): { gcpc: number; ecpc: number; vrpc: number } {
  const { total_governance_events, total_observation_events,
          total_contribution_events, total_payments_to_contributors } = snapshot;

  const gcpc = total_contribution_events > 0
    ? total_governance_events / total_contribution_events
    : 0;

  const ecpc = total_contribution_events > 0
    ? total_observation_events / total_contribution_events
    : 0;

  const vrpc = total_contribution_events > 0
    ? total_payments_to_contributors / total_contribution_events
    : 0;

  return { gcpc, ecpc, vrpc };
}

// ─────────────────────────────────────────────
// PAYMENT DISTRIBUTION — C-20, C-21, C-22, C-23
// ─────────────────────────────────────────────

export function computePaymentDistribution(
  total_payment: number,
  direct_author_id: string,
  ancestors: Array<{
    molecule_id: string;
    author_id: string;
    kCv_r_score: number;
    lineage_type: string;
    depth: number;
    domain_damping_factor?: number;
  }>
): {
  governance_reserve: number;
  direct_author_share: number;
  lineage_distributions: Array<{ author_id: string; molecule_id: string; share: number }>;
  total_distributed: number;
} {
  const RESERVE_RATE = 0.12;  // C-23 constitutional parameter
  const DEFAULT_DAMPING = 0.6;

  const governance_reserve = total_payment * RESERVE_RATE;
  const distributable = total_payment - governance_reserve;

  const direct_author_share = distributable * 0.50;
  const lineage_pool = distributable * 0.50;

  // Compute raw lineage weights
  const lineage_raw: Array<{ author_id: string; molecule_id: string; raw_weight: number }> = [];
  let total_raw = 0;

  for (const ancestor of ancestors) {
    const damping = ancestor.domain_damping_factor ?? DEFAULT_DAMPING;
    const lineage_weight = LINEAGE_WEIGHTS[ancestor.lineage_type] ?? 0.1;
    const depth_attenuation = Math.pow(damping, ancestor.depth - 1);
    const raw = ancestor.kCv_r_score * lineage_weight * depth_attenuation;
    lineage_raw.push({ author_id: ancestor.author_id, molecule_id: ancestor.molecule_id, raw_weight: raw });
    total_raw += raw;
  }

  // Normalise to lineage pool
  const lineage_distributions = lineage_raw.map(l => ({
    author_id: l.author_id,
    molecule_id: l.molecule_id,
    share: total_raw > 0 ? (l.raw_weight / total_raw) * lineage_pool : 0,
  }));

  const total_lineage = lineage_distributions.reduce((s, l) => s + l.share, 0);
  const total_distributed = governance_reserve + direct_author_share + total_lineage;

  return {
    governance_reserve,
    direct_author_share,
    lineage_distributions,
    total_distributed,
  };
}

console.log("CER State Machine Engine loaded — Constitution v1.0");
console.log("Exports: executeTransition, checkMandatoryReview, computePropagationStatus,");
console.log("         computeChallengeQualityScore, computeKCvRank,");
console.log("         checkConstitutionalCompliance, computeHealthMetrics,");
console.log("         computePaymentDistribution");
