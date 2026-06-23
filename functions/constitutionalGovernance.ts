// AuthOrigin — Constitutional Governance Layer
// Phase 6 — Tier 3 admissibility evaluation via the Binding graph
// Separated from retrieval by intent (ADR-001).
// Constitution v1.0 — June 23, 2026

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { createHash } from "node:crypto";

const CONSTITUTION_VERSION = "v1.0";

// ─────────────────────────────────────────────
// BINDING TYPE REGISTER
// Typed at constitution level. B-1 through B-n ratified separately.
// This scaffold is ready to receive them.
// ─────────────────────────────────────────────

interface BindingTriggerRule {
  binding_type:     string;
  alteration_class: "narrowing" | "extension" | "conditioning";
  description:      string;
  trigger:          (fact: any, molecule: any) => boolean;
  scope_builder:    (fact: any, molecule: any, allMolecules: any[]) => object;
  obligations:      object[];
  foreclosures:     object[];
  expiry_type:      "never" | "versioned" | "review_triggered" | "count_triggered";
  expiry_value:     string | null;
  challengeable:    boolean;
  challenge_minimum_tier: "0" | "1" | "2" | "3";
  challenge_basis:  string[];
}

// Scaffold: empty register until named types are ratified.
// Activation engine is live — register entries will fire when added.
const BINDING_TYPE_REGISTER: BindingTriggerRule[] = [
  // B-1: PRECEDENT_ESTABLISHED (deferred — pending ratification)
  // B-2: MANDATORY_REASSESSMENT (deferred)
  // B-3: SCOPE_AUTHORITY_GRANTED (deferred)
  // B-4: QUORUM_PRECEDENT (deferred)
  // B-5: LINEAGE_CONTAMINATION (deferred)
];

// ─────────────────────────────────────────────
// GOVERNANCE ACTIONS — what a caller can propose
// ─────────────────────────────────────────────

const GOVERNANCE_ACTIONS = [
  "supersede",           // replace this molecule with a successor
  "challenge",           // raise a challenge against this molecule
  "deprecate",           // mark as deprecated
  "scope_claim",         // claim scope authority for a scope_definition
  "cite",                // add this molecule as a parent citation
  "quorum_assemble",     // convene a Tier 3 quorum
  "binding_challenge",   // challenge an active Binding on this molecule
  "lineage_reassess",    // trigger lineage reassessment
] as const;

type GovernanceAction = typeof GOVERNANCE_ACTIONS[number];

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

function generateId(...parts: any[]): string {
  return createHash("sha256")
    .update(JSON.stringify(parts) + Date.now() + Math.random())
    .digest("hex").substring(0, 24);
}
function computeHash(...parts: any[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}
function now(): string { return new Date().toISOString(); }

// ─────────────────────────────────────────────
// BINDING ACTIVATION ENGINE
// Called after every constitutional Fact is written.
// Evaluates BINDING_TYPE_REGISTER and fires matching triggers.
// ─────────────────────────────────────────────

async function activateBindings(
  fact: any,
  molecule: any,
  allMolecules: any[],
  allBindings: any[],
  base44: any
): Promise<any[]> {
  const activated: any[] = [];

  for (const rule of BINDING_TYPE_REGISTER) {
    if (!rule.trigger(fact, molecule)) continue;

    // BLS-1: scope may only narrow or match scope of any parent binding
    const scope = rule.scope_builder(fact, molecule, allMolecules);

    // Compute next journal sequence across all journal layers
    const allFacts    = await base44.asServiceRole.entities.JournalFact.list();
    const allObs      = await base44.asServiceRole.entities.JournalObservation.list();
    const allGov      = await base44.asServiceRole.entities.JournalGovernanceRecord.list();
    const maxSeq      = Math.max(
      0,
      ...allFacts.map((f: any)  => f.journal_sequence ?? 0),
      ...allObs.map((o: any)    => o.journal_sequence ?? 0),
      ...allGov.map((g: any)    => g.journal_sequence ?? 0),
      ...allBindings.map((b: any) => b.journal_sequence ?? 0),
    );

    const binding_id  = generateId("binding", rule.binding_type, fact.fact_id, molecule.molecule_id);
    const bindingRecord = {
      binding_id,
      binding_type:          rule.binding_type,
      binding_state:         "ACTIVE",
      alteration_class:      rule.alteration_class,
      triggering_fact_id:    fact.fact_id,        // CB-3: required
      parent_binding_id:     null,                // BLS-0: no direct parent unless challenge chain
      molecule_id:           molecule.molecule_id,
      ...scope,
      obligations:           rule.obligations,
      foreclosures:          rule.foreclosures,
      expiry_type:           rule.expiry_type,
      expiry_value:          rule.expiry_value,
      challengeable:         rule.challengeable,
      challenge_minimum_tier: rule.challenge_minimum_tier,
      challenge_basis:       rule.challenge_basis,
      constitution_version:  CONSTITUTION_VERSION,
      journal_sequence:      maxSeq + 1,
      actor_id:              fact.actor_id,
      actor_domain_id:       fact.actor_domain_id,
      metadata:              { triggered_by_fact_type: fact.fact_type, molecule_state: molecule.current_state },
    };

    bindingRecord.binding_hash  = computeHash(binding_id, rule.binding_type, fact.fact_id, scope);
    bindingRecord.prior_entry_hash = allBindings.length > 0
      ? allBindings[allBindings.length - 1].binding_hash ?? "genesis"
      : "genesis";

    await base44.asServiceRole.entities.JournalBinding.create(bindingRecord);
    activated.push({ binding_id, binding_type: rule.binding_type, alteration_class: rule.alteration_class });
  }

  return activated;
}

// ─────────────────────────────────────────────
// ADMISSIBILITY EVALUATOR
// Tier 3 hard gate: evaluates active Bindings against proposed action
// ─────────────────────────────────────────────

interface AdmissibilityResult {
  verdict:          "ADMISSIBLE" | "INADMISSIBLE" | "CONDITIONED";
  proposed_action:  string;
  molecule_id:      string;
  blocking_bindings: any[];
  conditioning_bindings: any[];
  obligations_required:  any[];
  audit_id:         string;
  evaluated_at:     string;
  constitution_version: string;
}

function evaluateAdmissibility(
  molecule_id: string,
  proposed_action: GovernanceAction,
  activeBindings: any[]
): Omit<AdmissibilityResult, "audit_id" | "evaluated_at" | "constitution_version"> {

  const inScope = activeBindings.filter(b =>
    b.binding_state === "ACTIVE" &&
    (b.molecule_id === molecule_id ||
     (Array.isArray(b.scope_ids) && b.scope_ids.includes(molecule_id)))
  );

  const blocking:     any[] = [];
  const conditioning: any[] = [];
  const obligations:  any[] = [];

  for (const binding of inScope) {
    // Check foreclosures (narrowing — hard block)
    for (const fc of (binding.foreclosures ?? [])) {
      if (fc.applies_to === proposed_action || fc.applies_to === "all_governance") {
        blocking.push({
          binding_id:      binding.binding_id,
          binding_type:    binding.binding_type,
          alteration_class: binding.alteration_class,
          foreclosure:     fc,
          binding_state:   binding.binding_state,
        });
      }
    }

    // Check obligations (conditioning — allowed but gated)
    for (const ob of (binding.obligations ?? [])) {
      const blockedPaths: string[] = ob.blocking_paths ?? [];
      if (blockedPaths.includes(proposed_action) || blockedPaths.includes("all_governance")) {
        conditioning.push({
          binding_id:          binding.binding_id,
          binding_type:        binding.binding_type,
          obligation_type:     ob.obligation_type,
          discharge_condition: ob.discharge_condition,
          applies_to:          ob.applies_to,
        });
        obligations.push(ob);
      }
    }
  }

  if (blocking.length > 0) {
    return {
      verdict: "INADMISSIBLE",
      proposed_action,
      molecule_id,
      blocking_bindings:      blocking,
      conditioning_bindings:  [],
      obligations_required:   [],
    };
  }

  if (conditioning.length > 0) {
    return {
      verdict: "CONDITIONED",
      proposed_action,
      molecule_id,
      blocking_bindings:      [],
      conditioning_bindings:  conditioning,
      obligations_required:   obligations,
    };
  }

  return {
    verdict: "ADMISSIBLE",
    proposed_action,
    molecule_id,
    blocking_bindings:      [],
    conditioning_bindings:  [],
    obligations_required:   [],
  };
}

// ─────────────────────────────────────────────
// ACTION: EVALUATE GOVERNANCE
// Full Tier 3 admissibility check for a proposed action
// ─────────────────────────────────────────────

async function evaluateGovernance(payload: any, base44: any): Promise<any> {
  const {
    molecule_id,
    proposed_action,
    actor_id,
    actor_domain_id,
    include_binding_detail = true,
  } = payload;

  if (!molecule_id)      return { success: false, error: "molecule_id required" };
  if (!proposed_action)  return { success: false, error: "proposed_action required" };
  if (!GOVERNANCE_ACTIONS.includes(proposed_action)) {
    return { success: false, error: `Unknown action. Valid: ${GOVERNANCE_ACTIONS.join(", ")}` };
  }

  const [allMolecules, allBindings, allFacts] = await Promise.all([
    base44.asServiceRole.entities.Molecule.list(),
    base44.asServiceRole.entities.JournalBinding.list(),
    base44.asServiceRole.entities.JournalFact.list(),
  ]);

  const molecule = allMolecules.find((m: any) => m.molecule_id === molecule_id);
  if (!molecule) return { success: false, error: `Molecule ${molecule_id} not found` };

  // Resolve binding scope — include lineage bindings
  const downstreamIds = allMolecules
    .filter((m: any) => (m.parent_molecule_ids ?? []).includes(molecule_id))
    .map((m: any) => m.molecule_id);
  const ancestorIds = molecule.parent_molecule_ids ?? [];

  // Collect all bindings that scope to this molecule directly or via lineage
  const relevantBindings = allBindings.filter((b: any) => {
    if (b.binding_state !== "ACTIVE") return false;
    if (b.molecule_id === molecule_id) return true;
    if ((b.scope_ids ?? []).includes(molecule_id)) return true;
    if (b.scope_direction === "downstream" && ancestorIds.includes(b.molecule_id)) return true;
    if (b.scope_direction === "upstream"   && downstreamIds.includes(b.molecule_id)) return true;
    return false;
  });

  const result = evaluateAdmissibility(molecule_id, proposed_action as GovernanceAction, relevantBindings);

  const audit_id    = generateId("gov-audit", molecule_id, proposed_action, now());
  const evaluated_at = now();

  const full_result: AdmissibilityResult = {
    ...result,
    audit_id,
    evaluated_at,
    constitution_version: CONSTITUTION_VERSION,
  };

  // Write governance audit observation (non-blocking)
  try {
    const allObs = await base44.asServiceRole.entities.JournalObservation.list();
    const lastSeq = Math.max(0, ...allObs.map((o: any) => o.journal_sequence ?? 0));
    const obs_id  = generateId("obs-gov", audit_id);
    await base44.asServiceRole.entities.JournalObservation.create({
      observation_id:    obs_id,
      molecule_id,
      observation_type:  "governance_evaluation",
      polarity:          result.verdict === "ADMISSIBLE" ? 1 : -1,
      conflict_flag:     false,
      actor_id:          actor_id ?? "unknown",
      actor_domain_id:   actor_domain_id ?? "unknown",
      actor_trust_score: 1.0,
      metadata: {
        audit_id,
        proposed_action,
        verdict: result.verdict,
        blocking_count: result.blocking_bindings.length,
        conditioning_count: result.conditioning_bindings.length,
      },
      constitution_version: CONSTITUTION_VERSION,
      journal_sequence:  lastSeq + 1,
      observation_hash:  computeHash(obs_id, molecule_id, proposed_action, result.verdict),
      prior_entry_hash:  allObs.length > 0
        ? allObs[allObs.length - 1].observation_hash ?? "genesis"
        : "genesis",
    });
  } catch (_) { /* non-blocking audit */ }

  return {
    success: true,
    governance_evaluation: full_result,
    molecule_summary: {
      molecule_id,
      current_state:   molecule.current_state,
      molecule_type:   molecule.molecule_type,
      scope_definition: molecule.scope_definition,
    },
    active_bindings_evaluated: relevantBindings.length,
    binding_detail: include_binding_detail ? relevantBindings.map((b: any) => ({
      binding_id:      b.binding_id,
      binding_type:    b.binding_type,
      binding_state:   b.binding_state,
      alteration_class: b.alteration_class,
      scope_direction: b.scope_direction,
      expiry_type:     b.expiry_type,
      challengeable:   b.challengeable,
    })) : [],
  };
}

// ─────────────────────────────────────────────
// ACTION: CHALLENGE BINDING
// Initiates a challenge against an active Binding (BLS-001)
// Moves Binding to SUSPENDED, writes GovernanceRecord
// ─────────────────────────────────────────────

async function challengeBinding(payload: any, base44: any): Promise<any> {
  const { binding_id, challenger_id, challenger_domain_id, challenge_basis, evidence_hash } = payload;
  if (!binding_id || !challenger_id || !challenge_basis) {
    return { success: false, error: "binding_id, challenger_id, and challenge_basis required" };
  }

  const allBindings = await base44.asServiceRole.entities.JournalBinding.list();
  const binding     = allBindings.find((b: any) => b.binding_id === binding_id);
  if (!binding)      return { success: false, error: `Binding ${binding_id} not found` };
  if (!binding.challengeable) return { success: false, error: "This Binding is not challengeable" };
  if (binding.binding_state !== "ACTIVE") {
    return { success: false, error: `Binding is ${binding.binding_state}, not ACTIVE` };
  }

  // Validate challenge basis
  const validBases: string[] = binding.challenge_basis ?? [];
  if (!validBases.includes(challenge_basis) && validBases.length > 0) {
    return {
      success: false,
      error: `Invalid challenge_basis. Valid grounds: ${validBases.join(", ")}`,
    };
  }

  // Write GovernanceRecord for binding challenge
  const allGov     = await base44.asServiceRole.entities.JournalGovernanceRecord.list();
  const lastSeq    = Math.max(0, ...allGov.map((g: any) => g.journal_sequence ?? 0),
                              ...allBindings.map((b: any) => b.journal_sequence ?? 0));
  const gov_id     = generateId("gov", "binding_challenge", binding_id, challenger_id);

  await base44.asServiceRole.entities.JournalGovernanceRecord.create({
    governance_id:        gov_id,
    molecule_id:          binding.molecule_id,
    governance_type:      "binding_challenge",
    challenge_type:       "binding_challenge",
    challenge_status:     "OPEN",
    actor_id:             challenger_id,
    actor_domain_id:      challenger_domain_id ?? "unknown",
    challenger_id,
    challenger_domain_id: challenger_domain_id ?? "unknown",
    observation_refs:     [binding_id],
    evidence_payload_hash: evidence_hash ?? null,
    constitution_version: CONSTITUTION_VERSION,
    journal_sequence:     lastSeq + 1,
    governance_hash:      computeHash(gov_id, binding_id, challenger_id, lastSeq + 1),
    prior_entry_hash:     allGov.length > 0
      ? allGov[allGov.length - 1].governance_hash ?? "genesis"
      : "genesis",
    metadata: { binding_id, challenge_basis },
  });

  // Suspend the Binding — BLS lifecycle: ACTIVE → SUSPENDED
  const bindingRecord = allBindings.find((b: any) => b.binding_id === binding_id);
  if (bindingRecord?.id) {
    await base44.asServiceRole.entities.JournalBinding.update(bindingRecord.id, {
      binding_state:     "SUSPENDED",
      active_challenge_id: gov_id,
    });
  }

  return {
    success: true,
    binding_id,
    previous_state: "ACTIVE",
    new_state:      "SUSPENDED",
    governance_record_id: gov_id,
    message: "Binding suspended pending governance resolution. Use resolve_binding_challenge to complete.",
  };
}

// ─────────────────────────────────────────────
// ACTION: RESOLVE BINDING CHALLENGE
// Resolves a binding_challenge GovernanceRecord.
// If upheld: Binding → VOIDED, new Binding MAY be produced (via new Fact, BLS-0)
// If rejected: Binding → ACTIVE (survived)
// ─────────────────────────────────────────────

async function resolveBindingChallenge(payload: any, base44: any): Promise<any> {
  const {
    governance_id,
    resolution,           // "upheld" | "rejected"
    resolution_rationale,
    actor_id,
    actor_domain_id,
  } = payload;

  if (!governance_id || !resolution) {
    return { success: false, error: "governance_id and resolution required" };
  }
  if (!["upheld","rejected"].includes(resolution)) {
    return { success: false, error: "resolution must be 'upheld' or 'rejected'" };
  }

  const allGov      = await base44.asServiceRole.entities.JournalGovernanceRecord.list();
  const govRecord   = allGov.find((g: any) => g.governance_id === governance_id);
  if (!govRecord)   return { success: false, error: `GovernanceRecord ${governance_id} not found` };
  if (govRecord.governance_type !== "binding_challenge") {
    return { success: false, error: "This record is not a binding_challenge" };
  }

  const allBindings = await base44.asServiceRole.entities.JournalBinding.list();
  const binding_id  = govRecord.metadata?.binding_id;
  const binding     = allBindings.find((b: any) => b.binding_id === binding_id);
  if (!binding)     return { success: false, error: `Binding ${binding_id} not found` };

  // Write resolution Fact — BLS-0: only a Fact can produce next Binding if needed
  const allFacts   = await base44.asServiceRole.entities.JournalFact.list();
  const lastSeq    = Math.max(0,
    ...allFacts.map((f: any)    => f.journal_sequence ?? 0),
    ...allGov.map((g: any)      => g.journal_sequence ?? 0),
    ...allBindings.map((b: any) => b.journal_sequence ?? 0),
  );

  const fact_id    = generateId("fact", "binding_resolution", governance_id);
  const fact_type  = resolution === "upheld" ? "binding_voided" : "binding_survived";

  await base44.asServiceRole.entities.JournalFact.create({
    fact_id,
    molecule_id:         binding.molecule_id,
    fact_type,
    weight_class:        "constitutional",
    polarity:            resolution === "upheld" ? -1 : 1,
    from_state:          binding.binding_state,
    to_state:            resolution === "upheld" ? "VOIDED" : "ACTIVE",
    governance_ref_id:   governance_id,
    actor_id:            actor_id ?? "system",
    actor_domain_id:     actor_domain_id ?? "system",
    actor_trust_score:   1.0,
    evidence_hash:       computeHash(governance_id, resolution),
    metadata:            { binding_id, resolution, resolution_rationale },
    constitution_version: CONSTITUTION_VERSION,
    journal_sequence:    lastSeq + 1,
    fact_hash:           computeHash(fact_id, binding_id, resolution, lastSeq + 1),
    prior_entry_hash:    allFacts.length > 0
      ? allFacts[allFacts.length - 1].fact_hash ?? "genesis"
      : "genesis",
  });

  // Update Binding state
  if (binding.id) {
    const newState = resolution === "upheld" ? "VOIDED" : "ACTIVE";
    await base44.asServiceRole.entities.JournalBinding.update(binding.id, {
      binding_state:       newState,
      active_challenge_id: null,
      voided_by_fact_id:   resolution === "upheld" ? fact_id : null,
    });
  }

  // Update GovernanceRecord
  if (govRecord.id) {
    await base44.asServiceRole.entities.JournalGovernanceRecord.update(govRecord.id, {
      challenge_status:    "RESOLVED",
      resolution:          resolution === "upheld" ? "upheld" : "rejected",
      resolution_rationale,
      resulting_fact_id:   fact_id,
    });
  }

  // If rejected (Binding survived): the Binding has now survived a challenge.
  // This is analogous to a molecule surviving challenge — its authority increases.
  // Future kCv_b projection (when introduced) will reflect this.
  // For now: write observation noting binding_survived
  if (resolution === "rejected") {
    try {
      const allObs   = await base44.asServiceRole.entities.JournalObservation.list();
      const lastObsSeq = Math.max(0, ...allObs.map((o: any) => o.journal_sequence ?? 0));
      const obs_id   = generateId("obs", "binding_survived", binding_id);
      await base44.asServiceRole.entities.JournalObservation.create({
        observation_id:    obs_id,
        molecule_id:       binding.molecule_id,
        observation_type:  "binding_survived",
        polarity:          1,
        conflict_flag:     false,
        actor_id:          actor_id ?? "system",
        actor_domain_id:   actor_domain_id ?? "system",
        actor_trust_score: 1.0,
        metadata:          { binding_id, governance_id },
        constitution_version: CONSTITUTION_VERSION,
        journal_sequence:  lastObsSeq + 1,
        observation_hash:  computeHash(obs_id, binding_id, governance_id),
        prior_entry_hash:  allObs.length > 0
          ? allObs[allObs.length - 1].observation_hash ?? "genesis"
          : "genesis",
      });
    } catch (_) {}
  }

  return {
    success: true,
    binding_id,
    previous_state: "SUSPENDED",
    new_state:      resolution === "upheld" ? "VOIDED" : "ACTIVE",
    resolution_fact_id: fact_id,
    message: resolution === "upheld"
      ? "Binding voided. A new Binding may now be produced by a subsequent constitutional Fact (BLS-0)."
      : "Binding survived challenge and returned to ACTIVE state.",
  };
}

// ─────────────────────────────────────────────
// ACTION: GET GOVERNANCE PROFILE
// Full governance picture for a molecule:
// current state, active bindings, binding history, admissibility matrix
// ─────────────────────────────────────────────

async function getGovernanceProfile(payload: any, base44: any): Promise<any> {
  const { molecule_id } = payload;
  if (!molecule_id) return { success: false, error: "molecule_id required" };

  const [allMolecules, allBindings, allFacts, allGov] = await Promise.all([
    base44.asServiceRole.entities.Molecule.list(),
    base44.asServiceRole.entities.JournalBinding.list(),
    base44.asServiceRole.entities.JournalFact.list(),
    base44.asServiceRole.entities.JournalGovernanceRecord.list(),
  ]);

  const molecule = allMolecules.find((m: any) => m.molecule_id === molecule_id);
  if (!molecule) return { success: false, error: `Molecule ${molecule_id} not found` };

  const molBindings = allBindings.filter((b: any) =>
    b.molecule_id === molecule_id ||
    (Array.isArray(b.scope_ids) && b.scope_ids.includes(molecule_id))
  );
  const activeBindings    = molBindings.filter((b: any) => b.binding_state === "ACTIVE");
  const historicalBindings = molBindings.filter((b: any) => b.binding_state !== "ACTIVE");

  // Build admissibility matrix for all governance actions
  const admissibility_matrix: Record<string, any> = {};
  for (const action of GOVERNANCE_ACTIONS) {
    const result = evaluateAdmissibility(molecule_id, action as GovernanceAction, activeBindings);
    admissibility_matrix[action] = {
      verdict: result.verdict,
      blocking_count:     result.blocking_bindings.length,
      conditioning_count: result.conditioning_bindings.length,
    };
  }

  return {
    success: true,
    molecule_id,
    current_state:       molecule.current_state,
    molecule_type:       molecule.molecule_type,
    scope_definition:    molecule.scope_definition,
    active_bindings:     activeBindings.length,
    historical_bindings: historicalBindings.length,
    binding_summary: molBindings.map((b: any) => ({
      binding_id:      b.binding_id,
      binding_type:    b.binding_type,
      binding_state:   b.binding_state,
      alteration_class: b.alteration_class,
      expiry_type:     b.expiry_type,
      challengeable:   b.challengeable,
    })),
    admissibility_matrix,
    governance_history_count: allGov.filter((g: any) => g.molecule_id === molecule_id).length,
    evaluated_at: now(),
  };
}

// ─────────────────────────────────────────────
// ACTION: GET ACTIVE BINDINGS
// Returns all ACTIVE bindings in the system, optionally scoped
// ─────────────────────────────────────────────

async function getActiveBindings(payload: any, base44: any): Promise<any> {
  const { molecule_id, scope_type, binding_type } = payload;

  const allBindings = await base44.asServiceRole.entities.JournalBinding.list();
  let active = allBindings.filter((b: any) => b.binding_state === "ACTIVE");

  if (molecule_id)  active = active.filter((b: any) => b.molecule_id === molecule_id || (b.scope_ids ?? []).includes(molecule_id));
  if (scope_type)   active = active.filter((b: any) => b.scope_type === scope_type);
  if (binding_type) active = active.filter((b: any) => b.binding_type === binding_type);

  return {
    success: true,
    active_binding_count: active.length,
    bindings: active,
    evaluated_at: now(),
    register_note: BINDING_TYPE_REGISTER.length === 0
      ? "Binding Type Register is empty — no named types ratified yet. Bindings may be created manually via activate_bindings."
      : `${BINDING_TYPE_REGISTER.length} binding type(s) registered.`,
  };
}

// ─────────────────────────────────────────────
// ACTION: ACTIVATE BINDINGS (manual / test)
// Manually trigger Binding activation for a given Fact.
// Used for testing and for post-ratification backfill.
// ─────────────────────────────────────────────

async function activateBindingsForFact(payload: any, base44: any): Promise<any> {
  const { fact_id } = payload;
  if (!fact_id) return { success: false, error: "fact_id required" };

  const allFacts    = await base44.asServiceRole.entities.JournalFact.list();
  const allMolecules = await base44.asServiceRole.entities.Molecule.list();
  const allBindings = await base44.asServiceRole.entities.JournalBinding.list();

  const fact     = allFacts.find((f: any) => f.fact_id === fact_id);
  if (!fact)     return { success: false, error: `Fact ${fact_id} not found` };

  const molecule = allMolecules.find((m: any) => m.molecule_id === fact.molecule_id);
  if (!molecule) return { success: false, error: `Molecule ${fact.molecule_id} not found` };

  const activated = await activateBindings(fact, molecule, allMolecules, allBindings, base44);

  return {
    success: true,
    fact_id,
    molecule_id: fact.molecule_id,
    bindings_activated: activated.length,
    activated,
    register_size: BINDING_TYPE_REGISTER.length,
    note: activated.length === 0
      ? "No Binding type rules matched this Fact. Register entries fire when named types are ratified."
      : undefined,
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

    if (action === "evaluate_governance")        return Response.json(await evaluateGovernance(payload, base44));
    if (action === "challenge_binding")          return Response.json(await challengeBinding(payload, base44));
    if (action === "resolve_binding_challenge")  return Response.json(await resolveBindingChallenge(payload, base44));
    if (action === "get_governance_profile")     return Response.json(await getGovernanceProfile(payload, base44));
    if (action === "get_active_bindings")        return Response.json(await getActiveBindings(payload, base44));
    if (action === "activate_bindings_for_fact") return Response.json(await activateBindingsForFact(payload, base44));

    return Response.json({
      error: `Unknown action: ${action}`,
      valid_actions: [
        "evaluate_governance",
        "challenge_binding",
        "resolve_binding_challenge",
        "get_governance_profile",
        "get_active_bindings",
        "activate_bindings_for_fact",
      ],
    }, { status: 400 });

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
