// AuthOrigin — Challenge Protocol Engine
// Phase 3 — Full challenge lifecycle with C-7 propagation
// Constitution v1.0 — June 22, 2026

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { createHash } from "node:crypto";

// ─────────────────────────────────────────────
// CONSTITUTIONAL PARAMETERS (v1.0, locked)
// ─────────────────────────────────────────────

const CONSTITUTION_VERSION = "v1.0";
const TRUST_FLOOR = 0.1;                    // C-4: no domain trust below this
const C9_WEIGHTS = { trust: 0.40, evidence: 0.30, novelty: 0.20, history: 0.10 };
const DEFAULT_DAMPING = 0.6;               // C-7: lineage attenuation default
const GOVERNANCE_RESERVE_RATE = 0.12;      // C-23

// C-10 escalation tier thresholds
const TIER_THRESHOLDS = {
  TIER_0_MAX_REUSE: 10,      // autonomous — low-reach molecule
  TIER_1_MAX_REUSE: 50,      // threshold-triggered
  TIER_2_MAX_REUSE: 200,     // human required
  // above 200 or foundational → Tier 3: constitutional quorum
};

// Propagation depth labels per C-7
const PROPAGATION_STATUS_AT_DEPTH: Record<number, string> = {
  1: "PROVISIONAL",
  2: "WEAKENED",
};
function propagationStatusAtDepth(depth: number): string {
  return PROPAGATION_STATUS_AT_DEPTH[depth] ?? "NOTED";
}

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

function generateId(prefix: string, ...parts: string[]): string {
  const raw = `${prefix}:${parts.join(":")}:${Date.now()}:${Math.random()}`;
  return createHash("sha256").update(raw).digest("hex").substring(0, 24);
}

function computeHash(...parts: any[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function computeC9Score(
  challenger_trust: number,
  evidence_depth: number,
  novelty: number,
  history: number
): number {
  return Math.min(1.0, Math.max(0.0,
    challenger_trust * C9_WEIGHTS.trust +
    evidence_depth   * C9_WEIGHTS.evidence +
    novelty          * C9_WEIGHTS.novelty +
    history          * C9_WEIGHTS.history
  ));
}

function determineEscalationTier(
  reuse_count: number,
  is_foundational: boolean,
  challenge_quality_score: number
): number {
  if (is_foundational) return 3;                           // C-7 exception: always quorum
  if (reuse_count > TIER_THRESHOLDS.TIER_2_MAX_REUSE) return 3;
  if (reuse_count > TIER_THRESHOLDS.TIER_1_MAX_REUSE) return 2;
  if (reuse_count > TIER_THRESHOLDS.TIER_0_MAX_REUSE) return 1;
  if (challenge_quality_score > 0.85) return 1;           // High-quality challenge escalates
  return 0;
}

// ─────────────────────────────────────────────
// ACTION 1: RAISE CHALLENGE
// Validates eligibility, computes C-9, writes GovernanceRecord,
// transitions molecule to COLLAPSING, fires C-7 propagation
// ─────────────────────────────────────────────

async function raiseChallenge(payload: any, base44: any): Promise<any> {
  const {
    molecule_id,
    molecule_db_id,
    canonicalHash,
    current_state,
    challenger_id,
    challenger_domain_id,
    challenger_trust_score,
    challenge_type,
    challenge_evidence_depth,
    challenge_novelty,
    challenge_evidence_hash,
    challenge_rationale,
    observation_refs = [],
    reuse_count = 0,
    is_foundational = false,
    parent_molecule_ids = [],
    prior_entry_hash,
    journal_sequence,
  } = payload;

  // ── Eligibility checks ───────────────────────────────────────
  if (!molecule_id) return { success: false, error: "molecule_id is required" };
  if (!challenger_id) return { success: false, error: "challenger_id is required" };
  if ((challenger_trust_score ?? 0) < TRUST_FLOOR)
    return { success: false, error: `C-4: challenger trust score ${challenger_trust_score} is below constitutional floor ${TRUST_FLOOR}` };

  const challengeable = ["EXPLORED","VERIFIED_WEAK","VERIFIED_STRONG","MATERIALISED","REINFORCED"];
  if (!challengeable.includes(current_state))
    return { success: false, error: `Constitutional: molecule in state ${current_state} cannot be challenged. Challengeable states: ${challengeable.join(", ")}` };

  if (!journal_sequence || journal_sequence < 1)
    return { success: false, error: "C-8: journal_sequence must be a positive integer" };

  // ── Retrieve challenger domain history ────────────────────────
  const domains = await base44.asServiceRole.entities.Domain.filter({ domain_id: challenger_domain_id });
  const challengerDomain = domains[0];
  const challenge_history = challengerDomain
    ? (challengerDomain.challenges_upheld ?? 0) /
      Math.max(1, challengerDomain.challenges_raised ?? 1)
    : 0.5; // default for new domains

  // ── C-9 quality score ─────────────────────────────────────────
  const challenge_quality_score = computeC9Score(
    challenger_trust_score,
    challenge_evidence_depth ?? 0.5,
    challenge_novelty ?? 0.5,
    challenge_history
  );

  // ── Escalation tier ───────────────────────────────────────────
  const escalation_tier = determineEscalationTier(reuse_count, is_foundational, challenge_quality_score);

  // ── Generate IDs ──────────────────────────────────────────────
  const challenge_id = generateId("challenge", molecule_id, challenger_id);
  const governance_id = generateId("gov", challenge_id, "raised");
  const fact_id       = generateId("fact", molecule_id, String(journal_sequence));

  const now = new Date().toISOString();

  // ── Write JournalGovernanceRecord: challenge_raised ───────────
  const govRecord = {
    governance_id,
    molecule_id,
    governance_type: "challenge_raised",
    challenge_type: challenge_type ?? "factual",
    challenge_status: "OPEN",
    resolution: null,
    challenge_quality_score,
    challenger_trust_score,
    challenge_evidence_depth: challenge_evidence_depth ?? 0.5,
    challenge_novelty: challenge_novelty ?? 0.5,
    challenger_challenge_history: challenge_history,
    observation_refs,
    actor_id: challenger_id,
    actor_domain_id: challenger_domain_id,
    actor_trust_score: challenger_trust_score,  // FROZEN
    challenger_id,
    challenger_domain_id,
    quorum_domains: [],
    quorum_threshold: escalation_tier >= 3 ? 3 : escalation_tier >= 2 ? 2 : 1,
    evidence_payload_hash: challenge_evidence_hash ?? computeHash(challenge_rationale),
    resolution_rationale: null,
    resulting_fact_id: null,
    escalation_tier,
    constitution_version: CONSTITUTION_VERSION,
    journal_sequence,
    governance_hash: computeHash(governance_id, molecule_id, "challenge_raised", challenger_id, journal_sequence, prior_entry_hash),
    prior_entry_hash,
  };

  await base44.asServiceRole.entities.JournalGovernanceRecord.create(govRecord);

  // ── Write JournalFact: state_transition COLLAPSING ────────────
  const factHash = computeHash(fact_id, molecule_id, canonicalHash, "state_transition", current_state, "COLLAPSING", challenger_id, challenger_trust_score, journal_sequence + 1, CONSTITUTION_VERSION, prior_entry_hash);

  const collapsingFact = {
    fact_id,
    molecule_id,
    canonicalHash,
    fact_type: "state_transition",
    weight_class: "constitutional",
    polarity: -1,
    from_state: current_state,
    to_state: "COLLAPSING",
    governance_ref_id: governance_id,
    observation_refs,
    challenge_id,
    actor_id: challenger_id,
    actor_domain_id: challenger_domain_id,
    actor_trust_score: challenger_trust_score,  // FROZEN
    constitution_version: CONSTITUTION_VERSION,
    journal_sequence: journal_sequence + 1,
    fact_hash: factHash,
    prior_entry_hash: govRecord.governance_hash,
  };

  await base44.asServiceRole.entities.JournalFact.create(collapsingFact);

  // ── Update Molecule state → COLLAPSING ────────────────────────
  if (molecule_db_id) {
    await base44.asServiceRole.entities.Molecule.update(molecule_db_id, {
      current_state: "COLLAPSING",
      state_since: now,
      active_challenge_id: challenge_id,
      last_fact_id: fact_id,
      constitutional_status: "COMPLIANT",
    });
  }

  // ── C-7: propagate challenge pressure to dependents ───────────
  const propagationResults = await propagateChallengePressure({
    source_molecule_id: molecule_id,
    challenge_id,
    is_foundational,
    damping_factor: DEFAULT_DAMPING,
    propagation_type: "challenge_pressure",
    base_journal_sequence: journal_sequence + 2,
    prior_entry_hash: factHash,
    base44,
  });

  // ── Update domain challenge count ─────────────────────────────
  if (challengerDomain) {
    await base44.asServiceRole.entities.Domain.update(challengerDomain.id, {
      challenges_raised: (challengerDomain.challenges_raised ?? 0) + 1,
      last_activity_date: now,
    });
  }

  return {
    success: true,
    challenge_id,
    governance_id,
    fact_id,
    new_state: "COLLAPSING",
    challenge_quality_score,
    escalation_tier,
    escalation_tier_label: ["autonomous","threshold-triggered","human required","constitutional quorum"][escalation_tier],
    propagation_count: propagationResults.affected_molecules,
    requires_human_review: escalation_tier >= 2,
    requires_quorum: escalation_tier >= 3,
  };
}

// ─────────────────────────────────────────────
// ACTION 2: INVOKE GOVERNANCE
// Escalates COLLAPSING → UNDER_GOVERNANCE
// Assembles quorum if required
// ─────────────────────────────────────────────

async function invokeGovernance(payload: any, base44: any): Promise<any> {
  const {
    molecule_id,
    molecule_db_id,
    canonicalHash,
    challenge_id,
    governance_id_challenge_raised,
    actor_id,
    actor_domain_id,
    actor_trust_score,
    quorum_domains = [],
    prior_entry_hash,
    journal_sequence,
  } = payload;

  if (!challenge_id) return { success: false, error: "challenge_id is required" };
  if (!journal_sequence || journal_sequence < 1) return { success: false, error: "C-8: journal_sequence required" };

  // ── Retrieve challenge record ─────────────────────────────────
  const govRecords = await base44.asServiceRole.entities.JournalGovernanceRecord.filter({
    governance_id: governance_id_challenge_raised
  });
  const challengeRecord = govRecords[0];
  if (!challengeRecord) return { success: false, error: `Governance record ${governance_id_challenge_raised} not found` };
  if (challengeRecord.challenge_status !== "OPEN")
    return { success: false, error: `Challenge is not OPEN — current status: ${challengeRecord.challenge_status}` };

  const escalation_tier = challengeRecord.escalation_tier ?? 0;
  const quorum_threshold = challengeRecord.quorum_threshold ?? 1;

  // ── Validate quorum if required ────────────────────────────────
  if (escalation_tier >= 3 && quorum_domains.length < quorum_threshold) {
    return {
      success: false,
      error: `C-10: Tier 3 challenge requires quorum of ${quorum_threshold} domains. Provided: ${quorum_domains.length}`,
      quorum_required: quorum_threshold,
      quorum_provided: quorum_domains.length,
    };
  }

  const governance_id = generateId("gov", challenge_id, "invoked");
  const fact_id = generateId("fact", molecule_id, String(journal_sequence));
  const now = new Date().toISOString();

  // ── Write JournalGovernanceRecord: governance_invoked ─────────
  const govInvokedHash = computeHash(governance_id, molecule_id, "governance_invoked", actor_id, journal_sequence, prior_entry_hash);
  const govInvoked = {
    governance_id,
    molecule_id,
    governance_type: "governance_invoked",
    challenge_type: challengeRecord.challenge_type,
    challenge_status: "UNDER_REVIEW",
    challenge_quality_score: challengeRecord.challenge_quality_score,
    challenger_trust_score: challengeRecord.challenger_trust_score,
    challenge_evidence_depth: challengeRecord.challenge_evidence_depth,
    challenge_novelty: challengeRecord.challenge_novelty,
    challenger_challenge_history: challengeRecord.challenger_challenge_history,
    observation_refs: challengeRecord.observation_refs ?? [],
    actor_id,
    actor_domain_id,
    actor_trust_score,  // FROZEN
    challenger_id: challengeRecord.challenger_id,
    challenger_domain_id: challengeRecord.challenger_domain_id,
    quorum_domains,
    quorum_threshold,
    evidence_payload_hash: challengeRecord.evidence_payload_hash,
    resolution_rationale: null,
    resulting_fact_id: null,
    escalation_tier,
    constitution_version: CONSTITUTION_VERSION,
    journal_sequence,
    governance_hash: govInvokedHash,
    prior_entry_hash,
  };

  await base44.asServiceRole.entities.JournalGovernanceRecord.create(govInvoked);

  // ── Write JournalFact: COLLAPSING → UNDER_GOVERNANCE ─────────
  const factHash = computeHash(fact_id, molecule_id, "state_transition", "COLLAPSING", "UNDER_GOVERNANCE", actor_id, journal_sequence + 1, CONSTITUTION_VERSION, govInvokedHash);
  const transitionFact = {
    fact_id,
    molecule_id,
    canonicalHash,
    fact_type: "state_transition",
    weight_class: "constitutional",
    polarity: 0,
    from_state: "COLLAPSING",
    to_state: "UNDER_GOVERNANCE",
    governance_ref_id: governance_id,
    observation_refs: [],
    challenge_id,
    actor_id,
    actor_domain_id,
    actor_trust_score,  // FROZEN
    constitution_version: CONSTITUTION_VERSION,
    journal_sequence: journal_sequence + 1,
    fact_hash: factHash,
    prior_entry_hash: govInvokedHash,
  };

  await base44.asServiceRole.entities.JournalFact.create(transitionFact);

  // ── Update challenge record status → UNDER_REVIEW ─────────────
  // (we write a new governance record — we don't mutate the original)

  // ── Update Molecule → UNDER_GOVERNANCE ───────────────────────
  if (molecule_db_id) {
    await base44.asServiceRole.entities.Molecule.update(molecule_db_id, {
      current_state: "UNDER_GOVERNANCE",
      state_since: now,
      last_fact_id: fact_id,
    });
  }

  return {
    success: true,
    governance_id,
    fact_id,
    new_state: "UNDER_GOVERNANCE",
    escalation_tier,
    escalation_tier_label: ["autonomous","threshold-triggered","human required","constitutional quorum"][escalation_tier],
    quorum_assembled: quorum_domains.length > 0,
    quorum_domains,
    awaiting_human_review: escalation_tier >= 2,
  };
}

// ─────────────────────────────────────────────
// ACTION 3: RESOLVE CHALLENGE
// Produces the final constitutional fact
// Updates domain trust scores
// Clears C-7 propagation pressure
// ─────────────────────────────────────────────

async function resolveChallenge(payload: any, base44: any): Promise<any> {
  const {
    molecule_id,
    molecule_db_id,
    canonicalHash,
    challenge_id,
    governance_id_invoked,
    resolution,           // "upheld" | "partially_upheld" | "rejected"
    survival_type,        // "intact" | "refined" | "strengthened" (if upheld)
    resolution_rationale,
    actor_id,
    actor_domain_id,
    actor_trust_score,
    quorum_domains = [],
    is_foundational = false,
    prior_entry_hash,
    journal_sequence,
  } = payload;

  if (!["upheld","partially_upheld","rejected"].includes(resolution))
    return { success: false, error: `resolution must be upheld | partially_upheld | rejected. Got: ${resolution}` };
  if (!journal_sequence || journal_sequence < 1)
    return { success: false, error: "C-8: journal_sequence required" };
  if (resolution === "upheld" && !survival_type)
    return { success: false, error: "survival_type required when resolution is upheld: intact | refined | strengthened" };

  // ── Retrieve governance record ─────────────────────────────────
  const govRecords = await base44.asServiceRole.entities.JournalGovernanceRecord.filter({
    governance_id: governance_id_invoked
  });
  const govRecord = govRecords[0];
  if (!govRecord) return { success: false, error: `Governance record ${governance_id_invoked} not found` };

  const challenge_quality_score = govRecord.challenge_quality_score ?? 0;
  const challenger_id = govRecord.challenger_id;
  const challenger_domain_id = govRecord.challenger_domain_id;

  const now = new Date().toISOString();
  const governance_id = generateId("gov", challenge_id, "resolved");
  const fact_id = generateId("fact", molecule_id, String(journal_sequence));

  // ── Determine outcome ─────────────────────────────────────────
  // upheld         = challenge rejected, molecule SURVIVES → VERIFIED_STRONG
  // partially_upheld = challenge partially accepted, molecule survives → VERIFIED_WEAK
  // rejected       = challenge accepted, molecule FAILS → REJECTED

  const molecule_survives = resolution === "upheld" || resolution === "partially_upheld";
  const new_molecule_state = resolution === "upheld"
    ? "VERIFIED_STRONG"
    : resolution === "partially_upheld"
    ? "VERIFIED_WEAK"
    : "REJECTED";

  const fact_type = resolution === "upheld"
    ? "survived_challenge"
    : resolution === "partially_upheld"
    ? "governance_approved"
    : "rejected";

  // ── Write JournalGovernanceRecord: challenge_resolved ─────────
  const govResolvedHash = computeHash(governance_id, molecule_id, "challenge_resolved", resolution, actor_id, journal_sequence, prior_entry_hash);
  const govResolved = {
    governance_id,
    molecule_id,
    governance_type: "challenge_resolved",
    challenge_type: govRecord.challenge_type,
    challenge_status: "RESOLVED",
    resolution,
    challenge_quality_score,
    challenger_trust_score: govRecord.challenger_trust_score,
    challenge_evidence_depth: govRecord.challenge_evidence_depth,
    challenge_novelty: govRecord.challenge_novelty,
    challenger_challenge_history: govRecord.challenger_challenge_history,
    observation_refs: govRecord.observation_refs ?? [],
    actor_id,
    actor_domain_id,
    actor_trust_score,  // FROZEN
    challenger_id,
    challenger_domain_id,
    quorum_domains,
    quorum_threshold: govRecord.quorum_threshold,
    evidence_payload_hash: govRecord.evidence_payload_hash,
    resolution_rationale,
    resulting_fact_id: fact_id,
    escalation_tier: govRecord.escalation_tier,
    constitution_version: CONSTITUTION_VERSION,
    journal_sequence,
    governance_hash: govResolvedHash,
    prior_entry_hash,
  };

  await base44.asServiceRole.entities.JournalGovernanceRecord.create(govResolved);

  // ── Write constitutional JournalFact ──────────────────────────
  const factHash = computeHash(fact_id, molecule_id, fact_type, "UNDER_GOVERNANCE", new_molecule_state, actor_id, actor_trust_score, journal_sequence + 1, CONSTITUTION_VERSION, govResolvedHash);

  const resolutionFact: any = {
    fact_id,
    molecule_id,
    canonicalHash,
    fact_type,
    weight_class: "constitutional",
    polarity: molecule_survives ? 1 : -1,
    from_state: "UNDER_GOVERNANCE",
    to_state: new_molecule_state,
    governance_ref_id: governance_id,
    observation_refs: govRecord.observation_refs ?? [],
    challenge_id,
    challenge_quality_score,
    actor_id,
    actor_domain_id,
    actor_trust_score,  // FROZEN
    constitution_version: CONSTITUTION_VERSION,
    journal_sequence: journal_sequence + 1,
    fact_hash: factHash,
    prior_entry_hash: govResolvedHash,
  };

  if (molecule_survives) {
    resolutionFact.survival_type = survival_type;
  }

  await base44.asServiceRole.entities.JournalFact.create(resolutionFact);

  // ── Update Molecule state ─────────────────────────────────────
  if (molecule_db_id) {
    const molUpdates: any = {
      current_state: new_molecule_state,
      state_since: now,
      active_challenge_id: null,
      last_fact_id: fact_id,
      constitutional_status: "COMPLIANT",
    };
    if (molecule_survives) {
      molUpdates.kCv_v_quality = resolution === "upheld" ? "STRONG" : "WEAK";
      // Increment kCv_v_score on survival — survival = realised verification
      molUpdates.kCv_v_score = Math.min(1.0, (payload.current_kCv_v_score ?? 0) + (challenge_quality_score * 0.3));
    }
    await base44.asServiceRole.entities.Molecule.update(molecule_db_id, molUpdates);
  }

  // ── Update domain trust scores ────────────────────────────────
  await updateDomainTrustAfterResolution({
    challenger_id, challenger_domain_id,
    resolution, challenge_quality_score,
    molecule_survives,
    base44, now,
  });

  // ── C-7: clear propagation pressure if molecule survived ──────
  let propagationResult = { affected_molecules: 0 };
  if (molecule_survives) {
    propagationResult = await propagateChallengePressure({
      source_molecule_id: molecule_id,
      challenge_id,
      is_foundational,
      damping_factor: DEFAULT_DAMPING,
      propagation_type: "challenge_cleared",
      base_journal_sequence: journal_sequence + 2,
      prior_entry_hash: factHash,
      base44,
    });
  }

  return {
    success: true,
    challenge_id,
    governance_id,
    fact_id,
    resolution,
    new_state: new_molecule_state,
    molecule_survives,
    survival_type: molecule_survives ? survival_type : null,
    kCv_v_quality: molecule_survives ? (resolution === "upheld" ? "STRONG" : "WEAK") : null,
    challenge_quality_score,
    propagation_cleared: molecule_survives ? propagationResult.affected_molecules : 0,
  };
}

// ─────────────────────────────────────────────
// INTERNAL: PROPAGATE CHALLENGE PRESSURE
// Walks the lineage graph from the challenged molecule
// Writes JournalObservation for each dependent at correct depth
// Respects is_foundational exception and domain damping
// ─────────────────────────────────────────────

async function propagateChallengePressure(params: {
  source_molecule_id: string;
  challenge_id: string;
  is_foundational: boolean;
  damping_factor: number;
  propagation_type: "challenge_pressure" | "challenge_cleared";
  base_journal_sequence: number;
  prior_entry_hash: string;
  base44: any;
}): Promise<{ affected_molecules: number; observations: any[] }> {

  const {
    source_molecule_id, challenge_id, is_foundational,
    damping_factor, propagation_type, base_journal_sequence,
    prior_entry_hash, base44,
  } = params;

  const observations: any[] = [];
  const visited = new Set<string>();
  let seq = base_journal_sequence;
  let prev_hash = prior_entry_hash;

  // BFS queue: { molecule_id, depth, db_id }
  const queue: Array<{ molecule_id: string; depth: number; db_id?: string }> = [];

  // Find all molecules that cite the source molecule (dependents)
  const dependents = await base44.asServiceRole.entities.Molecule.filter({
    // molecules whose parent_molecule_ids contains source_molecule_id
    // We filter post-fetch since array-contains isn't available
  });

  // Filter to actual dependents
  const directDependents = (dependents ?? []).filter((m: any) =>
    Array.isArray(m.parent_molecule_ids) &&
    m.parent_molecule_ids.includes(source_molecule_id)
  );

  for (const dep of directDependents) {
    queue.push({ molecule_id: dep.molecule_id, depth: 1, db_id: dep.id });
  }

  while (queue.length > 0) {
    const { molecule_id, depth, db_id } = queue.shift()!;
    if (visited.has(molecule_id)) continue;
    visited.add(molecule_id);

    // C-7: stop propagation beyond depth 3 UNLESS foundational
    if (depth > 3 && !is_foundational) continue;

    const propagation_status = propagation_type === "challenge_cleared"
      ? "CLEAR"
      : propagationStatusAtDepth(depth);

    const obs_type = propagation_type === "challenge_cleared"
      ? "noted_inherited"
      : depth === 1 ? "provisional_inherited"
      : depth === 2 ? "weakened_inherited"
      : "noted_inherited";

    const observation_id = generateId("obs", molecule_id, challenge_id, String(depth));
    const obs_hash = computeHash(observation_id, molecule_id, obs_type, challenge_id, depth, seq, prev_hash);

    const observation = {
      observation_id,
      molecule_id,
      observation_type: obs_type,
      polarity: propagation_type === "challenge_cleared" ? 1 : -1,
      conflict_flag: false,
      actor_id: "system:challenge_propagation",
      actor_domain_id: "authorigin:system",
      actor_trust_score: 1.0,
      propagation_depth: depth,
      propagation_source_event_id: challenge_id,
      metadata: {
        source_molecule_id,
        propagation_status,
        propagation_type,
        damping_factor,
      },
      constitution_version: CONSTITUTION_VERSION,
      journal_sequence: seq,
      observation_hash: obs_hash,
      prior_entry_hash: prev_hash,
    };

    await base44.asServiceRole.entities.JournalObservation.create(observation);
    observations.push(observation);

    // Update the dependent molecule's propagation status
    if (db_id) {
      await base44.asServiceRole.entities.Molecule.update(db_id, {
        propagation_status,
        propagation_depth: propagation_type === "challenge_cleared" ? 0 : depth,
        propagation_source_molecule_id: propagation_type === "challenge_cleared" ? null : source_molecule_id,
        last_observation_id: observation_id,
      });
    }

    prev_hash = obs_hash;
    seq++;

    // Continue BFS if within depth limit
    if (depth < 3 || is_foundational) {
      const nextDeps = await base44.asServiceRole.entities.Molecule.filter({});
      const nextDirect = (nextDeps ?? []).filter((m: any) =>
        Array.isArray(m.parent_molecule_ids) &&
        m.parent_molecule_ids.includes(molecule_id) &&
        !visited.has(m.molecule_id)
      );
      for (const nd of nextDirect) {
        queue.push({ molecule_id: nd.molecule_id, depth: depth + 1, db_id: nd.id });
      }
    }
  }

  return { affected_molecules: observations.length, observations };
}

// ─────────────────────────────────────────────
// INTERNAL: UPDATE DOMAIN TRUST AFTER RESOLUTION
// C-4 trust floor enforced
// ─────────────────────────────────────────────

async function updateDomainTrustAfterResolution(params: {
  challenger_id: string;
  challenger_domain_id: string;
  resolution: string;
  challenge_quality_score: number;
  molecule_survives: boolean;
  base44: any;
  now: string;
}): Promise<void> {
  const { challenger_domain_id, resolution, challenge_quality_score, molecule_survives, base44, now } = params;

  const domains = await base44.asServiceRole.entities.Domain.filter({ domain_id: challenger_domain_id });
  const domain = domains[0];
  if (!domain) return;

  // molecule_survives = challenge was upheld (rejected by governance)
  // !molecule_survives = challenge was accepted (molecule rejected)
  const challenge_was_upheld_by_governance = molecule_survives;  // governance upheld the molecule, so challenger "lost"
  const challenge_accepted_by_governance = !molecule_survives;   // governance accepted challenge, molecule fails

  // Trust adjustment logic:
  // Challenge accepted (challenger won) → moderate trust gain proportional to quality
  // Challenge rejected (challenger lost) → small trust penalty proportional to quality
  const trust_delta = challenge_accepted_by_governance
    ? +(challenge_quality_score * 0.05)   // win: small gain
    : -(challenge_quality_score * 0.03);  // loss: small penalty

  const new_trust = Math.max(
    TRUST_FLOOR,  // C-4: never below floor
    Math.min(1.0, (domain.trust_score ?? 0.5) + trust_delta)
  );

  const challenges_upheld = (domain.challenges_upheld ?? 0) + (challenge_accepted_by_governance ? 1 : 0);
  const challenges_rejected = (domain.challenges_rejected ?? 0) + (challenge_was_upheld_by_governance ? 1 : 0);

  await base44.asServiceRole.entities.Domain.update(domain.id, {
    trust_score: new_trust,
    trust_score_updated: now,
    challenges_upheld,
    challenges_rejected,
    challenge_history_score: challenges_upheld / Math.max(1, (domain.challenges_raised ?? 1)),
    last_activity_date: now,
  });
}

// ─────────────────────────────────────────────
// ACTION 4: GET CHALLENGE STATUS
// Returns full challenge lifecycle state
// ─────────────────────────────────────────────

async function getChallengeStatus(payload: any, base44: any): Promise<any> {
  const { challenge_id, molecule_id } = payload;

  if (!challenge_id && !molecule_id)
    return { success: false, error: "challenge_id or molecule_id required" };

  const filter = challenge_id
    ? { challenge_id }
    : { molecule_id };

  const govRecords = await base44.asServiceRole.entities.JournalGovernanceRecord.filter(filter);
  const facts = await base44.asServiceRole.entities.JournalFact.filter(filter);

  // Get molecule current state
  let molecule = null;
  if (molecule_id) {
    const mols = await base44.asServiceRole.entities.Molecule.filter({ molecule_id });
    molecule = mols[0] ?? null;
  }

  // Build timeline
  const timeline = [
    ...govRecords.map((g: any) => ({ type: "governance", event: g.governance_type, status: g.challenge_status, quality: g.challenge_quality_score, tier: g.escalation_tier, resolution: g.resolution, seq: g.journal_sequence })),
    ...facts.map((f: any) => ({ type: "fact", event: f.fact_type, from: f.from_state, to: f.to_state, polarity: f.polarity, quality: f.challenge_quality_score, seq: f.journal_sequence })),
  ].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

  const latestGov = govRecords.sort((a: any, b: any) => (b.journal_sequence ?? 0) - (a.journal_sequence ?? 0))[0];

  return {
    success: true,
    challenge_id: challenge_id ?? latestGov?.challenge_id,
    molecule_id,
    current_molecule_state: molecule?.current_state,
    propagation_status: molecule?.propagation_status,
    challenge_status: latestGov?.challenge_status ?? "NOT_FOUND",
    resolution: latestGov?.resolution ?? null,
    escalation_tier: latestGov?.escalation_tier ?? null,
    challenge_quality_score: latestGov?.challenge_quality_score ?? null,
    timeline,
    governance_record_count: govRecords.length,
    fact_count: facts.length,
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

    if (action === "raise_challenge")    return Response.json(await raiseChallenge(payload, base44));
    if (action === "invoke_governance")  return Response.json(await invokeGovernance(payload, base44));
    if (action === "resolve_challenge")  return Response.json(await resolveChallenge(payload, base44));
    if (action === "get_challenge_status") return Response.json(await getChallengeStatus(payload, base44));

    return Response.json({
      error: `Unknown action: ${action}`,
      valid_actions: ["raise_challenge","invoke_governance","resolve_challenge","get_challenge_status"]
    }, { status: 400 });

  } catch (err: any) {
    return Response.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
});
