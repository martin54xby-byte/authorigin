# ACS-401 — kCv Derivation Constitution

Status: DRAFT
Depends on: ACS-400 (Molecule Formation Constitution, draft)
Preceded by: kCv temporal amendment mol-acs-kcv-o-temporal

---

## 1. What kCv Is

kCv is a derived epistemic characterisation of a molecule, computed deterministically
from its constitutional evidence, valid at a specific point in time and corpus state.

Four properties follow from this definition and must hold for any valid derivation:

**Derived.** kCv is not assigned, declared, or scored. It emerges from reading the
journal. No actor sets kCv directly. No governance fact declares it. It is computed
from evidence that exists independently of the computation.

**Epistemic.** kCv characterises what is known about a molecule — how original it is,
how verified, how reused, what impact it has produced. It does not characterise the
molecule's content directly. Two molecules with identical content but different
constitutional histories can have different kCv characterisations.

**Time-bound.** A kCv derivation is valid at (molecule M, corpus C, time T). A
different corpus state or a different evaluation time produces a legitimately different
result. This is not inconsistency — it is constitutional. Stored kCv fields on the
Molecule entity are a cache of a past derivation, not a permanent truth.

**Evidence-anchored.** Every component of kCv traces to specific, retrievable journal
records. A derivation that cannot cite the evidence it was derived from is not a
valid kCv derivation.

---

## 2. What kCv Is Not

These distinctions are constitutional, not stylistic.

**Not a score.** A score positions a molecule relative to others via a ranking
function. kCv characterises a molecule against its own constitutional evidence. Two
molecules can both have high kCv without one being ranked above the other.

**Not a state vector.** The five dimensions are not commensurate. Originality is
corpus-relative. Verification is governance-gated. They cannot be summed or averaged
into a single value without losing constitutional meaning. A derivation that collapses
kCv into one number has produced something useful for comparison but has destroyed
the characterisation.

**Not a trust measure.** Domain trust and kCv are orthogonal. A high-trust domain
can produce a low-kCv molecule. A low-trust domain can produce a high-kCv molecule.
Trust governs the admissibility of governance actions. kCv characterises the
epistemic and relational history of knowledge objects. They measure different things.

**Not a constitutional property.** Constitutional properties are assigned at formation
or by governance fact and are stable between those events. kCv_o changes as the corpus
grows, without any governance event. kCv is downstream of constitutional evidence —
it reads the constitution, it is not part of it.

---

## 3. The Five Dimensions

Each dimension answers a distinct epistemic question. They are not interchangeable.

### kCv_o — Originality

*What is this molecule's temporal priority in the corpus for this meaning?*

Originality is a function of canonical identity uniqueness relative to the full corpus
at evaluation time T. A molecule that arrived earlier than any other with the same
canonical hash has maximum originality within its meaning class. A molecule that
duplicates existing content has zero originality.

**Nature:** Emergent, corpus-relative.
**Time-dependence:** Monotonically non-increasing. As the corpus grows, kCv_o of any
molecule can only decrease or remain equal — it cannot increase. This is constitutionally
correct: originating a meaning unit becomes less notable as more molecules exist.
**Evidence:** canonicalHash uniqueness across Molecule corpus at time T.
**Governance-gated:** No. Changes without any governance event.

### kCv_u — Utility

*How well does this molecule's construction serve independent evaluation?*

Utility characterises the intrinsic quality of the molecule as a knowledge object:
whether its lexical content is sufficient for independent evaluation, whether its
structure satisfies the formation invariants for its type, whether its evidential
boundary is declared. A well-formed Claim with a clear subject, falsifiable predicate,
and declared provenance has higher utility than a vague assertion with no source.

**Nature:** Intrinsic — fixed at formation for immutable molecules.
**Time-dependence:** No. A molecule's content does not change after formation.
If the content is wrong, the molecule is superseded, not edited.
**Evidence:** lexical_content assessed against type-appropriate formation invariants
(ACS-400). capture_confidence is a proxy for this assessment.
**Governance-gated:** No.

### kCv_v — Verification

*Has this molecule's claim survived constitutional scrutiny?*

Verification records whether the molecule has been challenged and survived. It does
not measure truth — it measures constitutional durability. A molecule with high kCv_v
has been exposed to challenge, and the evidence for it has been found sufficient.
A molecule that has never entered governance has kCv_v = 0. That is not a failure;
most molecules are never challenged. It is the constitutional record of what has
been tested.

**Nature:** Emergent — governance history.
**Time-dependence:** Yes. Increases after survived_challenge facts are written.
**Evidence:** JournalFact chain — specifically fact_type=survived_challenge,
challenge_quality_score. The quality score of the challenge that was survived
weights the dimension: surviving a high-quality challenge contributes more than
surviving a weak one.
**Governance-gated:** Yes. kCv_v only changes after a constitutional state transition
through cerTransition. It cannot be self-reported.

### kCv_i — Impact

*Has this molecule's knowledge been observed to produce real outcomes?*

Impact records attributed real-world consequences of the molecule's application.
It requires JournalObservation records of type impact, carrying an outcome value.
Impact is the most demanding dimension because it requires evidence outside the
corpus itself — a record that something happened in the world as a result of this
knowledge being applied.

**Nature:** Emergent — outcome attribution.
**Time-dependence:** Yes. Accumulates as impact observations are recorded.
**Evidence:** JournalObservation where observation_type=impact, molecule_id=this,
model_signal_value is populated.
**Governance-gated:** No. Impact can be observed and recorded without governance.
But a single domain recording its own impact observations is weak evidence —
multi-domain corroboration contributes proportionally more.

### kCv_r — Reuse

*How many other molecules have built on this one?*

Reuse records the relational footprint of the molecule — how many other knowledge
objects have cited it, derived from it, implemented it, or built upon it. A molecule
that is the target of many DERIVES_FROM, CITES, or IMPLEMENTS edge molecules has
demonstrated that it is useful to other knowledge producers, not only to those who
created it.

**Nature:** Emergent — relational.
**Time-dependence:** Yes. Grows as new edge molecules are created.
**Evidence:** Edge molecules where edge_target_molecule_id = this molecule.
Molecule.reuse_count is a cache of this count.
**Governance-gated:** No. Changes when new edge molecules are admitted.

---

## 4. The Constitutional Asymmetry

kCv_u is the only dimension determinable at formation.

All other dimensions — Originality, Verification, Impact, Reuse — require
post-formation evidence. They are zero at formation and must be earned.

This is constitutionally significant. It means:

- A molecule enters the corpus characterised only by its intrinsic construction quality.
- Everything else accrues through constitutional events: governance, citation, attribution,
  challenge.
- A molecule with high utility but zero verification, impact, and reuse is not poorly
  characterised — it is accurately characterised as newly formed and untested.
- The dimensions do not need to be non-zero to be valid. Zero is information.

This asymmetry also means the derivation function must be time-aware. Running the
derivation at T=formation and at T=now will legitimately produce different results
for all dimensions except kCv_u.

---

## 5. Properties Every Valid Derivation Must Satisfy

These are not implementation constraints. They are constitutional requirements.
Any derivation — whether computed by a function, a service, a batch process, or a
future distributed component — must satisfy all of them.

**D-1 Evidence Retrievability.** Every non-zero component must be traceable to
retrievable journal records. A derivation cannot assert kCv_v > 0 without identifying
the JournalFact(s) that produced it.

**D-2 Corpus Snapshot Consistency.** Originality (kCv_o) must be computed against
a declared corpus snapshot. The snapshot time T must be recorded alongside the result.
A derivation of kCv_o without a declared T is constitutionally incomplete.

**D-3 No Self-Report.** No dimension may be increased by evidence contributed solely
by the author domain of the molecule being characterised. Impact observations from the
authoring domain carry reduced weight. A domain cannot verify its own molecules.

**D-4 Monotonicity of Originality.** kCv_o must not increase between derivations
at T1 and T2 where T2 > T1, unless molecules were removed from the corpus between
those times (which requires a constitutional fact). A derivation that shows increasing
originality without corpus reduction has an implementation error.

**D-5 Governance Gating for Verification.** kCv_v must not be non-zero unless
at least one JournalFact with fact_type=survived_challenge exists for this molecule.
A derivation that produces kCv_v > 0 without this evidence has fabricated verification.

**D-6 Separability.** Each dimension must be derivable independently. A derivation
that cannot produce kCv_v without also computing kCv_o has collapsed the architecture.
The dimensions are independent characterisations that happen to describe the same object.

---

## 6. What ACS-401 Does Not Define

The following are deliberately outside this specification:

**Aggregation.** How dimensions are combined for retrieval ranking, display, or
economic attribution is an application concern, not a constitutional one. ACS-401
defines what each dimension means and how it is derived. It does not specify how to
add them, weight them, or collapse them into a single number for any purpose.

**Thresholds.** What kCv_v value constitutes "well-verified" is a policy question.
ACS-401 defines that kCv_v is derived from challenge survival. The threshold above
which a molecule is considered sufficiently verified belongs in operational configuration,
not in the constitution.

**Mathematical functions.** The specific formulas used to compute each dimension from
its evidence are implementation choices. They must satisfy D-1 through D-6. Beyond
that, they are not constitutional matters. Different implementations may use different
functions and both be constitutionally valid, provided both satisfy the derivation
properties.

---

## 7. Relationship to the Object Constitution

ACS-401 depends on ACS-400. A kCv derivation applied to a malformed molecule —
one that failed formation invariants but was admitted anyway — produces a precisely
wrong characterisation. The correctness of the object being measured is a precondition
for the correctness of the measurement.

This is the dependency order:

    Molecule formation (ACS-400)
            ↓
    Constitutional events (cerTransition, challengeProtocol, edge molecules)
            ↓
    Journal records (JournalFact, JournalObservation, Edge Molecules)
            ↓
    kCv derivation (ACS-401)
            ↓
    kCv cache on Molecule entity (convenience — not authority)
            ↓
    Downstream use: retrieval ranking, economic attribution, governance signals
