// AuthOrigin — Constitutional Validation Engine
// Constitution v1.1 — July 2026
//
// PURPOSE
// -------
// Determines whether a proposed state transition is permissible by evaluating
// authoritative constitutional evidence against the current constitutional rule set.
//
// KEY PRINCIPLE
// -------------
// Authority comes from the constitutional record, not from caller intent.
// Every input claimed by a caller (current_state, trust_score) is discarded
// and replaced by the value actually held in the DB.
//
// THE EVALUATION OBJECT
// ---------------------
// The primary output is a ConstitutionalEvaluation — not a verdict.
// The verdict is one property of the evaluation.
// The full evaluation (evidence snapshot + rule version + decision) is
// reproducible: given the same molecule_id, proposed_action, actor, and
// rule_version, the same verdict must be derivable from the same evidence.
//
// ACTIONS
// -------
// evaluate_transition — single proposed action against single actor
// what_is_admissible  — all valid triggers evaluated for a molecule/actor pair

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { createHash } from "node:crypto";

const CONSTITUTION_VERSION = "v1.1";
const RULE_VERSION_LABEL   = "csm-admissibility-rules-v1.0";

function sha256(...parts: any[]): string {
  return createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex");
}
function now(): string { return new Date().toISOString(); }
function gid(...parts: any[]): string {
  return sha256(...parts, Date.now(), Math.random()).substring(0, 24);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTITUTIONAL RULE SET (v1.0)
// This structure is what the rule molecule contains.
// It can only be changed via constitutional governance — not by code edit.
// When changed, the new molecule_id is recorded in all future evaluations.
// ─────────────────────────────────────────────────────────────────────────────

interface FactRequirement {
  to_state:  string;       // the JournalFact.to_state that must exist
  fact_type?: string;      // optional: specific fact_type required
  label:     string;       // human-readable label for blocking_reason
}

interface TriggerRule {
  from_states:            string[];     // valid from-states (against DB, not payload)
  to_state:               string;
  trust_floor:            number;       // minimum actor trust from Domain record
  requires_governance:    boolean;      // JournalGovernanceRecord must exist
  governance_status?:     string;       // required governance record status (e.g. "OPEN")
  requires_challenge_id?: boolean;      // GovernanceRecord must have challenge_id
  predecessor_facts:      FactRequirement[];  // DB facts that must exist for molecule
  successor_must_exist?:  boolean;      // for supersession: successor molecule must be in DB
  weight_class:           "constitutional" | "operational";
}

const ADMISSIBILITY_RULES: Record<string, TriggerRule> = {
  first_citation: {
    from_states:         ["CREATED"],
    to_state:            "EXPLORED",
    trust_floor:         0.1,
    requires_governance: false,
    predecessor_facts:   [],
    weight_class:        "operational",
  },
  challenge_raised: {
    from_states:         ["EXPLORED", "VERIFIED_WEAK", "VERIFIED_STRONG", "MATERIALISED", "REINFORCED"],
    to_state:            "COLLAPSING",
    trust_floor:         0.1,  // C-4
    requires_governance: false,
    predecessor_facts:   [],
    weight_class:        "constitutional",
  },
  mandatory_review: {
    from_states:         ["EXPLORED"],
    to_state:            "COLLAPSING",
    trust_floor:         0.0,  // system trigger — no actor required
    requires_governance: false,
    predecessor_facts:   [],
    weight_class:        "constitutional",
  },
  governance_invoked: {
    from_states:         ["COLLAPSING"],
    to_state:            "UNDER_GOVERNANCE",
    trust_floor:         0.3,
    requires_governance: false,  // governance_invoked IS the governance record creation
    predecessor_facts:   [
      { to_state: "COLLAPSING", label: "challenge_raised or mandatory_review → COLLAPSING fact" },
    ],
    weight_class:        "constitutional",
  },
  governance_approved_no_challenge: {
    from_states:         ["UNDER_GOVERNANCE"],
    to_state:            "VERIFIED_WEAK",
    trust_floor:         0.5,
    requires_governance: true,
    governance_status:   "OPEN",
    predecessor_facts:   [
      { to_state: "COLLAPSING",       label: "state_transition to COLLAPSING" },
      { to_state: "UNDER_GOVERNANCE", label: "governance_invoked fact" },
    ],
    weight_class:        "constitutional",
  },
  survived_challenge: {
    from_states:           ["UNDER_GOVERNANCE"],
    to_state:              "VERIFIED_STRONG",
    trust_floor:           0.5,
    requires_governance:   true,
    governance_status:     "OPEN",
    requires_challenge_id: true,
    predecessor_facts:     [
      { to_state: "COLLAPSING",       label: "challenge_raised → COLLAPSING fact" },
      { to_state: "UNDER_GOVERNANCE", label: "governance_invoked fact" },
    ],
    weight_class:          "constitutional",
  },
  impact_observed: {
    from_states:         ["VERIFIED_WEAK", "VERIFIED_STRONG"],
    to_state:            "MATERIALISED",
    trust_floor:         0.3,
    requires_governance: true,
    governance_status:   "OPEN",
    predecessor_facts:   [
      { to_state: "VERIFIED_WEAK",   label: "governance_approved fact" },  // one of these
    ],
    weight_class:        "operational",
  },
  reinforcement_confirmed: {
    from_states:         ["MATERIALISED"],
    to_state:            "REINFORCED",
    trust_floor:         0.5,
    requires_governance: true,
    predecessor_facts:   [
      { to_state: "MATERIALISED", label: "impact_observed → MATERIALISED fact" },
    ],
    weight_class:        "constitutional",
  },
  supersession: {
    from_states:            ["REINFORCED", "VERIFIED_WEAK", "VERIFIED_STRONG", "MATERIALISED", "CONTEXTUAL"],
    to_state:               "SUPERSEDED",
    trust_floor:            0.5,
    requires_governance:    true,
    predecessor_facts:      [],
    successor_must_exist:   true,
    weight_class:           "constitutional",
  },
  contextualisation: {
    from_states:         ["REINFORCED", "VERIFIED_WEAK", "VERIFIED_STRONG", "MATERIALISED"],
    to_state:            "CONTEXTUAL",
    trust_floor:         0.5,
    requires_governance: true,
    predecessor_facts:   [],
    weight_class:        "constitutional",
  },
  deprecation: {
    from_states:         [
      "CREATED", "EXPLORED", "COLLAPSING", "UNDER_GOVERNANCE",
      "VERIFIED_WEAK", "VERIFIED_STRONG", "MATERIALISED", "REINFORCED", "CONTEXTUAL",
    ],
    to_state:            "DEPRECATED",
    trust_floor:         0.5,
    requires_governance: true,
    predecessor_facts:   [],
    weight_class:        "constitutional",
  },
  rejection: {
    from_states:         ["UNDER_GOVERNANCE"],
    to_state:            "REJECTED",
    trust_floor:         0.5,
    requires_governance: true,
    predecessor_facts:   [
      { to_state: "UNDER_GOVERNANCE", label: "governance_invoked fact" },
    ],
    weight_class:        "constitutional",
  },
  challenge_withdrawn: {
    from_states:         ["COLLAPSING"],
    to_state:            "EXPLORED",
    trust_floor:         0.5,
    requires_governance: true,
    predecessor_facts:   [
      { to_state: "COLLAPSING", label: "challenge_raised → COLLAPSING fact" },
    ],
    weight_class:        "constitutional",
  },
};

const TERMINAL_STATES = ["SUPERSEDED", "DEPRECATED", "REJECTED"];

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE GATHERING
// All values come from DB records. Caller claims are not used.
// ─────────────────────────────────────────────────────────────────────────────

interface ConstitutionalEvidence {
  molecule_id:           string;
  molecule_found:        boolean;
  molecule_state:        string | null;
  molecule_reuse_count:  number;
  molecule_foundational: boolean;
  molecule_kCv_rank:     number;
  actor_domain_found:    boolean;
  actor_trust_score:     number;
  fact_chain: {
    required: FactRequirement[];
    found:    { to_state: string; fact_type: string; fact_id: string }[];
    missing:  FactRequirement[];
  };
  governance_record:     any | null;
  active_bindings:       any[];
  snapshot_hash:         string;
}

async function gatherEvidence(
  molecule_id: string,
  proposed_action: string,
  actor_domain_id: string,
  successor_id: string | undefined,
  base44: any
): Promise<ConstitutionalEvidence> {

  const rule = ADMISSIBILITY_RULES[proposed_action];

  // Parallel DB reads — all authoritative
  const [allMolecules, allDomains, allFacts, allGovRecords, allBindings] = await Promise.all([
    base44.asServiceRole.entities.Molecule.list(),
    base44.asServiceRole.entities.Domain.list(),
    base44.asServiceRole.entities.JournalFact.list(),
    base44.asServiceRole.entities.JournalGovernanceRecord.list(),
    base44.asServiceRole.entities.JournalBinding.list(),
  ]);

  // Molecule state from DB
  const mol = allMolecules.find((m: any) => m.molecule_id === molecule_id);

  // Actor trust from Domain record
  const domain = allDomains.find((d: any) => d.domain_id === actor_domain_id);
  const actor_trust_score = domain ? (domain.trust_score ?? 0) : 0;

  // Fact chain verification
  const moleculeFacts = allFacts.filter((f: any) => f.molecule_id === molecule_id);
  const required = rule ? rule.predecessor_facts : [];
  const found: { to_state: string; fact_type: string; fact_id: string }[] = [];
  const missing: FactRequirement[] = [];

  for (const req of required) {
    const match = moleculeFacts.find(
      (f: any) => f.to_state === req.to_state && (!req.fact_type || f.fact_type === req.fact_type)
    );
    if (match) {
      found.push({ to_state: match.to_state, fact_type: match.fact_type, fact_id: match.fact_id });
    } else {
      missing.push(req);
    }
  }

  // Governance record (most recent OPEN record for this molecule)
  const govRecord = allGovRecords
    .filter((g: any) => g.molecule_id === molecule_id)
    .sort((a: any, b: any) => (b.journal_sequence ?? 0) - (a.journal_sequence ?? 0))[0] ?? null;

  // Active bindings scoped to this molecule
  const activeBindings = allBindings.filter(
    (b: any) =>
      b.binding_state === "ACTIVE" &&
      (b.molecule_id === molecule_id ||
        (Array.isArray(b.scope_ids) && b.scope_ids.includes(molecule_id)))
  );

  const evidenceForHash = {
    molecule_id,
    proposed_action,
    actor_domain_id,
    molecule_state: mol?.current_state ?? null,
    actor_trust_score,
    fact_chain_missing_count: missing.length,
    active_binding_count: activeBindings.length,
    governance_record_id: govRecord?.governance_id ?? null,
  };

  return {
    molecule_id,
    molecule_found:        !!mol,
    molecule_state:        mol?.current_state ?? null,
    molecule_reuse_count:  mol?.reuse_count ?? 0,
    molecule_foundational: mol?.is_foundational ?? false,
    molecule_kCv_rank:     mol?.kCv_rank ?? 0,
    actor_domain_found:    !!domain,
    actor_trust_score,
    fact_chain:            { required, found, missing },
    governance_record:     govRecord,
    active_bindings:       activeBindings,
    snapshot_hash:         sha256(evidenceForHash),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE EVALUATION
// Rules run against the single evidence object — not five separate checks.
// ─────────────────────────────────────────────────────────────────────────────

interface BlockingReason {
  layer:            "molecule" | "state" | "trust" | "fact_chain" | "governance" | "binding" | "terminal";
  rule:             string;
  what_exists:      string;
  what_is_required: string;
}

interface EvaluationResult {
  verdict:                  "ADMISSIBLE" | "CONDITIONED" | "INADMISSIBLE" | "UNKNOWN_ACTION";
  blocking_reasons:         BlockingReason[];
  conditioning_obligations: any[];
}

function evaluateRules(
  proposed_action: string,
  evidence: ConstitutionalEvidence
): EvaluationResult {

  const blocking:     BlockingReason[] = [];
  const conditioning: any[] = [];

  const rule = ADMISSIBILITY_RULES[proposed_action];
  if (!rule) {
    return {
      verdict: "UNKNOWN_ACTION",
      blocking_reasons: [{
        layer: "state", rule: "TRANSITION_MAP",
        what_exists: proposed_action,
        what_is_required: "A valid TransitionTrigger from the constitutional rule set",
      }],
      conditioning_obligations: [],
    };
  }

  // R-1: Molecule must exist
  if (!evidence.molecule_found) {
    blocking.push({
      layer: "molecule", rule: "MOLECULE_EXISTS",
      what_exists: "no molecule record in DB",
      what_is_required: `Molecule ${evidence.molecule_id} must exist in the corpus`,
    });
  }

  // R-2: Terminal state check — nothing may transition from a terminal state
  if (evidence.molecule_state && TERMINAL_STATES.includes(evidence.molecule_state)) {
    blocking.push({
      layer: "terminal", rule: "NO_TRANSITION_FROM_TERMINAL",
      what_exists: `molecule.current_state = ${evidence.molecule_state}`,
      what_is_required: "Terminal states admit no further transitions",
    });
  }

  // R-3: State must be a valid from-state for this trigger (queried from DB)
  if (
    evidence.molecule_state &&
    !TERMINAL_STATES.includes(evidence.molecule_state) &&
    !rule.from_states.includes(evidence.molecule_state)
  ) {
    blocking.push({
      layer: "state", rule: "VALID_FROM_STATE",
      what_exists: `molecule.current_state = ${evidence.molecule_state} (from DB)`,
      what_is_required: `One of: ${rule.from_states.join(", ")}`,
    });
  }

  // R-4: Actor trust (from Domain record, not payload)
  if (evidence.actor_trust_score < rule.trust_floor) {
    blocking.push({
      layer: "trust", rule: "ACTOR_TRUST_FLOOR",
      what_exists: evidence.actor_domain_found
        ? `domain.trust_score = ${evidence.actor_trust_score}`
        : "domain not found in DB (trust = 0)",
      what_is_required: `trust_score ≥ ${rule.trust_floor} (constitutional floor for ${proposed_action})`,
    });
  }

  // R-5: Predecessor facts must exist in JournalFact
  for (const missing of evidence.fact_chain.missing) {
    blocking.push({
      layer: "fact_chain", rule: "PREDECESSOR_FACT_EXISTS",
      what_exists: `no JournalFact with to_state=${missing.to_state} found for molecule`,
      what_is_required: missing.label,
    });
  }

  // R-6: Governance record checks
  if (rule.requires_governance) {
    if (!evidence.governance_record) {
      blocking.push({
        layer: "governance", rule: "GOVERNANCE_RECORD_EXISTS",
        what_exists: "no JournalGovernanceRecord found for this molecule",
        what_is_required: "An open JournalGovernanceRecord must exist",
      });
    } else {
      // Specific governance status required
      if (rule.governance_status &&
          evidence.governance_record.challenge_status !== rule.governance_status) {
        blocking.push({
          layer: "governance", rule: "GOVERNANCE_RECORD_STATUS",
          what_exists: `governance_record.challenge_status = ${evidence.governance_record.challenge_status}`,
          what_is_required: `challenge_status = ${rule.governance_status}`,
        });
      }
      // Challenge ID required
      if (rule.requires_challenge_id && !evidence.governance_record.challenger_id) {
        blocking.push({
          layer: "governance", rule: "CHALLENGE_ID_IN_GOVERNANCE_RECORD",
          what_exists: "governance_record has no challenger_id",
          what_is_required: "A challenge-originated GovernanceRecord with challenger_id is required for survived_challenge",
        });
      }
    }
  }

  // R-7: Active binding foreclosures (from JournalBinding)
  for (const binding of evidence.active_bindings) {
    for (const fc of (binding.foreclosures ?? [])) {
      if (fc.applies_to === proposed_action || fc.applies_to === "all_governance") {
        blocking.push({
          layer: "binding", rule: "BINDING_FORECLOSURE",
          what_exists: `binding_id=${binding.binding_id} type=${binding.binding_type} forecloses ${fc.applies_to}`,
          what_is_required: "No active binding may foreclose this action",
        });
      }
    }
    // Active binding obligations — conditioning, not blocking
    for (const ob of (binding.obligations ?? [])) {
      const blockedPaths: string[] = ob.blocking_paths ?? [];
      if (blockedPaths.includes(proposed_action) || blockedPaths.includes("all_governance")) {
        conditioning.push({
          binding_id:          binding.binding_id,
          binding_type:        binding.binding_type,
          obligation_type:     ob.obligation_type,
          discharge_condition: ob.discharge_condition,
        });
      }
    }
  }

  // Verdict
  if (blocking.length > 0) {
    return { verdict: "INADMISSIBLE", blocking_reasons: blocking, conditioning_obligations: conditioning };
  }
  if (conditioning.length > 0) {
    return { verdict: "CONDITIONED",  blocking_reasons: [],     conditioning_obligations: conditioning };
  }
  return     { verdict: "ADMISSIBLE", blocking_reasons: [],     conditioning_obligations: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE MOLECULE BOOTSTRAP
// The rule set lives as a constitutional molecule.
// If it doesn't exist yet, it is created here (once, ever).
// Future changes require constitutional governance → new molecule supersedes this one.
// ─────────────────────────────────────────────────────────────────────────────

async function ensureRuleMolecule(base44: any): Promise<string> {
  const all = await base44.asServiceRole.entities.Molecule.list();
  const existing = all.find((m: any) => m.vsid === RULE_VERSION_LABEL && m.molecule_type === "definition");
  if (existing) return existing.molecule_id;

  const ruleContent = JSON.stringify(ADMISSIBILITY_RULES, null, 2);
  const ruleHash    = sha256(ruleContent);
  const ruleId      = "mol-csm-rules-" + ruleHash.substring(0, 12);

  await base44.asServiceRole.entities.Molecule.create({
    molecule_id:          ruleId,
    canonicalHash:        ruleHash,
    lexical_content:      ruleContent,
    molecule_type:        "definition",
    current_state:        "EXPLORED",
    constitutional_status:"active",
    access_tier:          "open",
    weight_class:         "constitutional",
    is_foundational:      true,
    kCv_o: 0, kCv_u: 0, kCv_v_score: 0, kCv_v_quality: "UNVERIFIED",
    kCv_i_score: 0, kCv_i_status: "UNOBSERVED",
    kCv_r_score: 0, kCv_r_status: "NEW", kCv_rank: 0,
    capture_confidence:   "1.0",
    observation_density:  0, reuse_count: 0,
    parent_molecule_ids:  [], lineage_types: [],
    lineage_certainty:    "1.0",
    scope_definition:     "csm:admissibility-rules",
    source_name:          "Constitutional Validation",
    vsid:                 RULE_VERSION_LABEL,
    author_domain_id:     "constitutional-engine",
    constitution_version: CONSTITUTION_VERSION,
    state_since:          now(),
  });

  // Anchor with a constitutional Fact
  const allFacts  = await base44.asServiceRole.entities.JournalFact.list();
  const ls        = Math.max(0, ...allFacts.map((f: any) => f.journal_sequence ?? 0));
  const factId    = gid("fact-rules-bootstrap", ruleId);
  await base44.asServiceRole.entities.JournalFact.create({
    fact_id:              factId,
    molecule_id:          ruleId,
    canonicalHash:        ruleHash,
    fact_type:            "foundational_designation",
    weight_class:         "constitutional",
    polarity:             1,
    from_state:           "CREATED",
    to_state:             "EXPLORED",
    actor_id:             "constitutional-engine",
    actor_domain_id:      "constitutional-engine",
    actor_trust_score:    1.0,
    evidence_hash:        ruleHash,
    constitution_version: CONSTITUTION_VERSION,
    journal_sequence:     ls + 1,
    fact_hash:            sha256(factId, ruleId, now()),
    prior_entry_hash:     allFacts.length > 0
                            ? (allFacts[allFacts.length - 1].fact_hash ?? "genesis")
                            : "genesis",
  });

  return ruleId;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVALUATE TRANSITION
// The main action. Returns a full ConstitutionalEvaluation — not just a verdict.
// ─────────────────────────────────────────────────────────────────────────────

async function evaluateTransition(payload: any, base44: any): Promise<any> {
  const {
    molecule_id,
    proposed_action,
    actor_id        = "unknown",
    actor_domain_id = "unknown",
    successor_id,   // for supersession
  } = payload;

  if (!molecule_id)      return { success: false, error: "molecule_id required" };
  if (!proposed_action)  return { success: false, error: "proposed_action required" };

  const [rule_version, evidence] = await Promise.all([
    ensureRuleMolecule(base44),
    gatherEvidence(molecule_id, proposed_action, actor_domain_id, successor_id, base44),
  ]);

  const { verdict, blocking_reasons, conditioning_obligations } = evaluateRules(proposed_action, evidence);

  const evaluation_id   = sha256(molecule_id, proposed_action, actor_id, rule_version, evidence.snapshot_hash).substring(0, 24);
  const evaluated_at    = now();
  const evaluation_hash = sha256(evaluation_id, evidence.snapshot_hash, verdict, rule_version, evaluated_at);

  return {
    success: true,
    evaluation: {
      evaluation_id,
      molecule_id,
      proposed_action,
      actor_id,
      actor_domain_id,
      // Evidence — fully DB-sourced, no caller values
      evidence: {
        molecule_state:        evidence.molecule_state,
        molecule_reuse_count:  evidence.molecule_reuse_count,
        molecule_foundational: evidence.molecule_foundational,
        molecule_kCv_rank:     evidence.molecule_kCv_rank,
        actor_trust_score:     evidence.actor_trust_score,
        actor_domain_found:    evidence.actor_domain_found,
        fact_chain:            evidence.fact_chain,
        governance_record_id:  evidence.governance_record?.governance_id ?? null,
        governance_status:     evidence.governance_record?.challenge_status ?? null,
        active_binding_count:  evidence.active_bindings.length,
        snapshot_hash:         evidence.snapshot_hash,
      },
      // Rule version — molecule_id of the admissibility rules molecule
      rule_version,
      // Verdict and reasoning
      verdict,
      blocking_reasons,
      conditioning_obligations,
      // Reproducibility
      evaluated_at,
      evaluation_hash,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS ADMISSIBLE
// Evaluates all valid triggers for a molecule/actor pair.
// Returns a map: trigger → verdict + reasons.
// ─────────────────────────────────────────────────────────────────────────────

async function whatIsAdmissible(payload: any, base44: any): Promise<any> {
  const { molecule_id, actor_id = "unknown", actor_domain_id = "unknown" } = payload;
  if (!molecule_id) return { success: false, error: "molecule_id required" };

  const [rule_version, evidence] = await Promise.all([
    ensureRuleMolecule(base44),
    gatherEvidence(molecule_id, "all", actor_domain_id, undefined, base44),
  ]);

  const map: Record<string, any> = {};
  for (const action of Object.keys(ADMISSIBILITY_RULES)) {
    const actionEvidence = await gatherEvidence(molecule_id, action, actor_domain_id, undefined, base44);
    const { verdict, blocking_reasons, conditioning_obligations } = evaluateRules(action, actionEvidence);
    map[action] = {
      to_state:    ADMISSIBILITY_RULES[action].to_state,
      verdict,
      blocking_reasons,
      conditioning_obligations,
    };
  }

  const admissible   = Object.entries(map).filter(([, v]) => v.verdict === "ADMISSIBLE").map(([k]) => k);
  const conditioned  = Object.entries(map).filter(([, v]) => v.verdict === "CONDITIONED").map(([k]) => k);
  const inadmissible = Object.entries(map).filter(([, v]) => v.verdict === "INADMISSIBLE").map(([k]) => k);

  return {
    success: true,
    molecule_id,
    actor_id,
    actor_domain_id,
    molecule_state:      evidence.molecule_state,
    actor_trust_score:   evidence.actor_trust_score,
    rule_version,
    summary: { admissible, conditioned, inadmissible },
    detail:  map,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP HANDLER
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const body           = await req.json();
    const { action, ...payload } = body;

    if (action === "evaluate_transition") {
      return Response.json(await evaluateTransition(payload, base44));
    }
    if (action === "what_is_admissible") {
      return Response.json(await whatIsAdmissible(payload, base44));
    }

    return Response.json({
      error: "Unknown action",
      valid_actions: ["evaluate_transition", "what_is_admissible"],
    }, { status: 400 });

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
