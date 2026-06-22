# AuthOrigin — System Architecture

> Constitution v1.0 | Phase 1–5 Complete | June 22, 2026

## The Stack

```
┌──────────────────────────────────────────────────────────┐
│  PHASE 5 — Constitutional Retrieval                      │
│  constitutionalRetrieval                                 │
│  • constitutional_query   two-phase kCv-gated query      │
│  • filter_by_kcv          phase 1 pre-filter only        │
│  • get_lineage_bundle     full ancestor provenance       │
│  • get_retrieval_audit_log every query is observable     │
│  Gates: C-R1(kCv_v>0) C-R2(aggregate floor)             │
│         C-R3(no PROVISIONAL/WEAKENED) C-R4(state)       │
│         C-R5(constitutional receipt on every response)   │
├──────────────────────────────────────────────────────────┤
│  PHASE 4 — kCv Projection Engine                         │
│  kCvProjection                                           │
│  • project_kcv            full dimensional projection    │
│  • project_kcv_index      ranked system-wide index       │
│  • project_kcv_velocity   rate of kCv generation        │
│                                                          │
│  kCv_o  Originality      (lineage graph, sibling count) │
│  kCv_u  Utility          (reuse + citation observations) │
│  kCv_v  Verification     (survived_challenge facts)      │
│  kCv_i  Impact           (outcome obs, gated by kCv_v)  │
│  kCv_r  Resilience       (survival rate + longevity)     │
│  kCvRank Lineage auth    (damped ancestor kCv_r)         │
│                                                          │
│  kCv is NEVER stored. Always projected from the journal. │
├──────────────────────────────────────────────────────────┤
│  PHASE 3 — Challenge Protocol Engine                     │
│  challengeProtocol                                       │
│  • raise_challenge        C-9 quality, C-10 escalation  │
│  • invoke_governance      assemble quorum if required    │
│  • resolve_challenge      upheld/partial/rejected        │
│  • get_challenge_status   full lifecycle timeline        │
│                                                          │
│  C-7: propagation pressure fires to all dependents      │
│  C-9: quality = trust(0.4)+evidence(0.3)+novelty(0.2)  │
│              +history(0.1)                               │
│  C-10: Tier 0(auto) 1(threshold) 2(human) 3(quorum)    │
├──────────────────────────────────────────────────────────┤
│  PHASE 2 — CER State Machine                             │
│  cerStateMachine + cerTransition                         │
│  • execute_transition     validates + persists to journal│
│  • check_mandatory_review C-6 threshold enforcement     │
│  • check_compliance       constitutional violation check │
│  • compute_challenge_quality C-9 formula                │
│                                                          │
│  CREATED → EXPLORED → COLLAPSING → UNDER_GOVERNANCE     │
│    → VERIFIED_WEAK | VERIFIED_STRONG                     │
│    → MATERIALISED → REINFORCED                           │
│    → SUPERSEDED | CONTEXTUAL | DEPRECATED | REJECTED    │
├──────────────────────────────────────────────────────────┤
│  PHASE 1 — Entity Schemas (Origin Journal)               │
│                                                          │
│  Molecule               Identity + state + kCv signals  │
│  JournalObservation     Non-state-changing events        │
│  JournalFact            Constitutional facts (append-only│
│  JournalGovernanceRecord Challenge lifecycle records     │
│  JournalIntegrityRecord Chain verification snapshots     │
│  Domain                 Trust domain registry            │
│                                                          │
│  Every record: append-only, hash-chained, sequenced      │
├──────────────────────────────────────────────────────────┤
│  CONSTITUTION v1.0 — 23 invariants, locked               │
│  constitution/v1.0/invariants.md                         │
└──────────────────────────────────────────────────────────┘
```

## Data Flow

```
Knowledge arrives
      ↓
JournalObservation (polarity, trust-weighted, actor frozen)
      ↓
CER State Machine evaluates (cerTransition)
      ↓
JournalFact written (hash-chained, append-only)
      ↓
Molecule state updated
      ↓
Challenge raised? → challengeProtocol
  ↓ C-7 propagation to dependents
  ↓ C-9 quality scored
  ↓ C-10 escalation tiered
  ↓ Governance record written
  ↓ Resolution fact written
      ↓
kCvProjection reads all facts + observations
  ↓ Never from stored value — always from journal
  ↓ kCv_v grows with each survival
  ↓ kCv_r compounds longevity × survival rate
  ↓ kCv_u increments on every retrieval
      ↓
constitutionalRetrieval gates every query
  ↓ C-R1: kCv_v > tier floor
  ↓ C-R2: kCv_aggregate > tier floor
  ↓ C-R3: propagation not PROVISIONAL/WEAKENED
  ↓ C-R4: state is retrieval-authoritative
  ↓ C-R5: constitutional receipt issued
      ↓
Answer returned with provenance + receipt hash
Every retrieval writes reuse_event → feeds kCv_u
```

## Live Endpoints

| Endpoint | Actions |
|----------|---------|
| `cerTransition` | execute_transition, check_mandatory_review, check_compliance, compute_challenge_quality |
| `challengeProtocol` | raise_challenge, invoke_governance, resolve_challenge, get_challenge_status |
| `kCvProjection` | project_kcv, project_kcv_index, project_kcv_velocity |
| `constitutionalRetrieval` | constitutional_query, filter_by_kcv, get_lineage_bundle, get_retrieval_audit_log |

## Constitutional Parameters (v1.0)

| Parameter | Value | Rule |
|-----------|-------|------|
| Trust floor | 0.1 | C-4 |
| Mandatory review | reuse ≥ 50 AND age ≥ 24 months | C-6 |
| Propagation depths | PROVISIONAL(1) WEAKENED(2) NOTED(3+) | C-7 |
| C-9 weights | trust(0.40) evidence(0.30) novelty(0.20) history(0.10) | C-9 |
| Governance reserve | 12% | C-23 |
| Default damping | 0.6 | — |
| kCv aggregate weights | kCv_v(0.35) kCv_r(0.25) kCv_i(0.20) kCv_u(0.12) kCv_o(0.08) | — |

## Access Tier Gates

| Tier | min kCv_v | min aggregate | Use case |
|------|-----------|---------------|----------|
| open | 0.0 | 0.0 | Raw exploration |
| standard | >0.01 | ≥0.10 | General retrieval |
| verified | ≥0.20 | ≥0.25 | Trusted answers |
| authoritative | ≥0.27 | ≥0.30 | STRONG survival required |
| foundational | ≥0.50 | ≥0.50 | Constitutional bedrock only |

## Key Design Invariants

- **kCv is never stored** — always projected from the journal
- **actor_trust_score is frozen at event time** — domain trust changes don't rewrite history
- **Every retrieval is observable** — reuse_event written back, feeds kCv_u live
- **Mesh provides corroboration, not authority** — local runtime computes final kCv
- **molecule_id ≠ canonicalHash** — identity survives content changes
- **Constitutional necessity drives granularity** — not token count
