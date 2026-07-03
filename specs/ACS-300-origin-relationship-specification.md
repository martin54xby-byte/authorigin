# ACS-300 — Origin Relationship Specification

Status: RATIFIED (schema implemented, lineage engine not yet built)
Depends on: Origin Runtime Certification v1.0 (mol-cert-65ff24b0bb80)

## 1. Purpose

Define what a relationship between two molecules *is*, before any code creates one.
Prior plans referred to `SUPPORTS`, `DERIVES_FROM`, `CONTRADICTS` etc. as edge *names*.
They were not yet constitutional objects — a name is not provenance. This spec makes
every relationship in AuthOrigin a first-class, provenance-bearing molecule.

## 2. The four object classes

AuthOrigin now has exactly four constitutional object classes:

| Class | Describes | Persisted as |
|---|---|---|
| Runtime Event | Pre-identity execution (received, normalised) | RuntimeEvent entity, no molecule_id |
| Molecule | An immutable knowledge unit | Molecule entity, `molecule_type` in {claim, method, constraint, observation, definition, example, knowledge_document, container} |
| Edge Molecule | A relationship between two molecules | Molecule entity, `molecule_type = "edge"` |
| Fact | A constitutional state transition | JournalFact entity |

Edge Molecules are Molecules, not a separate table. This is deliberate: it means an edge
inherits every mechanism that already exists for content — challengeability (via
JournalGovernanceRecord, unchanged), versioning (`successor_molecule_id`), state lifecycle
(`current_state`, `constitutional_status`), and constitutional birth (a `molecule_created`
Fact, unchanged). Nothing new had to be invented for edges to be governable. That is what
makes the Fractal Provenance Architecture actually fractal: not "everything is a molecule"
as slogan, but relationships obeying the identical rules content already obeys.

## 3. Edge Molecule schema

All fields below are additions to the existing `Molecule` entity, populated only when
`molecule_type = "edge"`:

| Field | Type | Meaning |
|---|---|---|
| `edge_source_molecule_id` | string | The molecule this relationship originates FROM |
| `edge_target_molecule_id` | string | The molecule this relationship points TO |
| `edge_relationship_type` | enum | `DERIVES_FROM`, `SUPPORTS`, `CONTRADICTS`, `CITES`, `SUMMARISES`, `IMPLEMENTS`, `REPLACES`, `SUPERSEDES` |
| `edge_confidence` | number 0.0–1.0 | Confidence in the asserted relationship |
| `edge_evidence_summary` | string | The specific textual evidence that justified creating this edge — makes the edge auditable independent of both molecules it connects |
| `edge_algorithm_version` | string | Version of the extraction/resolution algorithm that produced this edge — reproducibility |
| `edge_created_by` | enum | `deterministic_extraction`, `ai_suggestion`, `human_declared` — provenance of the proposal, not a trust signal |

Existing generic fields carry the rest: `runtime_id` (which run resolved this edge),
`vsid`/`author_domain_id` (creator), `created_date` (system, auto), `canonicalHash`
(hash of source+target+relationship_type+evidence — see §5), `current_state`,
`active_challenge_id`, `successor_molecule_id`.

## 4. Why "can I disagree with the edge" matters

Because an edge is its own molecule with its own identity, a challenge to a relationship
never touches either endpoint. `A --SUPPORTS--> B` disputed as wrong becomes: challenge the
Edge Molecule, not A, not B. If the challenge succeeds, the Edge Molecule transitions to
`REJECTED` or is superseded by a corrected Edge Molecule — A and B are untouched, and their
own kCv histories stay intact. This is the same principle CB-0 established for Bindings:
constraint mutation without touching the thing constrained.

## 5. Edge identity

`canonicalHash` for an edge = `sha256(edge_source_molecule_id + edge_target_molecule_id +
edge_relationship_type + edge_evidence_summary)`. Two runs that extract the same relationship
from the same evidence produce the same edge identity — this is what makes edges subject to
the same duplicate-detection the Origin Runtime already proved for content molecules
(Regression Level 1, CETS run 1). `molecule_id` for an edge = `mol-edge-<hash16>`, distinguishing
edges from content molecules at a glance while using the identical derivation scheme.

## 6. Lifecycle

```
Input Molecule
   ↓
Extract references (deterministic: regex/structure — citations, "per X", standard codes, etc.)
   ↓
Candidate Edge (not yet persisted — a proposal in memory)
   ↓
Resolve target (does a molecule with matching canonicalHash/content exist in corpus?)
   ↓
  no match → discard candidate, log as unresolved_reference observation (not an edge)
  match found → continue
   ↓
Edge Molecule created (current_state = CREATED, weight_class = operational unless either
   endpoint is constitutional, in which case constitutional)
   ↓
Verification (structural: are source ≠ target, relationship_type valid, confidence above
   floor for deterministic edges — see §7)
   ↓
Registration (current_state → EXPLORED, molecule_created Fact emitted, edge becomes
   searchable/challengeable exactly like any molecule)
```

This mirrors the Origin Runtime's own 9-stage pipeline deliberately — extraction and
resolution are pre-identity work (no edge molecule_id exists until the hash in §5 can be
computed, i.e. until both endpoints and the relationship type are known), verification and
registration are post-identity, same as CANONICALISED being the identity boundary for content.

## 7. Deterministic-first, AI last

Build order, strictly:

1. Deterministic parser — regex/structural extraction (explicit citations, standard code
   references like "BS EN 16798", "per TM52 Criterion 1", quoted cross-references).
2. Reference resolution — match extracted references against corpus canonicalHash/content.
3. Edge Molecule creation — per §6, for every deterministically resolved reference.
4. **Only then**: an AI suggestion engine may propose *additional* candidate edges the
   deterministic parser missed (semantic similarity, implied relationships). These are
   created with `edge_created_by = "ai_suggestion"` and MUST pass the same §6 verification
   gate before registration — no separate, weaker path exists for AI-sourced edges.

The AI never creates the graph. It proposes candidates that fall into the identical
Candidate Edge → Resolve → Verify → Register pipeline as deterministic ones. Once
registered, an `ai_suggestion` edge and a `deterministic_extraction` edge are constitutionally
equal — `edge_created_by` is provenance, not a trust discount. This is CER operationalised,
not just stated: fluid cognition (AI) proposes, canonical infrastructure (the runtime)
decides what becomes real.

## 8. What this spec deliberately does not do yet

- Does not implement the deterministic parser (extraction patterns, resolution logic).
- Does not implement the AI suggestion engine.
- Does not define propagation semantics for how an edge's challenge affects kCv of its
  endpoints (existing C-7 propagation pressure rules for content molecules may or may not
  apply identically to edges — open question, deferred).

Those are the next milestone, once this schema is confirmed sound.
