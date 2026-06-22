# AuthOrigin — Constitutional Knowledge Substrate

> *Knowledge earns trust by surviving. Trust is observed, not assigned.*

AuthOrigin is a constitutional substrate for provenance-native knowledge governance. Every piece of knowledge — claim, evidence, decision, model output — enters a constitutional lifecycle, earns its trust through challenge and survival, and generates verifiable value traced through its lineage.

## Constitutional Architecture

```
Origin Journal (append-only, hash-chained)
  ├── JournalObservation   — things that happened (non-state-changing)
  ├── JournalGovernanceRecord — challenge and governance processes
  ├── JournalFact          — constitutional facts (state-changing, authoritative)
  └── JournalIntegrityRecord — chain verification snapshots

CER State Machine
  CREATED → EXPLORED → COLLAPSING → UNDER_GOVERNANCE
    → VERIFIED_WEAK | VERIFIED_STRONG → MATERIALISED → REINFORCED
    → SUPERSEDED | CONTEXTUAL | DEPRECATED | REJECTED

kCv — Knowledge Contribution Value
  kCv_o  Originality        (observation-derived)
  kCv_u  Utility            (observation-derived)
  kCv_v  Verification       (fact-derived, WEAK or STRONG)
  kCv_i  Impact             (fact-derived, gated by kCv_v)
  kCv_r  Resilience         (fact-derived, gated by kCv_v)
  kCvRank Lineage authority  (survival-weighted ancestor graph)
```

## Constitution v1.0 — Key Parameters

| Parameter | Value | Invariant |
|-----------|-------|-----------|
| Mandatory review threshold | reuse ≥ 50 AND age ≥ 24 months | C-6 |
| Governance reserve rate | 12% | C-23 |
| Challenge quality weights | trust(0.40) evidence(0.30) novelty(0.20) history(0.10) | C-9 |
| Propagation depth | PROVISIONAL(1) WEAKENED(2) NOTED(3+, flat) | C-7 |
| Damping factor | 0.6 default, 0.4–0.8 domain-adjustable | Constitutional |

## Repository Structure

```
constitution/v1.0/       Constitutional Invariants Register (C-1 through C-23)
entities/                Entity schemas (database tables)
functions/               Backend functions (TypeScript)
tests/                   Test suites
docs/                    Architecture, GTM, phase documentation
```

## Phase Status

- [x] Phase 1 — Entity schemas (Molecule, Journal layers, Domain)
- [x] Phase 2 — CER State Machine + cerTransition HTTP endpoint (55/55 tests)
- [ ] Phase 3 — Challenge Protocol Engine
- [ ] Phase 4 — kCv Projection Engine
- [ ] Phase 5 — Two-Phase Constitutional Retrieval

## Live Endpoints (Base44 prototype)

- **CER Transition:** `/functions/cerTransition`
  - `execute_transition` — validate + persist state transition
  - `check_mandatory_review` — C-6 threshold check
  - `check_compliance` — constitutional violation detection
  - `compute_challenge_quality` — C-9 formula

## Constitution v1.0 — Locked June 22, 2026

All 23 invariants locked. No amendment without governance quorum.
