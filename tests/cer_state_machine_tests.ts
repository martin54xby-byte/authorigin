// AuthOrigin — CER State Machine Test Suite
// Validates all constitutional invariants and transition rules
// Constitution v1.0

import {
  executeTransition, checkMandatoryReview, computePropagationStatus,
  computeChallengeQualityScore, computeKCvRank,
  checkConstitutionalCompliance, computeHealthMetrics,
  computePaymentDistribution, TransitionRequest
} from "./cer_state_machine";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ✗  ${name}`);
    console.log(`       ${e.message}`);
    failures.push(`${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

const BASE_REQUEST: TransitionRequest = {
  molecule_id: "mol-001",
  canonicalHash: "abc123def456",
  current_state: "CREATED",
  trigger: "first_citation",
  actor_id: "actor-001",
  actor_domain_id: "domain-001",
  actor_trust_score: 0.75,
  prior_entry_hash: "0000000000000000",
  journal_sequence: 1,
  constitution_version: "v1.0",
};

// ─────────────────────────────────────────────
// VALID TRANSITIONS
// ─────────────────────────────────────────────
console.log("\n── Valid Transition Tests ──────────────────");

test("CREATED → EXPLORED via first_citation", () => {
  const result = executeTransition({ ...BASE_REQUEST });
  assert(result.valid, `Expected valid, got: ${result.error}`);
  assert(result.new_state === "EXPLORED", `Expected EXPLORED, got ${result.new_state}`);
  assert(result.fact?.fact_type === "state_transition", "Expected state_transition fact");
  assert(result.fact?.polarity === 1, "Expected positive polarity");
});

test("EXPLORED → COLLAPSING via challenge_raised", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "EXPLORED",
    trigger: "challenge_raised", journal_sequence: 2,
  });
  assert(result.valid, `Expected valid, got: ${result.error}`);
  assert(result.new_state === "COLLAPSING", `Expected COLLAPSING`);
  assert(result.fact?.polarity === -1, "Challenge must be negative polarity");
});

test("COLLAPSING → UNDER_GOVERNANCE via governance_invoked", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "COLLAPSING",
    trigger: "governance_invoked",
    governance_ref_id: "gov-001", journal_sequence: 3,
  });
  assert(result.valid, `Expected valid, got: ${result.error}`);
  assert(result.new_state === "UNDER_GOVERNANCE", "Expected UNDER_GOVERNANCE");
});

test("UNDER_GOVERNANCE → VERIFIED_WEAK via governance_approved_no_challenge", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "UNDER_GOVERNANCE",
    trigger: "governance_approved_no_challenge",
    governance_ref_id: "gov-002", journal_sequence: 4,
  });
  assert(result.valid, `Expected valid, got: ${result.error}`);
  assert(result.new_state === "VERIFIED_WEAK", "Expected VERIFIED_WEAK");
  assert(result.fact?.fact_type === "governance_approved", "Expected governance_approved fact type");
});

test("UNDER_GOVERNANCE → VERIFIED_STRONG via survived_challenge", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "UNDER_GOVERNANCE",
    trigger: "survived_challenge",
    governance_ref_id: "gov-003",
    challenge_id: "challenge-001",
    challenge_quality_score: 0.82,
    survival_type: "intact",
    journal_sequence: 5,
  });
  assert(result.valid, `Expected valid, got: ${result.error}`);
  assert(result.new_state === "VERIFIED_STRONG", "Expected VERIFIED_STRONG");
  assert(result.fact?.fact_type === "survived_challenge", "Expected survived_challenge fact");
  assert(result.fact?.challenge_quality_score === 0.82, "Quality score must be preserved");
});

test("VERIFIED_STRONG → MATERIALISED via impact_observed", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "VERIFIED_STRONG",
    trigger: "impact_observed",
    governance_ref_id: "gov-004", journal_sequence: 6,
  });
  assert(result.valid, `Expected valid, got: ${result.error}`);
  assert(result.new_state === "MATERIALISED", "Expected MATERIALISED");
});

test("MATERIALISED → REINFORCED via reinforcement_confirmed", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "MATERIALISED",
    trigger: "reinforcement_confirmed",
    governance_ref_id: "gov-005", journal_sequence: 7,
  });
  assert(result.valid, `Expected valid, got: ${result.error}`);
  assert(result.new_state === "REINFORCED", "Expected REINFORCED");
});

test("REINFORCED → SUPERSEDED via supersession", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "REINFORCED",
    trigger: "supersession",
    governance_ref_id: "gov-006",
    successor_id: "mol-002",
    journal_sequence: 8,
  });
  assert(result.valid, `Expected valid, got: ${result.error}`);
  assert(result.new_state === "SUPERSEDED", "Expected SUPERSEDED");
  assert(result.fact?.fact_type === "superseded", "Expected superseded fact type");
  assert(result.fact?.successor_id === "mol-002", "Successor ID must be preserved");
});

test("VERIFIED_STRONG → CONTEXTUAL via contextualisation", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "VERIFIED_STRONG",
    trigger: "contextualisation",
    governance_ref_id: "gov-007",
    scope_definition: "Applicable to EU manufacturing facilities only",
    journal_sequence: 9,
  });
  assert(result.valid, `Expected valid, got: ${result.error}`);
  assert(result.new_state === "CONTEXTUAL", "Expected CONTEXTUAL");
});

test("EXPLORED → DEPRECATED via deprecation", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "EXPLORED",
    trigger: "deprecation",
    governance_ref_id: "gov-008", journal_sequence: 10,
  });
  assert(result.valid, `Expected valid, got: ${result.error}`);
  assert(result.new_state === "DEPRECATED", "Expected DEPRECATED");
  assert(result.fact?.polarity === -1, "Deprecation is negative polarity");
});

test("UNDER_GOVERNANCE → REJECTED via rejection", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "UNDER_GOVERNANCE",
    trigger: "rejection",
    governance_ref_id: "gov-009", journal_sequence: 11,
  });
  assert(result.valid, `Expected valid, got: ${result.error}`);
  assert(result.new_state === "REJECTED", "Expected REJECTED");
  assert(result.fact?.fact_type === "rejected", "Expected rejected fact type");
});

// ─────────────────────────────────────────────
// INVALID TRANSITIONS — must be rejected
// ─────────────────────────────────────────────
console.log("\n── Invalid Transition Tests ────────────────");

test("CREATED cannot be challenged directly", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "CREATED",
    trigger: "challenge_raised", journal_sequence: 12,
  });
  assert(!result.valid, "CREATED → COLLAPSING should be invalid");
});

test("SUPERSEDED is a terminal state — no further transitions", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "SUPERSEDED",
    trigger: "challenge_raised", journal_sequence: 13,
  });
  assert(!result.valid, "Terminal state must reject all transitions");
  assert(result.error?.includes("terminal"), "Error must mention terminal state");
});

test("REJECTED is a terminal state", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "REJECTED",
    trigger: "first_citation", journal_sequence: 14,
  });
  assert(!result.valid, "REJECTED must reject all transitions");
});

test("DEPRECATED is a terminal state", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "DEPRECATED",
    trigger: "governance_invoked",
    governance_ref_id: "gov-x", journal_sequence: 15,
  });
  assert(!result.valid, "DEPRECATED must reject all transitions");
});

test("EXPLORED cannot jump directly to VERIFIED_STRONG", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "EXPLORED",
    trigger: "survived_challenge",
    governance_ref_id: "gov-x",
    challenge_id: "ch-x",
    challenge_quality_score: 0.9,
    survival_type: "intact",
    journal_sequence: 16,
  });
  assert(!result.valid, "Must go through COLLAPSING → UNDER_GOVERNANCE first");
});

// ─────────────────────────────────────────────
// CONSTITUTIONAL INVARIANT ENFORCEMENT
// ─────────────────────────────────────────────
console.log("\n── Constitutional Invariant Tests ──────────");

test("C-5: survived_challenge without challenge_id is rejected", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "UNDER_GOVERNANCE",
    trigger: "survived_challenge",
    governance_ref_id: "gov-010",
    challenge_quality_score: 0.8,
    survival_type: "intact",
    journal_sequence: 17,
    // challenge_id deliberately omitted
  });
  assert(!result.valid, "C-5 must reject survived_challenge without challenge_id");
  assert(result.invariant_violated?.includes("C-5"), `Expected C-5 violation, got: ${result.invariant_violated}`);
});

test("C-5: survived_challenge without governance_ref_id is rejected", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "UNDER_GOVERNANCE",
    trigger: "survived_challenge",
    challenge_id: "ch-001",
    challenge_quality_score: 0.8,
    survival_type: "intact",
    journal_sequence: 18,
    // governance_ref_id deliberately omitted
  });
  assert(!result.valid, "C-5 must reject survived_challenge without governance_ref_id");
});

test("C-9: survived_challenge with zero quality score is rejected", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "UNDER_GOVERNANCE",
    trigger: "survived_challenge",
    governance_ref_id: "gov-011",
    challenge_id: "ch-002",
    challenge_quality_score: 0,  // zero quality
    survival_type: "intact",
    journal_sequence: 19,
  });
  assert(!result.valid, "C-9 must reject zero challenge quality score");
  assert(result.invariant_violated?.includes("C-9"), `Expected C-9 violation`);
});

test("C-11: missing constitution_version is rejected", () => {
  const result = executeTransition({
    ...BASE_REQUEST,
    constitution_version: "",  // deliberately empty
    trigger: "first_citation",
    journal_sequence: 20,
  });
  assert(!result.valid, "C-11 must reject missing constitution_version");
});

test("C-8: journal_sequence of 0 is rejected", () => {
  const result = executeTransition({
    ...BASE_REQUEST,
    journal_sequence: 0,  // invalid
    trigger: "first_citation",
  });
  assert(!result.valid, "C-8 must reject journal_sequence = 0");
});

test("Constitutional: supersession without successor_id rejected", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "REINFORCED",
    trigger: "supersession",
    governance_ref_id: "gov-012",
    journal_sequence: 21,
    // successor_id deliberately omitted
  });
  assert(!result.valid, "Supersession without successor_id must be rejected");
});

test("Constitutional: contextualisation without scope_definition rejected", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "VERIFIED_STRONG",
    trigger: "contextualisation",
    governance_ref_id: "gov-013",
    journal_sequence: 22,
    // scope_definition deliberately omitted
  });
  assert(!result.valid, "Contextualisation without scope_definition must be rejected");
});

test("C-2: MATERIALISED requires governance_ref_id", () => {
  const result = executeTransition({
    ...BASE_REQUEST, current_state: "VERIFIED_STRONG",
    trigger: "impact_observed",
    // governance_ref_id deliberately omitted
    journal_sequence: 23,
  });
  assert(!result.valid, "C-2: MATERIALISED transition must require governance backing");
});

// ─────────────────────────────────────────────
// HASH CHAIN INTEGRITY
// ─────────────────────────────────────────────
console.log("\n── Hash Chain Tests ────────────────────────");

test("Each fact produces a unique fact_hash", () => {
  const r1 = executeTransition({ ...BASE_REQUEST, journal_sequence: 24 });
  const r2 = executeTransition({ ...BASE_REQUEST, journal_sequence: 25 });
  assert(r1.valid && r2.valid, "Both transitions should be valid");
  assert(r1.fact!.fact_hash !== r2.fact!.fact_hash, "Different sequences must produce different hashes");
});

test("Fact hash changes when prior_entry_hash changes", () => {
  const r1 = executeTransition({ ...BASE_REQUEST, prior_entry_hash: "aaaa", journal_sequence: 26 });
  const r2 = executeTransition({ ...BASE_REQUEST, prior_entry_hash: "bbbb", journal_sequence: 26 });
  assert(r1.valid && r2.valid, "Both should be valid");
  assert(r1.fact!.fact_hash !== r2.fact!.fact_hash, "Different prior hashes must produce different fact hashes");
});

test("actor_trust_score is frozen in the fact", () => {
  const result = executeTransition({ ...BASE_REQUEST, actor_trust_score: 0.88, journal_sequence: 27 });
  assert(result.valid, "Should be valid");
  assert(result.fact!.actor_trust_score === 0.88, "Trust score must be preserved exactly as provided");
});

// ─────────────────────────────────────────────
// C-6 MANDATORY REVIEW
// ─────────────────────────────────────────────
console.log("\n── C-6 Mandatory Review Tests ──────────────");

test("C-6: triggered when reuse >= 50 AND age >= 24 months", () => {
  const old_date = new Date();
  old_date.setMonth(old_date.getMonth() - 25);
  const result = checkMandatoryReview("EXPLORED", 51, old_date.toISOString());
  assert(result.mandatory_review_required, "Must trigger when both thresholds met");
});

test("C-6: NOT triggered when reuse >= 50 but age < 24 months", () => {
  const recent = new Date();
  recent.setMonth(recent.getMonth() - 12);
  const result = checkMandatoryReview("EXPLORED", 51, recent.toISOString());
  assert(!result.mandatory_review_required, "Must not trigger when age threshold not met");
});

test("C-6: NOT triggered when age >= 24 months but reuse < 50", () => {
  const old_date = new Date();
  old_date.setMonth(old_date.getMonth() - 25);
  const result = checkMandatoryReview("EXPLORED", 49, old_date.toISOString());
  assert(!result.mandatory_review_required, "Must not trigger when reuse threshold not met");
});

test("C-6: NOT triggered for non-EXPLORED states", () => {
  const old_date = new Date();
  old_date.setMonth(old_date.getMonth() - 36);
  const result = checkMandatoryReview("VERIFIED_STRONG", 200, old_date.toISOString());
  assert(!result.mandatory_review_required, "C-6 only applies to EXPLORED state");
});

// ─────────────────────────────────────────────
// C-7 PROPAGATION
// ─────────────────────────────────────────────
console.log("\n── C-7 Propagation Tests ───────────────────");

test("Depth 1 = PROVISIONAL", () => {
  assert(computePropagationStatus(1, false) === "PROVISIONAL", "Depth 1 must be PROVISIONAL");
});

test("Depth 2 = WEAKENED", () => {
  assert(computePropagationStatus(2, false) === "WEAKENED", "Depth 2 must be WEAKENED");
});

test("Depth 3 = NOTED", () => {
  assert(computePropagationStatus(3, false) === "NOTED", "Depth 3 must be NOTED");
});

test("Depth 4 = NOTED (flat — C-7)", () => {
  assert(computePropagationStatus(4, false) === "NOTED", "Depth 4+ must still be NOTED (flat)");
});

test("Depth 10 = NOTED (flat — C-7)", () => {
  assert(computePropagationStatus(10, false) === "NOTED", "Depth 10 must still be NOTED");
});

test("Depth 0 = CLEAR", () => {
  assert(computePropagationStatus(0, false) === "CLEAR", "Depth 0 must be CLEAR");
});

// ─────────────────────────────────────────────
// C-9 QUALITY SCORE
// ─────────────────────────────────────────────
console.log("\n── C-9 Challenge Quality Tests ─────────────");

test("C-9: full score weights sum correctly", () => {
  const score = computeChallengeQualityScore(1.0, 1.0, 1.0, 1.0);
  assert(Math.abs(score - 1.0) < 0.001, `Perfect inputs should give 1.0, got ${score}`);
});

test("C-9: zero inputs give zero", () => {
  const score = computeChallengeQualityScore(0, 0, 0, 0);
  assert(score === 0, `Zero inputs should give 0, got ${score}`);
});

test("C-9: trust is weighted 0.40", () => {
  const score = computeChallengeQualityScore(1.0, 0, 0, 0);
  assert(Math.abs(score - 0.40) < 0.001, `Trust alone should give 0.40, got ${score}`);
});

test("C-9: evidence is weighted 0.30", () => {
  const score = computeChallengeQualityScore(0, 1.0, 0, 0);
  assert(Math.abs(score - 0.30) < 0.001, `Evidence alone should give 0.30, got ${score}`);
});

test("C-9: novelty is weighted 0.20", () => {
  const score = computeChallengeQualityScore(0, 0, 1.0, 0);
  assert(Math.abs(score - 0.20) < 0.001, `Novelty alone should give 0.20, got ${score}`);
});

test("C-9: history is weighted 0.10", () => {
  const score = computeChallengeQualityScore(0, 0, 0, 1.0);
  assert(Math.abs(score - 0.10) < 0.001, `History alone should give 0.10, got ${score}`);
});

// ─────────────────────────────────────────────
// kCvRANK COMPUTATION
// ─────────────────────────────────────────────
console.log("\n── kCvRank Tests ───────────────────────────");

test("kCvRank: direct_inheritance at depth 1 with full kCv_r", () => {
  const rank = computeKCvRank([{ molecule_id: "m1", kCv_r_score: 1.0, lineage_type: "direct_inheritance", depth: 1 }]);
  assert(Math.abs(rank - 1.0) < 0.001, `Expected 1.0, got ${rank}`);
});

test("kCvRank: depth 2 applies damping of 0.6", () => {
  const rank = computeKCvRank([{ molecule_id: "m1", kCv_r_score: 1.0, lineage_type: "direct_inheritance", depth: 2 }]);
  // damping^(depth-1) = 0.6^1 = 0.6 × lineage_weight 1.0 × kCv_r 1.0 = 0.6
  assert(Math.abs(rank - 0.6) < 0.001, `Expected 0.6, got ${rank}`);
});

test("kCvRank: tangential_mention weighted at 0.1", () => {
  const rank = computeKCvRank([{ molecule_id: "m1", kCv_r_score: 1.0, lineage_type: "tangential_mention", depth: 1 }]);
  assert(Math.abs(rank - 0.1) < 0.001, `Expected 0.1, got ${rank}`);
});

test("kCvRank: custom damping factor respected", () => {
  const rank = computeKCvRank([{
    molecule_id: "m1", kCv_r_score: 1.0,
    lineage_type: "direct_inheritance", depth: 2,
    domain_damping_factor: 0.8  // custom domain damping
  }]);
  // 0.8^1 = 0.8
  assert(Math.abs(rank - 0.8) < 0.001, `Expected 0.8 with custom damping, got ${rank}`);
});

// ─────────────────────────────────────────────
// PAYMENT DISTRIBUTION — C-20, C-23
// ─────────────────────────────────────────────
console.log("\n── Payment Distribution Tests ──────────────");

test("C-23: 12% governance reserve deducted first", () => {
  const dist = computePaymentDistribution(100, "author-1", []);
  assert(Math.abs(dist.governance_reserve - 12) < 0.01, `Expected 12, got ${dist.governance_reserve}`);
});

test("C-20: direct author receives 50% of distributable", () => {
  const dist = computePaymentDistribution(100, "author-1", []);
  // distributable = 100 - 12 = 88, author = 88 × 0.5 = 44
  assert(Math.abs(dist.direct_author_share - 44) < 0.01, `Expected 44, got ${dist.direct_author_share}`);
});

test("C-20: total distributed equals total payment", () => {
  const dist = computePaymentDistribution(100, "author-1", [
    { molecule_id: "m1", author_id: "author-2", kCv_r_score: 0.8, lineage_type: "primary_citation", depth: 1 },
    { molecule_id: "m2", author_id: "author-3", kCv_r_score: 0.6, lineage_type: "secondary_citation", depth: 2 },
  ]);
  assert(Math.abs(dist.total_distributed - 100) < 0.01, `Total must equal payment: ${dist.total_distributed}`);
});

test("C-23: reserve rate on £10 payment is £1.20", () => {
  const dist = computePaymentDistribution(10, "author-1", []);
  assert(Math.abs(dist.governance_reserve - 1.20) < 0.001, `Expected £1.20, got ${dist.governance_reserve}`);
});

// ─────────────────────────────────────────────
// CONSTITUTIONAL COMPLIANCE CHECKER
// ─────────────────────────────────────────────
console.log("\n── Constitutional Compliance Tests ─────────");

test("Compliant molecule passes all checks", () => {
  const result = checkConstitutionalCompliance({
    current_state: "VERIFIED_STRONG",
    kCv_v_score: 0.85,
    kCv_v_quality: "STRONG",
    kCv_i_score: 0.6,
    kCv_r_score: 0.7,
    reuse_count: 30,
    state_since: new Date().toISOString(),
  });
  assert(result.compliant, `Expected compliant, violations: ${result.violations.join(", ")}`);
});

test("C-2: kCv_i without kCv_v is a violation", () => {
  const result = checkConstitutionalCompliance({
    current_state: "EXPLORED",
    kCv_v_score: 0,
    kCv_i_score: 0.5,
    kCv_r_score: 0,
    reuse_count: 5,
    state_since: new Date().toISOString(),
  });
  assert(!result.compliant, "Should detect C-2 violation");
  assert(result.violations.some(v => v.includes("C-2")), `Expected C-2 violation: ${result.violations}`);
});

test("C-5: VERIFIED_STRONG without STRONG quality is a violation", () => {
  const result = checkConstitutionalCompliance({
    current_state: "VERIFIED_STRONG",
    kCv_v_score: 0.5,
    kCv_v_quality: "WEAK",  // mismatch
    kCv_i_score: 0,
    kCv_r_score: 0,
    reuse_count: 5,
    state_since: new Date().toISOString(),
  });
  assert(!result.compliant, "Should detect C-5 violation");
  assert(result.violations.some(v => v.includes("C-5")), `Expected C-5 violation: ${result.violations}`);
});

// ─────────────────────────────────────────────
// HEALTH METRICS
// ─────────────────────────────────────────────
console.log("\n── Health Metric Tests ─────────────────────");

test("GCPC, ECPC, VRPC computed correctly", () => {
  const metrics = computeHealthMetrics({
    total_governance_events: 100,
    total_observation_events: 500,
    total_contribution_events: 50,
    total_payments_to_contributors: 2500,
  });
  assert(Math.abs(metrics.gcpc - 2.0) < 0.001, `GCPC: expected 2.0, got ${metrics.gcpc}`);
  assert(Math.abs(metrics.ecpc - 10.0) < 0.001, `ECPC: expected 10.0, got ${metrics.ecpc}`);
  assert(Math.abs(metrics.vrpc - 50.0) < 0.001, `VRPC: expected 50.0, got ${metrics.vrpc}`);
});

test("Zero contributions returns zero metrics (no division by zero)", () => {
  const metrics = computeHealthMetrics({
    total_governance_events: 0,
    total_observation_events: 0,
    total_contribution_events: 0,
    total_payments_to_contributors: 0,
  });
  assert(metrics.gcpc === 0 && metrics.ecpc === 0 && metrics.vrpc === 0, "Zero inputs must return zero safely");
});

// ─────────────────────────────────────────────
// RESULTS
// ─────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════");
console.log(`  Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\n  Failures:");
  failures.forEach(f => console.log(`    - ${f}`));
}
console.log("═══════════════════════════════════════════\n");

if (failed > 0) process.exit(1);
