// AuthOrigin — CER Transition HTTP Endpoint
// Constitution v1.1 — July 2026
//
// WIRING: Constitutional Validation is now a mandatory gate.
// execute_transition cannot proceed to state mutation unless
// constitutionalValidation.evaluateRules returns ADMISSIBLE.
//
// AUTHORITY MODEL
// ---------------
// from_state      — read from DB via evidence (not payload.current_state)
// actor_trust     — read from Domain record via evidence (not payload.actor_trust_score)
// fact_chain      — verified against JournalFact in DB
// bindings        — verified against JournalBinding in DB
// rules           — loaded from the governed rule molecule (not embedded constant)
//
// WHAT STILL COMES FROM PAYLOAD
// ------------------------------
// molecule_db_id  — Base44 record ID for Molecule.update (routing, not trust)
// journal_sequence + prior_entry_hash — chain threading (structural, not admissibility)
// governance_ref_id, challenge_id, successor_id, scope_definition — supplementary
//   evidence that the validator may check for existence, but their VALUES are
//   only used to populate the fact after admissibility is confirmed.
//
// JournalFact.metadata carries { evaluation_id, rule_molecule_id } so every
// fact is traceable to the exact constitutional evaluation that permitted it.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { createHash } from "node:crypto";

const CONSTITUTION_VERSION = "v1.1";
const RULE_SCOPE           = "csm:admissibility-rules";
const TERMINAL_STATES      = ["SUPERSEDED", "DEPRECATED", "REJECTED"];

function sha256(...parts: any[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}
function now(): string { return new Date().toISOString(); }

// ─────────────────────────────────────────────────────────────────────────────
// LOAD ACTIVE RULES FROM DB
// Same contract as constitutionalValidation.ts — queries the rule molecule,
// throws if not found or unparseable. No fallback to embedded constants.
// ─────────────────────────────────────────────────────────────────────────────

async function loadActiveRules(base44: any): Promise<{ rules: any; rule_molecule_id: string }> {
  const all = await base44.asServiceRole.entities.Molecule.list();
  const candidates = all.filter((m: any) =>
    m.scope_definition === RULE_SCOPE &&
    m.molecule_type    === "definition" &&
    m.constitutional_status === "active" &&
    !TERMINAL_STATES.includes(m.current_state)
  ).sort((a: any, b: any) => {
    if (a.is_foundational && !b.is_foundational) return -1;
    if (!a.is_foundational && b.is_foundational) return  1;
    return (b.created_date ?? "").localeCompare(a.created_date ?? "");
  });

  if (candidates.length === 0) {
    throw new Error(
      `Constitutional violation: no active rule molecule found ` +
      `(scope="${RULE_SCOPE}"). Cannot execute any state transition.`
    );
  }

  let rules: any;
  try {
    rules = JSON.parse(candidates[0].lexical_content);
  } catch (e: any) {
    throw new Error(
      `Constitutional violation: rule molecule ${candidates[0].molecule_id} ` +
      `has unparseable lexical_content. Cannot execute any state transition.`
    );
  }

  return { rules, rule_molecule_id: candidates[0].molecule_id };
}

// ─────────────────────────────────────────────────────────────────────────────
// GATHER CONSTITUTIONAL EVIDENCE
// All values come from DB. Caller claims for state, trust, fact-chain,
// and bindings are ignored.
// ─────────────────────────────────────────────────────────────────────────────

async function gatherEvidence(
  molecule_id: string,
  proposed_action: string,
  actor_domain_id: string,
  rules: any,
  base44: any
): Promise<any> {
  const rule = rules[proposed_action];

  const [allMolecules, allDomains, allFacts, allGovRecords, allBindings] = await Promise.all([
    base44.asServiceRole.entities.Molecule.list(),
    base44.asServiceRole.entities.Domain.list(),
    base44.asServiceRole.entities.JournalFact.list(),
    base44.asServiceRole.entities.JournalGovernanceRecord.list(),
    base44.asServiceRole.entities.JournalBinding.list(),
  ]);

  const mol    = allMolecules.find((m: any) => m.molecule_id === molecule_id);
  const domain = allDomains.find((d: any) => d.domain_id === actor_domain_id);
  const actor_trust_score = domain ? (domain.trust_score ?? 0) : 0;

  const moleculeFacts = allFacts.filter((f: any) => f.molecule_id === molecule_id);
  const required = rule ? (rule.predecessor_facts ?? []) : [];
  const found: any[] = [];
  const missing: any[] = [];
  for (const req of required) {
    const match = moleculeFacts.find(
      (f: any) => f.to_state === req.to_state && (!req.fact_type || f.fact_type === req.fact_type)
    );
    if (match) found.push({ to_state: match.to_state, fact_type: match.fact_type, fact_id: match.fact_id });
    else        missing.push(req);
  }

  const govRecord = allGovRecords
    .filter((g: any) => g.molecule_id === molecule_id)
    .sort((a: any, b: any) => (b.journal_sequence ?? 0) - (a.journal_sequence ?? 0))[0] ?? null;

  const activeBindings = allBindings.filter((b: any) =>
    b.binding_state === "ACTIVE" &&
    (b.molecule_id === molecule_id ||
     (Array.isArray(b.scope_ids) && b.scope_ids.includes(molecule_id)))
  );

  return {
    molecule_id,
    molecule_found:        !!mol,
    molecule_db_id:        mol?.id ?? null,   // Base44 record ID for Molecule.update
    molecule_state:        mol?.current_state ?? null,
    molecule_reuse_count:  mol?.reuse_count   ?? 0,
    molecule_foundational: mol?.is_foundational ?? false,
    molecule_kCv_rank:     mol?.kCv_rank ?? 0,
    canonicalHash:         mol?.canonicalHash ?? null,
    actor_domain_found:    !!domain,
    actor_trust_score,
    fact_chain:     { required, found, missing },
    governance_record: govRecord,
    active_bindings:   activeBindings,
    snapshot_hash: sha256({
      molecule_id, proposed_action, actor_domain_id,
      molecule_state:           mol?.current_state ?? null,
      actor_trust_score,
      fact_chain_missing_count: missing.length,
      active_binding_count:     activeBindings.length,
      governance_record_id:     govRecord?.governance_id ?? null,
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EVALUATE RULES
// Receives loaded rules as parameter — never reads from an embedded constant.
// ─────────────────────────────────────────────────────────────────────────────

function evaluateRules(proposed_action: string, evidence: any, rules: any): any {
  const blocking: any[] = [];
  const conditioning: any[] = [];
  const rule = rules[proposed_action];

  if (!rule) return {
    verdict: "UNKNOWN_ACTION",
    blocking_reasons: [{ layer: "state", rule: "TRANSITION_MAP",
      what_exists: proposed_action,
      what_is_required: "A valid TransitionTrigger in the active rule molecule" }],
    conditioning_obligations: [],
  };

  if (!evidence.molecule_found)
    blocking.push({ layer: "molecule", rule: "MOLECULE_EXISTS",
      what_exists: "no molecule record in DB",
      what_is_required: `Molecule ${evidence.molecule_id} must exist` });

  if (evidence.molecule_state && TERMINAL_STATES.includes(evidence.molecule_state))
    blocking.push({ layer: "terminal", rule: "NO_TRANSITION_FROM_TERMINAL",
      what_exists: `current_state = ${evidence.molecule_state}`,
      what_is_required: "Terminal states admit no further transitions" });

  if (evidence.molecule_state &&
      !TERMINAL_STATES.includes(evidence.molecule_state) &&
      !(rule.from_states ?? []).includes(evidence.molecule_state))
    blocking.push({ layer: "state", rule: "VALID_FROM_STATE",
      what_exists: `current_state = ${evidence.molecule_state} (authoritative DB value)`,
      what_is_required: `One of: ${(rule.from_states ?? []).join(", ")}` });

  if (evidence.actor_trust_score < (rule.trust_floor ?? 0))
    blocking.push({ layer: "trust", rule: "ACTOR_TRUST_FLOOR",
      what_exists: evidence.actor_domain_found
        ? `Domain.trust_score = ${evidence.actor_trust_score}`
        : `Domain "${evidence.molecule_id}" not found in DB (trust = 0)`,
      what_is_required: `trust_score ≥ ${rule.trust_floor}` });

  for (const m of evidence.fact_chain.missing)
    blocking.push({ layer: "fact_chain", rule: "PREDECESSOR_FACT_EXISTS",
      what_exists: `no JournalFact with to_state="${m.to_state}"`,
      what_is_required: m.label });

  if (rule.requires_governance) {
    if (!evidence.governance_record)
      blocking.push({ layer: "governance", rule: "GOVERNANCE_RECORD_EXISTS",
        what_exists: "no JournalGovernanceRecord for this molecule",
        what_is_required: "An open JournalGovernanceRecord must exist" });
    else {
      if (rule.governance_status &&
          evidence.governance_record.challenge_status !== rule.governance_status)
        blocking.push({ layer: "governance", rule: "GOVERNANCE_RECORD_STATUS",
          what_exists: `challenge_status = ${evidence.governance_record.challenge_status}`,
          what_is_required: `challenge_status = ${rule.governance_status}` });
      if (rule.requires_challenge_id && !evidence.governance_record.challenger_id)
        blocking.push({ layer: "governance", rule: "CHALLENGE_ID_REQUIRED",
          what_exists: "governance_record.challenger_id is absent",
          what_is_required: "Challenge-originated GovernanceRecord required for survived_challenge" });
    }
  }

  for (const binding of evidence.active_bindings) {
    for (const fc of (binding.foreclosures ?? []))
      if (fc.applies_to === proposed_action || fc.applies_to === "all_governance")
        blocking.push({ layer: "binding", rule: "BINDING_FORECLOSURE",
          what_exists: `binding_id=${binding.binding_id} forecloses "${fc.applies_to}"`,
          what_is_required: "No active Binding may foreclose this action" });
    for (const ob of (binding.obligations ?? [])) {
      const bp: string[] = ob.blocking_paths ?? [];
      if (bp.includes(proposed_action) || bp.includes("all_governance"))
        conditioning.push({ binding_id: binding.binding_id, binding_type: binding.binding_type,
          obligation_type: ob.obligation_type, discharge_condition: ob.discharge_condition });
    }
  }

  if (blocking.length > 0)     return { verdict: "INADMISSIBLE", blocking_reasons: blocking, conditioning_obligations: conditioning };
  if (conditioning.length > 0) return { verdict: "CONDITIONED",  blocking_reasons: [],     conditioning_obligations: conditioning };
  return                               { verdict: "ADMISSIBLE",   blocking_reasons: [],     conditioning_obligations: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// FACT HASH CHAIN
// ─────────────────────────────────────────────────────────────────────────────

function computeFactHash(fact: any, prior_entry_hash: string): string {
  const content = JSON.stringify({
    fact_id: fact.fact_id, molecule_id: fact.molecule_id, canonicalHash: fact.canonicalHash,
    fact_type: fact.fact_type, from_state: fact.from_state, to_state: fact.to_state,
    actor_id: fact.actor_id, actor_trust_score: fact.actor_trust_score,
    journal_sequence: fact.journal_sequence, constitution_version: fact.constitution_version,
    prior_entry_hash,
  });
  return createHash("sha256").update(content).digest("hex");
}

function generateFactId(molecule_id: string, sequence: number): string {
  return createHash("sha256")
    .update(`fact:${molecule_id}:${sequence}:${Date.now()}`)
    .digest("hex")
    .substring(0, 24);
}

// ─────────────────────────────────────────────────────────────────────────────
// MANDATORY REVIEW HELPER (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function checkMandatoryReview(state: string, reuse_count: number, state_since: string): any {
  if (state !== "EXPLORED") return { mandatory_review_required: false };
  const months = (Date.now() - new Date(state_since).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  if (reuse_count >= 50 && months >= 24)
    return { mandatory_review_required: true, reason: `C-6: ${reuse_count} citations, ${months.toFixed(1)} months in EXPLORED` };
  return { mandatory_review_required: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTE TRANSITION — main action
// Constitutional validation is the gate. No mutation occurs without ADMISSIBLE.
// ─────────────────────────────────────────────────────────────────────────────

async function executeTransition(payload: any, base44: any): Promise<any> {
  const {
    molecule_id,
    molecule_db_id,          // Base44 record ID for Molecule.update — routing only
    trigger,
    actor_id        = "unknown",
    actor_domain_id = "unknown",
    journal_sequence,        // chain threading — structural, not admissibility
    prior_entry_hash,        // chain threading
    governance_ref_id,
    challenge_id,
    challenge_quality_score,
    survival_type,
    successor_id,
    scope_definition,
    observation_refs = [],
  } = payload;

  // ── Structural pre-checks (not admissibility — just well-formedness) ──────
  if (!molecule_id)  return { valid: false, error: "molecule_id required" };
  if (!trigger)      return { valid: false, error: "trigger required" };
  if (!journal_sequence || journal_sequence < 1)
    return { valid: false, error: "C-8: journal_sequence must be a positive integer" };
  if (!prior_entry_hash)
    return { valid: false, error: "prior_entry_hash required for hash chain integrity" };

  // ── Step 1: Load rules from DB ────────────────────────────────────────────
  const { rules, rule_molecule_id } = await loadActiveRules(base44);

  // ── Step 2: Gather constitutional evidence from DB ────────────────────────
  const evidence = await gatherEvidence(molecule_id, trigger, actor_domain_id, rules, base44);

  // ── Step 3: Evaluate constitutional rules ─────────────────────────────────
  const evaluated_at    = now();
  const { verdict, blocking_reasons, conditioning_obligations } = evaluateRules(trigger, evidence, rules);
  const evaluation_id   = sha256(molecule_id, trigger, actor_id, rule_molecule_id, evidence.snapshot_hash).substring(0, 24);
  const evaluation_hash = sha256(evaluation_id, evidence.snapshot_hash, verdict, rule_molecule_id, evaluated_at);

  const evaluation_summary = {
    evaluation_id, rule_molecule_id, verdict,
    molecule_state_at_evaluation: evidence.molecule_state,
    actor_trust_at_evaluation:    evidence.actor_trust_score,
    evaluated_at, evaluation_hash,
  };

  // ── Step 4: Gate — INADMISSIBLE and CONDITIONED both halt here ────────────
  if (verdict !== "ADMISSIBLE") {
    return {
      valid: false,
      constitutional_rejection: true,
      verdict,
      blocking_reasons,
      conditioning_obligations,
      evaluation: evaluation_summary,
      message: verdict === "CONDITIONED"
        ? "Transition is conditionally admissible. Discharge all obligations before proceeding."
        : "Transition is constitutionally inadmissible. See blocking_reasons.",
    };
  }

  // ── Step 5: Permitted — write JournalFact ─────────────────────────────────
  const rule    = rules[trigger];
  const fact_id = generateFactId(molecule_id, journal_sequence);

  const factWithoutHash = {
    fact_id,
    molecule_id,
    canonicalHash:          evidence.canonicalHash ?? payload.canonicalHash ?? "",
    fact_type:              rule.fact_type,
    weight_class:           rule.weight_class,
    polarity:               rule.polarity,
    from_state:             evidence.molecule_state,  // DB value — not payload
    to_state:               rule.to_state,
    governance_ref_id:      governance_ref_id  ?? null,
    observation_refs:       observation_refs,
    challenge_id:           challenge_id       ?? null,
    challenge_quality_score: challenge_quality_score ?? null,
    survival_type:          survival_type      ?? null,
    successor_id:           successor_id       ?? null,
    scope_definition:       scope_definition   ?? null,
    actor_id,
    actor_domain_id,
    actor_trust_score:      evidence.actor_trust_score,  // DB value — FROZEN from Domain record
    constitution_version:   CONSTITUTION_VERSION,
    journal_sequence,
    prior_entry_hash,
    metadata: {                                          // evaluation provenance
      evaluation_id,
      rule_molecule_id,
      evaluated_at,
      evaluation_hash,
    },
  };

  const fact_hash = computeFactHash(factWithoutHash, prior_entry_hash);
  const fact      = { ...factWithoutHash, fact_hash };

  const saved = await base44.asServiceRole.entities.JournalFact.create(fact);

  // ── Step 6: Update Molecule state ─────────────────────────────────────────
  const db_id = molecule_db_id ?? evidence.molecule_db_id;
  if (db_id) {
    const updates: any = {
      current_state:        rule.to_state,
      state_since:          now(),
      last_fact_id:         fact_id,
      constitutional_status: "active",
    };
    if (rule.to_state === "COLLAPSING")
      updates.active_challenge_id = challenge_id ?? governance_ref_id ?? null;
    if (["VERIFIED_WEAK", "VERIFIED_STRONG"].includes(rule.to_state)) {
      updates.kCv_v_quality     = rule.to_state === "VERIFIED_STRONG" ? "STRONG" : "WEAK";
      updates.active_challenge_id = null;
    }
    if (rule.to_state === "SUPERSEDED") updates.successor_molecule_id = successor_id;
    if (rule.to_state === "CONTEXTUAL") updates.scope_definition       = scope_definition;
    await base44.asServiceRole.entities.Molecule.update(db_id, updates);
  }

  return {
    valid:        true,
    new_state:    rule.to_state,
    fact,
    saved_fact_id: saved.id,
    evaluation:   evaluation_summary,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP HANDLER
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const { action, ...payload } = await req.json();

    if (action === "execute_transition") {
      return Response.json(await executeTransition(payload, base44));
    }

    if (action === "check_mandatory_review") {
      const result = checkMandatoryReview(payload.current_state, payload.reuse_count, payload.state_since);
      return Response.json(result);
    }

    if (action === "check_compliance") {
      const m       = payload;
      const violations: string[] = [];
      if ((m.kCv_i_score ?? 0) > 0 && (m.kCv_v_score ?? 0) === 0) violations.push("C-2: kCv_i without kCv_v");
      if ((m.kCv_r_score ?? 0) > 0 && (m.kCv_v_score ?? 0) === 0) violations.push("C-2: kCv_r without kCv_v");
      if (m.current_state === "VERIFIED_STRONG" && m.kCv_v_quality !== "STRONG") violations.push("C-5: VERIFIED_STRONG requires STRONG quality");
      const mr = checkMandatoryReview(m.current_state, m.reuse_count ?? 0, m.state_since ?? now());
      if (mr.mandatory_review_required) violations.push(mr.reason);
      return Response.json({ compliant: violations.length === 0, violations });
    }

    return Response.json({
      error: "Unknown action",
      valid_actions: ["execute_transition", "check_mandatory_review", "check_compliance"],
    }, { status: 400 });

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
