# Query Intent Separation
## Architectural Design Decision — ADR-001
## AuthOrigin Knowledge Constitution — June 22, 2026

---

## Decision

The Constitutional Binding layer is a **governance primitive**, not a
retrieval primitive. It must not appear as a hard gate on ordinary search.

---

## Context

Constitutional Binding (CB-0 through CB-5) defines a third journal artifact
class that modifies the admissible future governance state-space.

A naive implementation would place Binding evaluation in the retrieval path —
every query triggers a full constitutional analysis before results are returned.

That would be architecturally wrong and practically unusable.

The reason: retrieval and governance answer different questions.

---

## The Distinction

| Question | Example | Layer |
|----------|---------|-------|
| What exists? | "What is the pressure drop equation?" | Observation + Fact |
| Which should I use? | "Which AHU sizing method is current?" | Observation + Fact + Binding (advisory) |
| What may I do? | "Can we supersede AHU Method v5?" | Observation + Fact + Binding (constitutive) |

A Binding does not make a molecule wrong.
It constrains what governance may do with it next.

These are different things.
A molecule that is VERIFIED_STRONG under a PRECEDENT_ESTABLISHED binding
is still correct knowledge. It is also a knowledge artefact with
constrained supersession paths. Both are true simultaneously.
They must not collapse into the same query response.

---

## Three Intent Modes

### Mode 1 — Informational
*"Tell me something."*

Layers: Observation + Fact
kCv: quality and confidence signal (ranking)
Bindings: **absent** — no governance cost, no constitutional overhead
Cost: low, fast

The vast majority of interactions. Must feel like search, not governance.

### Mode 2 — Decision Support
*"Help me choose."*

Layers: Observation + Fact + Binding (advisory only)
kCv: ranking + confidence, comparative across candidates
Bindings: **advisory** — surface active Bindings as context, not as gates.
          "Note: this molecule carries an active PRECEDENT_ESTABLISHED binding."
          Does not block retrieval. Informs the decision.
Cost: medium

Less common. The user is choosing between options with governance implications.

### Mode 3 — Governance
*"Change the knowledge environment itself."*

Layers: Observation + Fact + Binding (constitutive)
kCv: standing of the target molecule
Bindings: **hard gates** — full obligation and foreclosure evaluation.
          An inadmissible governance action is void here.
          The full constitutional cost is paid deliberately.
Cost: high, slow, audited

Rare but critical. Supersession, challenge, scope definition, quorum assembly.
This is the court hearing. It should feel like one.

---

## Architectural Consequence

Two separate query paths. One unified journal.

```
Journal
├── Observations
├── Facts
└── Bindings

constitutionalRetrieval  (Phase 5)
  ├── mode=informational  → Observation + Fact, kCv gates, no Binding evaluation
  └── mode=decision       → + Binding advisory surface

constitutionalGovernance  (Phase 6)
  └── mode=governance     → full Binding layer, hard gates, obligations, audit trail
```

The journal is unified. The query paths are separated by intent.
Bindings are always in the journal. They are not always in the response.

---

## Consequence for Phase 5 (Retrieval)

The current `constitutionalRetrieval` implementation does not yet have a
Binding layer (Bindings are not yet ratified or implemented).

When Bindings are implemented, Phase 5 must:
- Add `query_mode` parameter: `"informational"` (default) | `"decision"`
- In `informational` mode: no Binding evaluation
- In `decision` mode: fetch active Bindings for returned molecules,
  surface as `binding_advisories[]` in the response — never as hard gates
- Never apply Binding hard gates in retrieval, regardless of mode

The Binding hard gate lives exclusively in Phase 6 (Governance).

---

## Consequence for Phase 6 (Governance)

`constitutionalGovernance` is the deliberate, heavyweight path.

Every governance action — challenge intake, supersession request,
scope definition, quorum assembly — must:
1. Identify the target molecule(s)
2. Fetch all active Bindings in scope
3. Evaluate admissibility (hard gate)
4. If inadmissible: return void with the specific Binding(s) that foreclose the action
5. If admissible: proceed, with full Binding context in the governance record
6. After resolution: evaluate whether a new Binding is triggered

This is appropriate friction. The user chose this path deliberately.
They are not opening a filing cabinet. They are changing what the
filing cabinet permits.

---

## The MEP Example

**Engineer asks:** *"How do we size this AHU?"*

Mode: informational
Response:
```
AHU Design Method v5
kCv_aggregate: 0.73 | VERIFIED_STRONG | Used on 127 projects
```
No mention of Bindings. Fast. Done.

**Technical director asks:** *"Can we replace AHU Design Method v5?"*

Mode: governance
Response:
```
Target: AHU Design Method v5
Active Bindings:
  PRECEDENT_ESTABLISHED — challenge quality 0.81, 127 downstream citations
  SCOPE_AUTHORITY_GRANTED — scope: mechanical_duct_sizing

Admissibility:
  Supersession: ADMISSIBLE (Tier 3 challenge required)
  Direct replacement: INADMISSIBLE (scope authority active)
  Challenge intake: CONDITIONED (must cite precedent, differentiation required)

Obligations if proceeding:
  Tier 3 quorum required
  127 downstream molecules flagged for lineage review
  New molecule must declare scope differentiation
```

Same journal. Different query path. Completely different response.

---

## What This Preserves

- Bindings remain a constitutional primitive (CB-0 through CB-5 unchanged)
- The journal stores all three artifact classes
- Governance operations retain full constitutional weight
- kCv remains a projection over Observation + Fact history (no kCv_b yet)
- Phase 5 retrieval remains fast and useful for the vast majority of queries

## What This Prevents

- Bindings becoming retrieval overhead for ordinary search
- Constitutional governance becoming unavoidable friction
- The system feeling like a court hearing when the user just wants an answer
- The novel concept of Binding being discarded because it was placed too early
  in the query pipeline

---

## Status

This is an architectural design decision, not a constitutional invariant.
It does not require ratification.
It governs the implementation of Phase 5 (amendment) and Phase 6 (new).

CB-0 through CB-5 remain unchanged and ready for Tier 2 ratification.

---

*ADR-001 — Query Intent Separation*
*AuthOrigin Knowledge Constitution — June 22, 2026*
