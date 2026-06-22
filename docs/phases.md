# AuthOrigin — Phase Completion Status

| Phase | Name | Status | Key Output |
|-------|------|--------|------------|
| 1 | Entity Schemas | ✅ Complete | 6 constitutional entity schemas |
| 2 | CER State Machine | ✅ Complete | 11-state machine + cerTransition endpoint |
| 3 | Challenge Protocol | ✅ Complete | Full lifecycle: raise → invoke → resolve |
| 4 | kCv Projection Engine | ✅ Complete | Runtime projection: kCv_o/u/v/i/r/Rank |
| 5 | Constitutional Retrieval | ✅ Complete | Two-phase gated query + constitutional receipt |

## Phase 1 — Entity Schemas
Six append-only, hash-chained journal layers:
- `Molecule` — knowledge artefact identity and state
- `JournalObservation` — non-state-changing evidence events
- `JournalFact` — constitutional facts, append-only, polarity-signed
- `JournalGovernanceRecord` — challenge lifecycle records
- `JournalIntegrityRecord` — chain verification snapshots
- `Domain` — trust domain registry with challenge history

## Phase 2 — CER State Machine
11-state constitutional lifecycle machine. Every transition validated against Constitution v1.0. Live HTTP endpoint at `cerTransition`.

States: `CREATED → EXPLORED → COLLAPSING → UNDER_GOVERNANCE → VERIFIED_WEAK / VERIFIED_STRONG → MATERIALISED → REINFORCED → SUPERSEDED / CONTEXTUAL / DEPRECATED / REJECTED`

## Phase 3 — Challenge Protocol Engine
Full challenge lifecycle with C-7 propagation pressure, C-9 quality scoring, and C-10 escalation tier routing. Live HTTP endpoint at `challengeProtocol`.

- `raise_challenge` — validates trust floor, computes C-9 quality, fires propagation
- `invoke_governance` — escalates, assembles quorum if Tier 3
- `resolve_challenge` — upheld/partially_upheld/rejected, updates domain trust, clears propagation
- `get_challenge_status` — full timeline from journal

## Phase 4 — kCv Projection Engine
kCv is **never stored**. Always projected as a runtime function over the Origin Journal. Every component is traceable to a specific fact or observation ID. Live HTTP endpoint at `kCvProjection`.

- `project_kcv` — full dimensional projection with audit trace
- `project_kcv_index` — system-wide ranked index with health metrics
- `project_kcv_velocity` — rate of kCv generation over a time window

## Phase 5 — Constitutional Retrieval Layer
Every query is gated through kCv before knowledge surfaces. Every response carries a constitutional receipt with a reproducible hash. Every retrieval is written back to the journal as a `reuse_event`, feeding `kCv_u` in future projections. Live HTTP endpoint at `constitutionalRetrieval`.

- `constitutional_query` — full two-phase gated retrieval
- `filter_by_kcv` — phase 1 pre-filter with gate log
- `get_lineage_bundle` — full ancestor provenance with kCv scores at each depth
- `get_retrieval_audit_log` — complete history of what was returned and when
