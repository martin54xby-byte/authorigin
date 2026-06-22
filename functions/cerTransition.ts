// AuthOrigin — CER Transition HTTP Endpoint
// Wraps the state machine for external calls
// Constitution v1.0

import { createClient } from "https://esm.sh/@base44/sdk@0.1.1";
import crypto from "node:crypto";

const LINEAGE_WEIGHTS: Record<string, number> = {
  direct_inheritance: 1.0, primary_citation: 0.8, decision_reference: 0.7,
  secondary_citation: 0.4, tangential_mention: 0.1,
};

const TRANSITION_MAP: Record<string, {
  from: string[]; to: string; fact_type: string;
  weight_class: string; polarity: number; requires_governance: boolean;
}> = {
  first_citation:                   { from: ["CREATED"], to: "EXPLORED", fact_type: "state_transition", weight_class: "operational", polarity: 1, requires_governance: false },
  challenge_raised:                 { from: ["EXPLORED","VERIFIED_WEAK","VERIFIED_STRONG","MATERIALISED","REINFORCED"], to: "COLLAPSING", fact_type: "state_transition", weight_class: "constitutional", polarity: -1, requires_governance: false },
  mandatory_review:                 { from: ["EXPLORED"], to: "COLLAPSING", fact_type: "state_transition", weight_class: "constitutional", polarity: 0, requires_governance: false },
  governance_invoked:               { from: ["COLLAPSING"], to: "UNDER_GOVERNANCE", fact_type: "state_transition", weight_class: "constitutional", polarity: 0, requires_governance: true },
  governance_approved_no_challenge: { from: ["UNDER_GOVERNANCE"], to: "VERIFIED_WEAK", fact_type: "governance_approved", weight_class: "constitutional", polarity: 1, requires_governance: true },
  survived_challenge:               { from: ["UNDER_GOVERNANCE"], to: "VERIFIED_STRONG", fact_type: "survived_challenge", weight_class: "constitutional", polarity: 1, requires_governance: true },
  impact_observed:                  { from: ["VERIFIED_WEAK","VERIFIED_STRONG"], to: "MATERIALISED", fact_type: "state_transition", weight_class: "operational", polarity: 1, requires_governance: true },
  reinforcement_confirmed:          { from: ["MATERIALISED"], to: "REINFORCED", fact_type: "state_transition", weight_class: "constitutional", polarity: 1, requires_governance: true },
  supersession:                     { from: ["REINFORCED","VERIFIED_WEAK","VERIFIED_STRONG","MATERIALISED","CONTEXTUAL"], to: "SUPERSEDED", fact_type: "superseded", weight_class: "constitutional", polarity: 0, requires_governance: true },
  contextualisation:                { from: ["REINFORCED","VERIFIED_WEAK","VERIFIED_STRONG","MATERIALISED"], to: "CONTEXTUAL", fact_type: "state_transition", weight_class: "constitutional", polarity: 0, requires_governance: true },
  deprecation:                      { from: ["CREATED","EXPLORED","COLLAPSING","UNDER_GOVERNANCE","VERIFIED_WEAK","VERIFIED_STRONG","MATERIALISED","REINFORCED","CONTEXTUAL"], to: "DEPRECATED", fact_type: "deprecated", weight_class: "constitutional", polarity: -1, requires_governance: true },
  rejection:                        { from: ["UNDER_GOVERNANCE"], to: "REJECTED", fact_type: "rejected", weight_class: "constitutional", polarity: -1, requires_governance: true },
  challenge_withdrawn:              { from: ["COLLAPSING"], to: "EXPLORED", fact_type: "state_transition", weight_class: "constitutional", polarity: 0, requires_governance: true },
};

const TERMINAL_STATES = ["SUPERSEDED","DEPRECATED","REJECTED"];
const VERIFICATION_GATED = ["MATERIALISED","REINFORCED"];
const CONSTITUTION_VERSION = "v1.0";

function checkInvariants(req: any): string | null {
  const rule = TRANSITION_MAP[req.trigger];
  if (VERIFICATION_GATED.includes(rule.to) && !req.governance_ref_id)
    return "C-2: Transition to MATERIALISED or REINFORCED requires governance_ref_id";
  if (req.trigger === "survived_challenge") {
    if (!req.challenge_id) return "C-5: survived_challenge requires challenge_id";
    if (!req.challenge_quality_score || req.challenge_quality_score <= 0) return "C-9: survived_challenge requires challenge_quality_score > 0";
    if (!req.governance_ref_id) return "C-5: survived_challenge requires governance_ref_id";
  }
  if (!req.journal_sequence || req.journal_sequence < 1) return "C-8: journal_sequence must be positive integer";
  if (!req.constitution_version) return "C-11: constitution_version is mandatory";
  if (req.trigger === "supersession" && !req.successor_id) return "Constitutional: supersession requires successor_id";
  if (req.trigger === "contextualisation" && !req.scope_definition) return "Constitutional: contextualisation requires scope_definition";
  if (rule.requires_governance && !req.governance_ref_id) return `Constitutional: ${req.trigger} requires governance_ref_id`;
  return null;
}

function computeFactHash(fact: any, prior_entry_hash: string): string {
  const content = JSON.stringify({ fact_id: fact.fact_id, molecule_id: fact.molecule_id, canonicalHash: fact.canonicalHash, fact_type: fact.fact_type, from_state: fact.from_state, to_state: fact.to_state, actor_id: fact.actor_id, actor_trust_score: fact.actor_trust_score, journal_sequence: fact.journal_sequence, constitution_version: fact.constitution_version, prior_entry_hash });
  return crypto.createHash("sha256").update(content).digest("hex");
}

function generateFactId(molecule_id: string, sequence: number): string {
  return crypto.createHash("sha256").update(`fact:${molecule_id}:${sequence}:${Date.now()}`).digest("hex").substring(0, 24);
}

function checkMandatoryReview(state: string, reuse_count: number, state_since: string): any {
  if (state !== "EXPLORED") return { mandatory_review_required: false };
  const months = (Date.now() - new Date(state_since).getTime()) / (1000*60*60*24*30.44);
  if (reuse_count >= 50 && months >= 24) return { mandatory_review_required: true, reason: `C-6: ${reuse_count} citations, ${months.toFixed(1)} months in EXPLORED` };
  return { mandatory_review_required: false };
}

export default async function handler(req: Request): Promise<Response> {
  const base44 = createClient(req);

  try {
    const body = await req.json();
    const { action, ...payload } = body;

    // ── ACTION: execute_transition ───────────────────────────────
    if (action === "execute_transition") {
      const rule = TRANSITION_MAP[payload.trigger];
      if (!rule) return Response.json({ valid: false, error: `Unknown trigger: ${payload.trigger}` }, { status: 400 });
      if (TERMINAL_STATES.includes(payload.current_state))
        return Response.json({ valid: false, error: `Molecule is in terminal state ${payload.current_state}` }, { status: 400 });
      if (!rule.from.includes(payload.current_state))
        return Response.json({ valid: false, error: `Invalid transition: ${payload.current_state} → ${rule.to} via ${payload.trigger}` }, { status: 400 });
      const violation = checkInvariants(payload);
      if (violation) return Response.json({ valid: false, error: violation, invariant_violated: violation }, { status: 422 });

      const fact_id = generateFactId(payload.molecule_id, payload.journal_sequence);
      const factWithoutHash = {
        fact_id, molecule_id: payload.molecule_id, canonicalHash: payload.canonicalHash,
        fact_type: rule.fact_type, weight_class: rule.weight_class, polarity: rule.polarity,
        from_state: payload.current_state, to_state: rule.to,
        governance_ref_id: payload.governance_ref_id,
        observation_refs: payload.observation_refs ?? [],
        challenge_id: payload.challenge_id, challenge_quality_score: payload.challenge_quality_score,
        survival_type: payload.survival_type, successor_id: payload.successor_id,
        scope_definition: payload.scope_definition,
        actor_id: payload.actor_id, actor_domain_id: payload.actor_domain_id,
        actor_trust_score: payload.actor_trust_score,  // FROZEN
        constitution_version: CONSTITUTION_VERSION,
        journal_sequence: payload.journal_sequence,
        prior_entry_hash: payload.prior_entry_hash,
      };
      const fact_hash = computeFactHash(factWithoutHash, payload.prior_entry_hash);
      const fact = { ...factWithoutHash, fact_hash };

      // Persist fact to JournalFact entity
      const saved = await base44.asServiceRole.entities.JournalFact.create(fact);

      // Update Molecule state
      if (payload.molecule_db_id) {
        const updates: any = {
          current_state: rule.to,
          state_since: new Date().toISOString(),
          last_fact_id: fact_id,
          constitutional_status: "COMPLIANT",
        };
        if (rule.to === "COLLAPSING") updates.active_challenge_id = payload.challenge_id ?? payload.governance_ref_id;
        if (["VERIFIED_WEAK","VERIFIED_STRONG"].includes(rule.to)) {
          updates.kCv_v_quality = rule.to === "VERIFIED_STRONG" ? "STRONG" : "WEAK";
          updates.active_challenge_id = null;
        }
        if (rule.to === "SUPERSEDED") updates.successor_molecule_id = payload.successor_id;
        if (rule.to === "CONTEXTUAL") updates.scope_definition = payload.scope_definition;
        await base44.asServiceRole.entities.Molecule.update(payload.molecule_db_id, updates);
      }

      return Response.json({ valid: true, new_state: rule.to, fact, saved_fact_id: saved.id });
    }

    // ── ACTION: check_mandatory_review ──────────────────────────
    if (action === "check_mandatory_review") {
      const result = checkMandatoryReview(payload.current_state, payload.reuse_count, payload.state_since);
      return Response.json(result);
    }

    // ── ACTION: check_compliance ────────────────────────────────
    if (action === "check_compliance") {
      const m = payload;
      const violations: string[] = [];
      if ((m.kCv_i_score ?? 0) > 0 && (m.kCv_v_score ?? 0) === 0) violations.push("C-2: kCv_i without kCv_v");
      if ((m.kCv_r_score ?? 0) > 0 && (m.kCv_v_score ?? 0) === 0) violations.push("C-2: kCv_r without kCv_v");
      if (m.current_state === "VERIFIED_STRONG" && m.kCv_v_quality !== "STRONG") violations.push("C-5: VERIFIED_STRONG requires STRONG quality");
      const mr = checkMandatoryReview(m.current_state, m.reuse_count, m.state_since);
      if (mr.mandatory_review_required) violations.push(`C-6: ${mr.reason}`);
      return Response.json({ compliant: violations.length === 0, violations });
    }

    // ── ACTION: compute_challenge_quality ───────────────────────
    if (action === "compute_challenge_quality") {
      const { challenger_trust_score, challenge_evidence_depth, challenge_novelty, challenger_challenge_history } = payload;
      const score = Math.min(1.0, Math.max(0.0,
        (challenger_trust_score * 0.40) + (challenge_evidence_depth * 0.30) +
        (challenge_novelty * 0.20) + (challenger_challenge_history * 0.10)
      ));
      return Response.json({ challenge_quality_score: score, breakdown: {
        trust_contribution: challenger_trust_score * 0.40,
        evidence_contribution: challenge_evidence_depth * 0.30,
        novelty_contribution: challenge_novelty * 0.20,
        history_contribution: challenger_challenge_history * 0.10,
      }});
    }

    return Response.json({ error: `Unknown action: ${action}. Valid: execute_transition, check_mandatory_review, check_compliance, compute_challenge_quality` }, { status: 400 });

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
