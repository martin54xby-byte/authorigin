# Constitutional Binding — Primitive Specification
## CB-0 through CB-5 — For Ratification
## AuthOrigin Knowledge Constitution
## June 22, 2026 — Pre-ratification Draft

---

## Status

This document defines the Constitutional Binding primitive only.

It does not define any named Binding type.
Named Binding types (B-1 through B-n) are specialisations of this primitive
and belong in a separate register, ratified separately.

This document is ready for Tier 2 ratification.
The named Binding register is not.

---

## The Problem This Solves

The journal currently stores two artifact classes:

**Observations** answer: *what happened?*
They increase available information.
They do not alter what is possible.

**Facts** answer: *what was determined?*
They record that a governance boundary was crossed.
They change the system's knowledge of a molecule's constitutional standing.

Neither class answers a third question:

*What governance actions are now admissible?*

Without an answer to that question, governance logic lives in application code —
implicit, unversioned, unchallengeable, invisible to the journal.

That is the gap Constitutional Binding closes.

---

## CB-0 — The Primitive Definition

> A **Binding** is a second-order constitutional artefact, produced by a
> first-order Fact, that narrows or extends the set of governance actions
> admissible within a defined scope.
>
> A Binding does not describe knowledge.
> A Binding does not rank knowledge.
> A Binding modifies the local governance possibility space —
> persistently, within scope, and with its own constitutional lineage.

**Second-order** means: a Binding is not about a knowledge artefact directly.
It is about what governance may do *in relation to* knowledge artefacts.

**First-order Fact** means: a Binding cannot self-activate.
It is always the consequence of a specific constitutional event
that has already been recorded as a Fact.

**Admissible** means: not merely what is likely or expected,
but what the system will recognise as constitutionally valid.
An inadmissible governance action is not merely improbable — it is void.

**Scope** means: the Binding applies to a defined, enumerable set of
molecules, lineages, domains, or classes — not globally.
The global constitution remains unchanged.
Bindings are contextual instantiations of constitutional permission.

---

## CB-1 — Categorical Distinction

> Bindings are categorically distinct from Observations and Facts.
> They are not stronger Observations.
> They are not higher-confidence Facts.
> They are a different kind of thing.

| Class | Records | Effect | Reversible? |
|-------|---------|--------|-------------|
| Observation | An event | Information increases | N/A — does not constrain |
| Fact | A determination | Constitutional state changes | No — journal is append-only |
| Binding | A permission mutation | Admissible future narrows or extends | Only by a subsequent Binding |

A Binding can only be modified or voided by a subsequent Binding.
Not by a Fact. Not by an Observation. Not by application code.
This is what makes it a constitutional artefact rather than a rule.

---

## CB-2 — Admissibility Alteration

> A Binding alters admissible governance paths within a defined scope.
>
> Alteration may be:
> - **Narrowing**: removing a governance path that was previously available
> - **Extension**: making available a governance path not previously permitted
> - **Conditioning**: keeping a path available but adding a required precondition
>
> All three forms are Bindings.
> All three are first-class journal artefacts.

The distinction between Narrowing, Extension, and Conditioning matters
because it determines what a downstream system must check:

- A Narrowing produces a hard exclusion.
- An Extension produces a new permission.
- A Conditioning produces a precondition gate.

These are not semantically equivalent and must not be treated as such.

---

## CB-3 — Causal Dependency

> Bindings are produced by Facts, but are not Facts.
>
> Every Binding must reference exactly one triggering Fact.
> A Binding without a triggering Fact is constitutionally void.
>
> The triggering Fact's constitutional validity is a precondition
> for the Binding's validity. If the triggering Fact is later
> voided (by a subsequent superseding Fact), the Binding must be
> evaluated for continued validity and may itself be voided
> by a subsequent Binding.

This establishes causal lineage for Bindings.
A Binding is not free-floating. It is traceable to a specific
constitutional moment in the journal.

---

## CB-4 — Self-Constitutional Status

> Bindings are themselves constitutional artefacts.
>
> They possess:
> - **Scope**: the set of molecules, lineages, domains, or classes affected
> - **Lineage**: the triggering Fact and any prior related Bindings
> - **Expiry**: a condition under which the Binding ceases to apply
> - **Challengeability**: whether and how the Binding may be contested
>
> Bindings are stored in the journal as a distinct artifact class.
> They are not stored as properties of molecules.
> They are not stored as application configuration.
> They are not inferred. They are explicit.

This is the critical architectural consequence of CB-0:
if governance logic must be in the journal, then the journal
needs a layer for it. That layer is the Binding layer.

A system that evaluates governance admissibility by reading
the Binding layer from the journal is self-describing.
The rules governing what can happen next are discoverable
by reading the journal itself. No external rule engine required.

---

## CB-5 — Relationship to the Constitution

> The global constitution defines universal permissions —
> what governance may do in any context, absent any Binding.
>
> Bindings are contextual instantiations of constitutional permission.
> They may narrow or extend permissions within scope.
> They may not contradict the constitution.
> They may not grant permissions the constitution forbids globally.
> They may not remove permissions the constitution declares inviolable.
>
> The hierarchy is:
>   Constitutional invariants (static, global, locked)
>     ↓ may be contextually refined by
>   Bindings (dynamic, scoped, journaled)
>     ↓ operate upon
>   Governance actions (admissible or void, per the above)

This prevents Bindings from becoming a backdoor for constitutional amendment.
A Binding that attempts to grant a globally forbidden permission is void
regardless of the quality or tier of the Fact that triggered it.

---

## What This Does Not Define

This specification intentionally omits:

- Any named Binding type (B-1 through B-n)
- Any scoring of Bindings (kCv_b)
- Any implementation detail of the JournalBinding entity
- Any specific trigger conditions
- Any specific obligation or foreclosure content

All of the above belong in subsequent specifications,
ratified only after CB-0 through CB-5 are stable.

---

## The Three-Question Journal

With CB-0 through CB-5 ratified, the journal answers three distinct questions:

**1. What happened?** → Observations
**2. What was determined?** → Facts
**3. What is now admissible?** → Bindings (active, unexpired, in-scope)

A query against the journal that ignores question 3 is constitutionally incomplete.
It may return knowledge that is accurate but governance-void —
knowledge for which certain actions are forbidden but appear available.

---

## Ratification Requirements

Ratification of CB-0 through CB-5 requires:
- Tier 2 governance event
- No named Binding types in scope
- Explicit acknowledgment that B-1 through B-n are deferred
- No kCv_b introduced in this ratification

Upon ratification, four new invariants are added to Constitution v1.0:

**C-24**: The journal stores three artifact classes: Observations, Facts, Bindings.

**C-25**: A Binding is a second-order constitutional artefact that modifies
the local admissible governance possibility space within a defined scope.

**C-26**: Bindings are produced by Facts. A Binding without a triggering Fact
is constitutionally void.

**C-27**: Active Bindings in scope are evaluated before any governance action
is admitted. An action inadmissible under an active Binding is void
regardless of the actor's trust score or constitutional standing.

---

## Note on kCv_b

It is premature to score Bindings.

A Binding either modifies admissible futures or it does not.
Its significance derives from scope, persistence, propagation, and reach —
not from a numeric projection.

Introducing a score before observing how Bindings behave in a live system
risks demoting them back into reputation signals.

The correct sequence is:
1. Ratify CB-0 through CB-5 (this document)
2. Implement JournalBinding and the first named Binding register
3. Observe emergent patterns in a live system
4. Determine whether a projection naturally emerges
5. Only then consider kCv_b

---

*Constitutional Binding Primitive Specification*
*CB-0 through CB-5 — Pre-ratification Draft*
*AuthOrigin Knowledge Constitution — June 22, 2026*
