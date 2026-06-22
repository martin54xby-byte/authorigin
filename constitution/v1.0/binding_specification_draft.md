# Constitutional Binding Specification
## Version 1.0 — Draft for Ratification
## AuthOrigin Knowledge Constitution — June 22, 2026

---

## Preamble

This specification defines the third class of journal artifact in AuthOrigin.

The journal currently stores two kinds of records:

**Observation Artifacts** — record that something occurred.
They increase available information. They do not alter what is possible.

**Constitutional Artifacts (Facts)** — record that a governance boundary was crossed.
They record determinations. They change what the system knows about a molecule.

This specification introduces a third kind:

**Binding Artifacts** — record that the set of reachable future states has changed.
They do not describe the world. They reshape it.

A Binding is not stronger evidence.
It is not a higher confidence score.
It is a different category of existence.

---

## The Fundamental Distinction

| Class | Question Answered | Effect |
|-------|------------------|--------|
| Observation | What happened? | Information increases |
| Fact | What was determined? | System state changes |
| Binding | What is now possible? | Future state-space changes |

The journal without Bindings stores only history.
The journal with Bindings stores history **plus constraint evolution**.

These are different systems.

---

## Binding Structure

Every Binding Artifact carries seven fields:

### 1. Trigger
The constitutional fact that activates this binding.
A Binding does not self-activate. It is always the consequence
of a specific Fact crossing a specific threshold.

```
trigger: {
  fact_type:       string        // e.g. "survived_challenge"
  fact_id:         string        // the specific fact that fired this
  threshold:       object        // conditions that must hold
}
```

### 2. Scope
The set of molecules, domains, lineages, or classes affected.
Scope is precise and enumerable at the moment of creation.
It does not expand retroactively.

```
scope: {
  scope_type:      "molecule" | "lineage" | "domain" | "class"
  scope_ids:       string[]      // affected molecule_ids or domain_ids
  scope_class:     string        // e.g. molecule_type, challenge_type
  scope_direction: "upstream" | "downstream" | "lateral" | "all"
}
```

### 3. Obligations
What must now occur. Obligations are active until discharged or expired.
An undischarged obligation blocks certain governance paths.

```
obligations: Array<{
  obligation_type: string        // e.g. "mandatory_review", "cite_precedent"
  applies_to:      string        // "new_challenges" | "citing_molecules" | "domain_actors"
  discharge_condition: string   // what makes this obligation satisfied
  blocking_paths:  string[]      // governance actions blocked until discharged
}>
```

### 4. Foreclosures
What may no longer occur. Foreclosures are permanent within their expiry window.
Unlike obligations (which can be discharged), foreclosures simply close paths.

```
foreclosures: Array<{
  foreclosure_type: string       // e.g. "no_reopen", "no_same_class_challenge"
  applies_to:       string
  condition:        string       // precise statement of what is foreclosed
}>
```

### 5. Expiry
When this Binding ceases to constrain.

```
expiry: {
  expiry_type:   "never" | "versioned" | "review_triggered" | "count_triggered"
  expiry_value:  string | number | null
  // "never"           → permanent constitutional constraint
  // "versioned"       → expires on constitution version increment
  // "review_triggered"→ expires when a specified review completes
  // "count_triggered" → expires after N governance events of specified type
}
```

### 6. Appeal Path
Whether this Binding can itself be challenged, and if so, how.

```
appeal: {
  appealable:       boolean
  appeal_tier:      0 | 1 | 2 | 3 | null
  // Tier 3 only: a Binding produced by a Tier 3 quorum
  // requires a new Tier 3 quorum to appeal.
  // Non-appealable bindings are produced by foundational facts only.
  appeal_conditions: string[]
}
```

### 7. Lineage Effect
How this Binding propagates through the molecule graph.
This is distinct from C-7 challenge propagation pressure.
Propagation pressure signals uncertainty.
Lineage Effect is a structural constraint.

```
lineage_effect: {
  propagates:      boolean
  direction:       "upstream" | "downstream" | "none"
  depth:           number | "full"
  effect_at_depth: Record<number, string>
  // e.g. { 1: "mandatory_review", 2: "flag_for_review", 3: "noted" }
}
```

---

## Binding Type Register

The following Binding types are defined in Constitution v1.0.
New types require a Tier 3 quorum to ratify.

---

### B-1: PRECEDENT_ESTABLISHED

**Trigger:** `survived_challenge` with `challenge_quality_score ≥ 0.75`
AND `survival_type = "strengthened"`

**What it means:**
This molecule has survived a high-quality challenge and been strengthened.
It now serves as constitutional precedent within its domain and molecule_type class.

**Obligations:**
Future challenges of the same `challenge_type` against molecules of the same
`molecule_type` in the same `author_domain_id` MUST include a
`differentiates_from_precedent` field citing this molecule's `molecule_id`.
Challenges that do not cite relevant precedent fail C-9 intake validation
(novelty score ≤ 0.1 if precedent exists and is uncited).

**Foreclosures:**
No challenge of identical `challenge_type` against this specific molecule
may be raised within 6 months of this binding's creation
unless new primary evidence not available at the time of the original
challenge is presented.

**Expiry:** `review_triggered` — expires when molecule reaches SUPERSEDED or DEPRECATED.

**Appeal:** Appealable at Tier 2. Requires demonstration that the precedent
was incorrectly classified (different domain, different class, or
challenge_quality_score was miscalculated).

**Lineage Effect:** Downstream only, depth 2.
- Depth 1 (direct citations): must acknowledge precedent in new challenge intake
- Depth 2 (indirect citations): noted in challenge quality assessment

---

### B-2: MANDATORY_REASSESSMENT

**Trigger:** `rejected` OR `deprecated` (polarity = -1)

**What it means:**
A molecule has failed governance. Any molecule in its downstream citation
lineage that has NOT yet reached VERIFIED_STRONG must undergo reassessment
before it may proceed to VERIFIED_STRONG or beyond.

**Obligations:**
All downstream molecules at propagation depth 1–2 (current PROVISIONAL or
WEAKENED status) must receive a new `invoke_governance` event before their
`propagation_status` may be cleared to CLEAR.
The reassessment cannot be waived by domain trust score.
It must be a genuine governance act (not an automated clearance).

**Foreclosures:**
Downstream molecules at depth 1 may not pass C-R1 at `authoritative` or
`foundational` tier until reassessment is complete.
The `constitutional_query` at those tiers will structurally exclude them —
not merely gate on score, but actively exclude by Binding lookup.

**Expiry:** `never` for depth 1. `review_triggered` for depth 2.

**Appeal:** Appealable at Tier 1. Applies only to depth classification
(was this molecule genuinely downstream?), not to the underlying rejection.

**Lineage Effect:** Downstream only, depth 2.
- Depth 1: mandatory governance event required (blocking)
- Depth 2: mandatory review recommended (non-blocking, flagged in retrieval)

---

### B-3: SCOPE_AUTHORITY_GRANTED

**Trigger:** `state_transition` to `REINFORCED`
AND `reuse_count ≥ 50` AND `kCv_r ≥ 0.7`

**What it means:**
This molecule has reached high-resilience reinforced status with demonstrated
wide adoption. It now holds scope authority within its `scope_definition`.

Scope authority means:
Future molecules that declare the same `scope_definition` must situate
themselves relative to this molecule. They cannot define the same scope
as if this molecule does not exist.

**Obligations:**
New molecules entering the same `scope_definition` must include this
molecule in their `parent_molecule_ids` OR explicitly declare a
`scope_differentiation` field explaining how their scope differs.
Molecules that do neither fail constitutional intake (C-2 equivalent for scope).

**Foreclosures:**
No molecule may declare identical scope AND claim originality (kCv_o = 1.0)
within this scope_definition while this binding is active.
kCv_o for new molecules in this scope is automatically capped at 0.6
until they demonstrate differentiation.

**Expiry:** `versioned` — review required on each constitution version increment.

**Appeal:** Tier 2. Requires demonstration that the scope definitions
do not in fact overlap, or that the REINFORCED molecule has become
effectively dormant (reuse_count growth rate < 2 per 12 months).

**Lineage Effect:** Lateral. All molecules sharing `scope_definition`, depth 1.

---

### B-4: QUORUM_PRECEDENT

**Trigger:** Any Tier 3 quorum resolution (regardless of outcome)

**What it means:**
A Tier 3 quorum decision is itself a constitutional molecule.
It is not merely a governance record. It enters the journal as a
first-class Molecule with its own CER lifecycle.

The quorum decision molecule:
- Has `molecule_type = "quorum_precedent"`
- Has `is_foundational = true`
- Begins at EXPLORED (not CREATED) — it enters with elevated status
- Is automatically cited by the molecule it governed
- Cannot be challenged for 12 months after creation

**Obligations:**
Future Tier 3 quorums addressing the same `challenge_type` within the
same `author_domain_id` MUST cite this quorum precedent molecule.
Quorum assembly documents must reference it or fail Tier 3 intake.

**Foreclosures:**
The same Tier 3 quorum panel (same `quorum_domains`) may not convene
again on the same molecule within 24 months.
New panel members must constitute at least 50% of a subsequent quorum
on the same molecule.

**Expiry:** `never` for the quorum precedent molecule itself.
`versioned` for the panel exclusion foreclosure.

**Appeal:** Non-appealable for 12 months. After 12 months, appealable
only by a new Tier 3 quorum with entirely different `quorum_domains`.

**Lineage Effect:** None. Quorum precedents constrain process, not lineage.

---

### B-5: LINEAGE_CONTAMINATION

**Trigger:** `rejected` on a molecule with `is_foundational = true`

**What it means:**
A foundational molecule has been rejected. This is the most severe
constitutional event. All molecules with this molecule in their
`parent_molecule_ids` at any depth are contaminated.

Contamination is not propagation pressure.
It is a structural binding that requires active remediation.

**Obligations:**
All downstream molecules must undergo `LINEAGE_REASSESSMENT`:
- A new JournalGovernanceRecord of type `lineage_reassessment` must be created
- The reassessment must evaluate whether the downstream molecule's validity
  was materially dependent on the rejected foundational molecule
- If dependent: molecule must transition to COLLAPSING pending new evidence
- If independent: molecule may receive a `lineage_independence_declaration` fact

**Foreclosures:**
No downstream molecule may pass C-R1 at ANY tier (including `open`)
until it has received either:
- A `lineage_independence_declaration` fact, OR
- A successful governance resolution post-reassessment

This is the only binding that blocks the `open` tier.
It is the constitutional equivalent of a foundational recall.

**Expiry:** `never` — contamination bindings are permanent.
The lineage_independence_declaration is permanent clearance.

**Appeal:** Tier 3 only. The rejection of a foundational molecule
is itself subject to Tier 3 review. If the rejection is overturned,
all contamination bindings are retrospectively voided
(new voiding facts written to the journal).

**Lineage Effect:** Downstream, depth `full` (unlimited).

---

## The Revised Journal Model

With Bindings, the journal stores three things:

```
Journal
  ├── Observations     what happened (signals, retrievals, reuse)
  ├── Facts            what was determined (state transitions, governance outcomes)
  └── Bindings         what is now possible (constraint mutations)
```

And a query against the journal must now answer:

1. What is the current state of this molecule? (Facts)
2. What has been observed about it? (Observations)
3. What constraints currently apply to it? (Bindings — active, unexpired)

The retrieval layer (Phase 5) currently only evaluates (1) and (2).
With Bindings, (3) becomes a hard gate, not a soft score gate.

---

## kCv Reconsidered

If Constitutional Binding is real, then kCv changes nature:

**Current:** kCv = projection over observation and fact history
**With Bindings:** kCv = projection over observation, fact, AND constraint history

Specifically:

`kCv_r` (Resilience) currently measures survival rate + longevity.
With Bindings, a PRECEDENT_ESTABLISHED binding on a molecule means
its resilience is not just a past score — it is an active constraint
on the future. That is a stronger claim than a score.

`kCv_v` (Verification) currently measures whether governance was passed.
With Bindings, SCOPE_AUTHORITY_GRANTED means verification has produced
something beyond a score — it has produced a structural constraint.

The implication: **kCv becomes a projection of constraint history,
not merely observation history.**

A molecule with a PRECEDENT_ESTABLISHED binding is not just
"highly scored." It is structurally different from an unbound molecule.
The difference is not quantitative. It is categorical.

---

## What This Changes in the Implementation

The following must be added before Phase 6:

1. **JournalBinding entity** — new journal layer, parallel to JournalFact
   Stores Binding artifacts with all seven fields above.

2. **Binding activation** — in `challengeProtocol` and `cerTransition`:
   After writing a constitutional Fact, evaluate the Binding Type Register
   and write any triggered JournalBinding records.

3. **Binding evaluation** — in `constitutionalRetrieval`:
   Before returning any molecule, evaluate active Bindings in scope.
   Active Bindings are hard gates, not score penalties.
   A molecule under LINEAGE_CONTAMINATION binding cannot pass open tier.
   A molecule with unmet MANDATORY_REASSESSMENT obligation cannot pass
   authoritative or foundational tier.

4. **Binding as molecule** — B-4 (QUORUM_PRECEDENT):
   Tier 3 quorum decisions must be instantiated as Molecules.
   This is the first case where a governance act creates a new knowledge
   artifact, not just a record about an existing one.

5. **kCv binding component** — `kCv_b`:
   A sixth kCv dimension measuring binding richness:
   how many active Bindings does this molecule carry or constrain?
   A molecule with PRECEDENT_ESTABLISHED and SCOPE_AUTHORITY has higher
   constitutional authority than one with equivalent scores but no bindings.

---

## Ratification Status

This specification is a draft for constitutional ratification.
It must not be implemented before ratification.
Ratification requires a Tier 2 governance event in AuthOrigin itself.

Once ratified, the following Constitution v1.0 invariants must be amended:
- New invariant C-24: Binding artifacts are a constitutional primitive
- New invariant C-25: Active Bindings are hard retrieval gates
- New invariant C-26: Tier 3 quorum decisions are constitutional molecules
- New invariant C-27: LINEAGE_CONTAMINATION blocks all retrieval tiers

---

*Constitutional Binding Specification v1.0-draft*
*AuthOrigin Knowledge Constitution*
*June 22, 2026*
