# Binding Lifecycle Semantics Specification
## BLS-001 — For Ratification alongside CB-0 through CB-5
## AuthOrigin Knowledge Constitution — June 22, 2026

---

## Status

This document specifies how Bindings are created, evolve, and expire.
It resolves the question: "Can a Binding produce a Binding?"
It must be ratified together with CB-0 through CB-5.
Neither document is complete without the other.

---

## The Resolved Question

**Can a Binding directly produce a Binding?**

No.

**Can a Binding, through governed recursion, contribute to a lineage
that results in a new Binding?**

Yes — but only if a constitutional Fact intervenes.

The invariant is:

> **BLS-0**: A Binding is always caused by a Fact.
> A prior Binding may appear in a new Binding's lineage as context.
> It is never the cause.

This is not a restriction on governance evolution.
It is a restriction on unmediated policy propagation.
Governance — a human or quorum act that produces a Fact — must always
be the gate between one Binding and the next.

The valid chain is:

```
Binding₁ → [challenge] → GovernanceRecord → Fact₂ → Binding₂
```

The invalid chain is:

```
Binding₁ → Binding₂
```

CB-3 is unchanged. This document extends it with lineage semantics.

---

## Creation Sources

What may emit a Binding?

**Primary source:** A constitutional Fact of a type listed in the
Binding Type Register (to be ratified separately as B-1 through B-n).

**Secondary source:** A constitutional Fact produced by the resolution
of a challenge against an existing Binding.

**Not a source:** An Observation. An Observation can never directly
trigger a Binding. It may contribute to the conditions that eventually
produce a Fact, which may produce a Binding. The Fact is the gate.

**Not a source:** An existing Binding. See BLS-0.

---

## The Two Fields

Every Binding carries exactly two causal fields:

```
triggering_fact_id:   string   REQUIRED
  The Fact that caused this Binding.
  Without this field, the Binding is constitutionally void (CB-3).
  This is the CAUSE.

parent_binding_id:    string   OPTIONAL
  A prior Binding that this Binding responds to, modifies, or supersedes.
  This is CONTEXT, not cause.
  A Binding with a parent_binding_id is still caused by its triggering_fact_id.
```

The distinction between cause and context is constitutional.
Conflating them allows indirect Binding-to-Binding production,
which BLS-0 forbids.

---

## Transformation Constraints

When a new Binding is produced in response to a prior Binding:

**BLS-1: Scope may only narrow or match, never expand.**
A Binding produced in response to B₁ may not affect molecules,
domains, or classes outside B₁'s scope.
A subsequent Binding may refine B₁'s scope to a subset.
It may not extend it to a superset.

This prevents governance escalation through recursion.
A Binding challenging a narrow policy cannot inadvertently
produce a broader policy.

**BLS-2: Tier may only match or escalate, never de-escalate.**
A Binding produced to challenge a Tier 3 Binding must itself
be produced by a Tier 3 governance event.
You cannot use a Tier 1 governance act to override a Tier 3 Binding.

This prevents authority erosion through governance substitution.

**BLS-3: Expiry may be equal or shorter, never longer.**
A Binding produced in response to B₁ may not outlive B₁.
If B₁ expires, B₂ (which references B₁ as parent) must also expire
unless it has an independent triggering Fact with its own expiry.

This prevents governance evolution from accumulating indefinitely
through stacked short-term Bindings whose lineage outlives
the original rationale.

---

## Binding Lifecycle States

A Binding moves through the following states:

```
PENDING     → produced, awaiting activation conditions
ACTIVE      → currently constraining admissible governance
SUSPENDED   → temporarily inactive (e.g. under challenge)
SUPERSEDED  → replaced by a subsequent Binding in the same lineage
EXPIRED     → expiry condition met, no longer constraining
VOIDED      → triggering Fact was itself voided; Binding retroactively void
```

State transitions:

```
PENDING    → ACTIVE      when activation conditions are met
ACTIVE     → SUSPENDED   when the Binding itself is challenged
ACTIVE     → SUPERSEDED  when a Tier-compliant Fact produces a successor Binding
ACTIVE     → EXPIRED     when the expiry condition is satisfied
SUSPENDED  → ACTIVE      if the challenge resolves in favour of the Binding
SUSPENDED  → VOIDED      if the challenge resolves against the Binding
ACTIVE     → VOIDED      if the triggering Fact is voided by a superseding Fact
```

A VOIDED Binding is permanently inert.
It is never deleted — it remains in the journal as a record of
what was once constrained and why it ceased to constrain.

---

## Challengeability

Every Binding carries a `challengeability` declaration:

```
challengeability: {
  challengeable:  boolean
  minimum_tier:   0 | 1 | 2 | 3
  challenge_basis: string[]
  // what grounds are constitutionally valid for challenging this Binding?
  // e.g. ["scope_misclassification", "triggering_fact_voided", "constitution_version_change"]
}
```

A non-challengeable Binding is produced only by foundational facts.
These are rare. Most Bindings are challengeable at Tier 1 or 2.

A challenge against a Binding:
1. Triggers a GovernanceRecord of type `binding_challenge`
2. Moves the Binding to SUSPENDED
3. On resolution:
   - If upheld: Binding moves to VOIDED, new Binding may be produced
   - If rejected: Binding returns to ACTIVE, B-1 PRECEDENT_ESTABLISHED
                  fires for the Binding itself (it survived challenge)

This is the governed recursion loop. Every step requires a governance act.
No step allows a Binding to self-modify or directly produce a successor.

---

## How kCv Interacts With the Binding Shadow

At Tier 2 (Decision Support), the retrieval layer performs a
"Binding shadow evaluation" — it surfaces active Bindings as advisory
context without applying them as hard gates.

The interaction is:

**kCv informs salience. Bindings inform action boundaries.**

They do not merge. They are presented as two separate response elements:

```json
{
  "molecule_id": "mol-ahu-method-v5",
  "kCv_aggregate": 0.73,
  "kCv_v_quality": "STRONG",
  "retrieval_confidence": "high",

  "binding_advisories": [
    {
      "binding_id": "bind-001",
      "binding_type": "PRECEDENT_ESTABLISHED",
      "state": "ACTIVE",
      "advisory": "This molecule holds constitutional precedent in scope: mechanical_duct_sizing. Supersession requires Tier 3 challenge.",
      "hard_gate_at_tier": 3
    }
  ]
}
```

At Tier 1 (Informational): `binding_advisories` is absent from response.
At Tier 2 (Decision): `binding_advisories` is present, advisory only.
At Tier 3 (Governance): Bindings become hard gates. kCv becomes advisory.

**The role reversal at Tier 3 is deliberate and constitutional:**

At Tier 3, the question is not "how good is this knowledge?"
It is "what may I do with it?"
kCv answers the first. Binding answers the second.
At Tier 3, the second question is what the user is actually asking.

---

## The Dual-Graph Architecture

This specification confirms the two-graph model:

### Graph A — Epistemic (kCv)
```
Nodes:        molecules
Edges:        lineage citations (parent_molecule_ids)
Signal:       evidence accumulation, reinforcement, decay
Propagation:  soft, damped, reversible in projection
Output:       ordering / salience / confidence
Query tiers:  1 (full) and 2 (full)
Tier 3:       advisory only
```

### Graph B — Normative (Binding)
```
Nodes:        bindings
Edges:        triggering_fact → binding
              parent_binding → [challenge → fact] → binding
Signal:       permission mutations (narrow / extend / condition)
Propagation:  structural, hard, scoped, auditable
Output:       admissibility envelope for governance actions
Query tiers:  3 (constitutive hard gate)
Tier 2:       advisory shadow
Tier 1:       absent
```

**Shared referents:** both graphs reference molecules by molecule_id.
**No shared propagation logic.** kCv propagation does not alter permissions.
Binding propagation does not alter scores.

**One intersection:** Quorum Precedent molecules (B-4) exist in both graphs
simultaneously — as knowledge (kCv-bearing) and as governance
(Binding-emitting). This is the intentional contact point between
the epistemic and normative systems. It is not a conflation.
It is where a determination becomes so significant that it
constitutes new knowledge in its own right.

---

## What This Settles

1. **The recursion question:** Governed recursion (Model B, Option Y).
   Bindings cannot self-replicate. Facts always mediate.
   CB-3 is preserved unchanged.

2. **The audit question:** Binding lineage is as strict as Fact lineage.
   Every Binding traces to a Fact. Every Fact traces to a governance event.
   No free-floating policy is possible.

3. **The drift question:** BLS-1 (scope narrows), BLS-2 (tier escalates),
   BLS-3 (expiry shortens) prevent governance escalation and accumulation.

4. **The kCv interaction:** Separate response fields, separate roles.
   Role reversal at Tier 3 is constitutional, not coincidental.

5. **The dual-graph:** Confirmed orthogonal. One journal, two propagation
   semantics, one deliberate intersection point.

---

## New Invariants Proposed

To be ratified with CB-0 through CB-5:

**C-28**: A Binding cannot directly produce a Binding.
A constitutional Fact must mediate all Binding-to-Binding lineage.

**C-29**: A successor Binding's scope may not exceed its predecessor's scope.

**C-30**: A successor Binding's governance tier may not be lower than
its predecessor's governance tier.

**C-31**: At Tier 3 governance evaluation, active Bindings are
constitutive hard gates. kCv scores are advisory.

---

*Binding Lifecycle Semantics Specification BLS-001*
*For ratification alongside CB-0 through CB-5*
*AuthOrigin Knowledge Constitution — June 22, 2026*
