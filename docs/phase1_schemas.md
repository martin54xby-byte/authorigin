# AuthOrigin — Phase 1 Entity Schemas
## Implementation Reference — June 22, 2026

---

Phase 1 Status: COMPLETE
All five entities created and live.
Constitution v1.0 enforced throughout.

---

## Entity Dependency Order

  1. Domain               — trust graph nodes, referenced by all journal entries
  2. Molecule             — canonical knowledge state, the primary entity
  3. JournalObservation   — Observation Layer (fluid, non-state-changing)
  4. JournalGovernanceRecord — Governance Layer (process records)
  5. JournalFact          — Fact Layer (constitutional authority, state-changing)
  6. JournalIntegrityRecord — Integrity Layer (chain verification + constitutional snapshot)

---

## Entity 1 — Domain

Purpose: Trust graph nodes. Every actor in the system belongs to a domain.
Constitutional reference: C-4, C-13
Key invariants:
  trust_score floor = 0.1 (never zero)
  trust emerges from survived_challenge facts, not from assignment
  challenge_history_score feeds C-9 quality calculation
  damping_factor: 0.4-0.8 range, default 0.6

Key fields:
  domain_id               stable unique identity
  trust_score             current score (0.1 floor)
  challenge_history_score C-9 input: fraction of challenges upheld
  challenges_raised       total challenges raised
  challenges_upheld       challenges where molecule survived
  damping_factor          kCvRank attenuation (0.4-0.8)
  access_tier_granted     maximum constitutional access
  endorsed_by_domains[]   trust graph inbound edges
  inactivity_decay_due    when decay activates if no activity

---

## Entity 2 — Molecule

Purpose: CanonicalMoleculeState — the materialised constitutional reality for each molecule.
Constitutional reference: C-1 through C-8, C-12, C-14, C-15
Key invariants:
  molecule_id != canonicalHash (identity vs content)
  current_state follows CER state machine rules
  kCv_v gates kCv_i and kCv_r (C-2)
  evidence_gap_flag protects legacy molecules (C-15)
  reuse_count tracked for C-6 mandatory review
  mandatory_review_due computed from state_since + 24 months when reuse_count >= 50

Key fields:
  molecule_id             permanent identity
  canonicalHash           content hash (SHA-256)
  molecule_type           claim|evidence|reasoning|context|conclusion|container|...
  current_state           CER state machine position
  constitutional_status   COMPLIANT|FLAGGED|SUSPENDED
  access_tier             PUBLIC through SOVEREIGN
  is_foundational         C-7 exception — NOTED propagates indefinitely
  kCv_o, kCv_u            observation-derived dimensions
  kCv_v_score, kCv_v_quality  fact-derived, WEAK or STRONG
  kCv_i_score, kCv_i_status   fact-derived, with propagation status
  kCv_r_score, kCv_r_status   fact-derived, with propagation status
  kCv_rank                lineage authority score
  evidence_gap_flag       C-12/C-15 protection
  reuse_count             C-6 threshold tracking
  propagation_status      PROVISIONAL|WEAKENED|NOTED|CLEAR
  parent_molecule_ids[]   lineage graph
  lineage_types[]         relationship type per parent
  lineage_certainty       CONFIRMED|PROBABLE|INFERRED|UNKNOWN
  damping_factor          0.6 default, domain-adjustable within 0.4-0.8
  mandatory_review_due    C-6 deadline

---

## Entity 3 — JournalObservation (Observation Layer)

Purpose: Record things that happened. High volume, non-state-changing, conflict-tolerant.
Constitutional reference: C-8 (observations never override facts), C-12, C-14
Key invariants:
  observations DO NOT change constitutional reality
  conflicting observations are preserved, not resolved (conflict_flag + conflict_ref_id)
  actor_trust_score is frozen at time of observation — never updated retroactively
  journal_sequence must be monotonically increasing with no gaps

Key fields:
  observation_id          stable identity
  observation_type        citation|reuse|model_signal|attestation|outcome|decision|...
  polarity                +1|0|-1
  conflict_flag           true if contradicts existing observation
  conflict_ref_id         reference to conflicting observation
  actor_trust_score       FROZEN snapshot — prevents retroactive manipulation
  lineage_type            relationship type for citation/reuse events
  model_signal_type       for model_signal_received events
  model_signal_value      normalised 0.0-1.0
  gap_type                for evidence_gap_observed events
  propagation_depth       for propagation inheritance events
  journal_sequence        monotonically increasing, no gaps
  observation_hash        chained with prior_entry_hash — integrity chain
  prior_entry_hash        enables chain verification

---

## Entity 4 — JournalGovernanceRecord (Governance Layer)

Purpose: Process records for challenge lifecycle and governance deliberation.
Constitutional reference: C-9, C-10
Key invariants:
  governance records document process, they do not produce facts directly
  resulting_fact_id links to the JournalFact this process produced
  challenge_quality_score computed from four C-9 inputs
  escalation_tier must be proportional to constitutional impact (C-10)

Key fields:
  governance_id           stable identity
  governance_type         challenge_raised|under_review|resolved|...
  challenge_type          factual|semantic|governance|lineage|ethical
  challenge_status        OPEN|UNDER_REVIEW|RESOLVED
  resolution              upheld|partially_upheld|rejected (null if open)
  challenge_quality_score C-9: trust(0.40)+evidence(0.30)+novelty(0.20)+history(0.10)
  challenger_trust_score  C-9 input (0.0-1.0)
  challenge_evidence_depth C-9 input (0.0-1.0)
  challenge_novelty       C-9 input (0.0-1.0)
  challenger_challenge_history C-9 input (0.0-1.0)
  quorum_domains[]        domains forming governance quorum
  escalation_tier         0=autonomous|1=threshold|2=human|3=constitutional quorum
  resulting_fact_id       links to produced JournalFact

---

## Entity 5 — JournalFact (Fact Layer)

Purpose: Constitutional facts. State-changing. Sparse. Authoritative.
Constitutional reference: C-8 (facts override observations), all constitutional invariants
Key invariants:
  facts DO change constitutional reality — observations DO NOT
  constitution_version is mandatory on every fact
  actor_trust_score is frozen at time of fact — immutable forever
  governance_reserve_amount = payment_amount × 0.12 for payment facts (C-23)
  escrow_amount recorded during COLLAPSING challenge window (C-21)

Key fields:
  fact_id                 stable, immutable identity
  fact_type               molecule_created|survived_challenge|governance_approved|...
  weight_class            constitutional|operational
  polarity                +1|0|-1
  from_state, to_state    state transition (null if no transition)
  governance_ref_id       authorising JournalGovernanceRecord
  observation_refs[]      observations that informed this fact
  challenge_quality_score for survived_challenge facts
  survival_type           intact|refined|strengthened
  actor_trust_score       FROZEN FOREVER — never updated retroactively
  quorum_domains[]        for multi-domain facts
  payment_amount          for payment facts
  governance_reserve_amount 12% per C-23
  escrow_amount           per C-21 during challenge window
  constitution_version    MANDATORY — v1.0
  journal_sequence        monotonically increasing, no gaps
  fact_hash               chained integrity

---

## Entity 6 — JournalIntegrityRecord (Integrity Layer)

Purpose: Periodic constitutional snapshots. History chain verification. Health metrics.
Constitutional reference: C-11 (snapshots are governance facts, not infrastructure)
Key invariants:
  snapshots MUST be produced by a governance authority, not automated infrastructure
  constitutional_hash = hash(all active_fact_ids) = snapshot of current reality
  gcpc, ecpc, vrpc recorded at each snapshot for constitutional health monitoring
  event_chain_valid must be true — chain breaks indicate tampering

Key fields:
  integrity_id            stable identity
  covered_through_sequence journal sequence this snapshot covers
  constitutional_hash     hash(active_fact_ids) = current constitutional reality
  active_fact_ids[]       all facts composing current reality
  prior_event_hash        anchors snapshot in event chain
  event_chain_valid       boolean chain integrity check
  generated_by            governance authority (not infrastructure)
  gcpc_at_snapshot        Governance Cost Per Contribution
  ecpc_at_snapshot        Evidence Cost Per Contribution
  vrpc_at_snapshot        Value Returned Per Contribution
  integrity_hash          self-verifying

---

## The Journal Sequence Rule

All six entities that carry journal_sequence share a SINGLE monotonically increasing
sequence across all entry types. The sequence does not restart per entity type.

Entry order in the unified sequence:
  JournalObservation entries
  JournalGovernanceRecord entries
  JournalFact entries
  JournalIntegrityRecord entries

Gaps in the sequence indicate tampering or data loss.
The hash chain (observation_hash / governance_hash / fact_hash / integrity_hash)
is computed over: hash(this_record_content + prior_entry_hash)

---

## The Two Distinct Hash Purposes

  event_hash chain         "this is what happened, in order, unaltered"
                           verifies history integrity

  constitutional_hash      "this is what is currently real"
                           verifies current constitutional reality
                           stored in JournalIntegrityRecord

These serve different verification purposes:
  Auditing history         → verify the event hash chain
  Making governance decisions → verify the constitutional hash

---

## Phase 2 — Next Entities Required

  ConstitutionalSnapshot    (as a JournalFact subtype — already covered by fact_type)
  SemanticGovernanceMolecule (Molecule with molecule_type=semantic_governance — covered)
  VectorSafeID              (new entity — Phase 2, RAG integration)
  InferenceProvenanceRecord (new entity — Phase 2, LLM accountability)
  PaymentDistribution       (new entity — Phase 3, lineage payment tracking)
  TrainingDataManifest      (new entity — Phase 3, C-16 compliance)

---

## Constitutional Health Dashboard — Metrics to Monitor from Day 1

  GCPC = Total Governance Cost / Total Contribution Events
         Healthy: declining over time
         Warning: stable while contribution rate falls
         Critical: rising while trust metrics stagnate

  ECPC = Total Evidence Burden / Total Contribution Events
         Healthy: declining as automation improves
         Warning: rising — contributors spending more time proving than creating

  VRPC = Total Payments to Contributors / Total Contribution Events
         Healthy: rising while GCPC and ECPC fall
         Warning: rising but concentrated in few molecules (oligarchy signal)
         Critical: falling while retrieval volume rises (extraction signal)

All three recorded at every JournalIntegrityRecord snapshot.

---

*AuthOrigin Phase 1 Entity Schemas — June 22, 2026*
*Constitution v1.0*
*Implementation complete. Phase 2 begins: CER State Machine + Challenge Protocol Engine.*
