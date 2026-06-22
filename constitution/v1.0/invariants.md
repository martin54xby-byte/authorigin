# AuthOrigin — Constitutional Invariants Register
## C-1 through C-23 — Constitution v1.0 LOCKED
### June 22, 2026 — Authoritative Version

---

This register is the canonical reference for all AuthOrigin Constitutional Invariants.
Every JournalFact produced by the system references a constitution_version.
This document constitutes Constitution v1.0 — LOCKED June 22, 2026.

No invariant may be amended without a governance quorum.
All amendments produce a new constitution version.
Historical facts remain governed by the version under which they were produced.

---

## CONSTITUTIONAL PARAMETERS (v1.0)

  C-6  Mandatory review thresholds:
         N = 50 distinct citing molecules
         T = 24 months from EXPLORED state entry
         Both conditions must be met simultaneously.

  C-23 Governance reserve rate:     12% of all payment flows
  
  C-9  Challenge quality weights:
         challenger_trust_score        × 0.40
         challenge_evidence_depth      × 0.30
         challenge_novelty             × 0.20
         challenger_challenge_history  × 0.10
         All inputs normalised 0.0 → 1.0

  C-7  Propagation depth rule:
         Depth 1 = PROVISIONAL
         Depth 2 = WEAKENED
         Depth 3+ = NOTED (flat, no further attenuation)
         Exception: FOUNDATIONAL molecules propagate NOTED indefinitely.

  Damping factor:
         Constitutional default: 0.6 per generation
         Constitutional minimum: 0.4
         Constitutional maximum: 0.8
         Domain governance may adjust within bounds without amendment.
         Outside bounds requires constitutional amendment.

---

## CATEGORY A — Knowledge State Invariants

### C-1 — Potential vs Realised Contribution
Potential Contribution may not be represented as Realised Contribution.
kCv scores must distinguish between potential (pre-governance) and realised
(post-governance) states. No molecule may present a Realised Contribution score
without corresponding governance facts in its lineage.

### C-2 — Verification Gate
kCv_v gates kCv_i and kCv_r.
No molecule may carry a non-provisional Impact or Resilience score
without a verified Governance event in its lineage.

### C-3 — Verification Quality Gradation
VERIFIED_STRONG requires evidence of prior challenge.
Uncontested approval produces kCv_v (WEAK).
Challenge-survived approval produces kCv_v (STRONG).
These are categorically different constitutional states,
not degrees of the same state.

### C-5 — VERIFIED_STRONG Requires Survived Challenge
VERIFIED_STRONG requires at least one resolved survived_challenge event
in the molecule's direct lineage.
Time, reuse volume, and uncontested governance approval
are insufficient conditions for VERIFIED_STRONG.

### C-6 — Mandatory Review for High-Utility Unchallenged Molecules
Any molecule in state EXPLORED with:
  reuse_count > 50 distinct citing molecules
  AND age > 24 months from EXPLORED state entry
  AND no challenge on record
MUST be promoted to COLLAPSING via a governance-initiated mandatory review event.
Both conditions must be met simultaneously.
This is epistemic hygiene, not punitive action.

---

## CATEGORY B — Governance Authority Invariants

### C-8 — Facts Override Observations
Constitutional Fact events take precedence over Observation events
in all state, scoring, and governance computations.
No volume of observations may override a constitutional fact.
Specifically:
  governance_rejected cannot be overridden by citation volume.
  lineage_conflict_confirmed cannot be overridden by endorsement count.
  survived_challenge cannot be downgraded by subsequent negative observations
  without a new governance process producing a new fact.
The only thing that changes a constitutional fact is a new constitutional fact.

### C-10 — Proportional Governance Escalation
Governance escalation must be proportional to constitutional impact.
Tier escalation requires explicit justification recorded in the journal.
No molecule may be escalated beyond its constitutional necessity.

### C-11 — Constitutional Amendment Immutability
Constitution amendments are constitutional facts.
They require governance quorum.
They are recorded in the Fact Layer.
They do not retroactively alter facts produced under prior versions.
Historical constitutional reality is immutable.

---

## CATEGORY C — Trust Invariants

### C-4 — Trust Emerges from Survival
Domain trust emerges from demonstrated knowledge survival,
not from contribution volume.
A domain is trusted by the mesh to the degree that its molecules
have repeatedly encountered scrutiny, governance review,
and real-world application — and remained intact.

### C-13 — Trust Is Not Assigned
Trust is not assigned. Trust is not computed centrally.
Trust emerges from the behaviour of the knowledge graph
under adversarial conditions over time.
The Constitutional Reality Engine does not decide who is trusted.
It records what happened, governs what is real,
and allows trust to emerge from survival history.
Central trust assignment is prohibited as a governance mechanism.

---

## CATEGORY D — Challenge Protocol Invariants

### C-7 — Challenge Propagation Attenuation
Challenge propagation attenuates with lineage depth.
  Depth 1 (direct citation):    PROVISIONAL
  Depth 2 (second-order):       WEAKENED
  Depth 3+ (third-order+):      NOTED (flat — no further attenuation)
Exception: FOUNDATIONAL molecules (designated by governance quorum)
propagate NOTED status indefinitely regardless of depth.
Propagation is always visible in the Origin Journal.
Attenuation does not mean invisibility.

### C-9 — Challenge Quality Weighting
survived_challenge kCv_v weight is proportional to challenge_quality_score,
not to challenge count.

  challenge_quality_score = (
    challenger_trust_score        × 0.40
    + challenge_evidence_depth    × 0.30
    + challenge_novelty           × 0.20
    + challenger_challenge_history × 0.10
  )
  All inputs normalised 0.0 → 1.0.

A survived low-quality challenge from a low-trust domain
produces minimal kCv_v uplift.
A survived high-quality challenge from a high-trust domain
produces significant kCv_v uplift.
Challenge farming is structurally penalised through challenger history tracking.

---

## CATEGORY E — Evidence and Provenance Invariants

### C-12 — Absence of Evidence
Absence of recorded evidence is not evidence of absence of contribution.
kCv represents observed contribution value, not total contribution value.
The gap between these two is Capture Bias.
No constitutional fact may assert zero contribution
on the sole basis of zero observation.
Zero observation implies: contribution not yet evidenced.

### C-14 — Inferred Lineage Status
Inferred lineage is not constitutional lineage.
It is a lineage hypothesis — an observation, not a fact.
Constitutional lineage requires a governance fact confirming the relationship.
Inferred lineage is recorded in the Observation Layer.
It contributes to kCv_o calculation.
It does not propagate constitutional pressure.

### C-15 — Legacy Data Protection
Legacy molecules with evidence_gap_flag = true are not penalised
in kCv computation for absence of evidence.
Their kCv profile reflects what evidence was recoverable,
what lineage was reconstructible,
and what governance events were recorded.
A molecule with evidence gaps is older and less documented.
That is different from being lower quality.

---

## CATEGORY F — LLM and AI Accountability Invariants

### C-16 — Training Manifest Requirement
Every LLM training run against AuthOrigin molecules
must produce a TrainingDataManifest as a governance fact.
Training without a manifest is constitutionally unauthorised.
The manifest must record all included molecules with their constitutional
state at inclusion, all excluded molecules with exclusion basis,
and all constitutional thresholds applied.

### C-17 — Inference Provenance Requirement
Every inference response generated from AuthOrigin molecules
must produce an InferenceProvenanceRecord.
Anonymous generation from constitutional knowledge is prohibited.
The record must include model_id, training_manifest_id,
RAG sources with constitutional state at generation time,
and constitutional confidence classification.

### C-18 — LLM Responses Are Molecules
LLM responses are molecules.
They enter the Origin Journal as CREATED.
They are subject to the full constitutional pipeline.
Model-generated content has no special constitutional status —
it earns its kCv through the same survival process
as any other knowledge artefact.

---

## CATEGORY G — Financial Accountability Invariants

### C-19 — Constitutional Pricing
Payment amount is derived from constitutional quality,
not from retrieval volume alone.
Price = f(kCv), not f(popularity).

### C-20 — Lineage Distribution
Payment distribution follows the lineage graph.
Direct authors receive the majority share.
Lineage contributors receive attenuated shares
proportional to their kCvRank contribution.
No payment may bypass lineage distribution.
The governance reserve is collected before distribution.

  Distribution formula:
    Direct molecule author:     payment × 0.50
    Lineage contributors:       payment × 0.50 × kCv_r(A) × damping^D × lineage_weight
    Governance reserve:         payment × 0.12 (collected before distribution)

### C-21 — Escrow During Challenge
Molecules under active challenge (COLLAPSING state)
may not generate new payment obligations
until constitutional status is resolved.
Existing payment streams are held in escrow during the challenge window.
This prevents extract-then-challenge gaming.

### C-22 — Rejection Payment Prohibition
REJECTED molecules must not generate payments after rejection fact is recorded.
Payments generated between challenge_raised and governance_rejected
are subject to constitutional clawback governance process.
The clawback process requires governance quorum to execute.

### C-23 — Governance Reserve
A governance reserve of 12% is collected on every payment.
This rate is a constitutional parameter.
It cannot be set or changed without constitutional amendment.
Reserve funds: challenge protocol operations, governance quorum processes,
resolution actor compensation, constitutional maintenance.
It cannot be redirected to operational, sales, or product purposes
without constitutional amendment.

---

## Amendment Log

| Version | Date | Amendment | Quorum |
|---------|------|-----------|--------|
| v1.0 | June 22, 2026 | Initial constitution — C-1 through C-23, all parameters resolved and locked | Founding governance |

---

## Pending Constitutional Questions

None. Constitution v1.0 is complete and locked.

All parameters resolved June 22, 2026:
  C-6 thresholds:          N=50, T=24 months ✓
  C-23 reserve rate:       12% ✓
  C-9 quality weights:     trust(0.40) evidence(0.30) novelty(0.20) history(0.10) ✓
  C-7 depth rule:          NOTED flat from depth 3+, FOUNDATIONAL exception ✓
  Damping factor:          0.6 default, 0.4-0.8 bounds, domain-adjustable ✓

Next constitutional action:
  Phase 1 implementation begins.
  Any implementation decision that conflicts with C-1 through C-23
  requires a constitutional amendment, not an operational override.

---

*AuthOrigin Constitutional Invariants Register — Constitution v1.0 LOCKED*
*June 22, 2026*
*This document is a constitutional fact.*
*Amendments require governance quorum and produce Constitution v1.1+*
