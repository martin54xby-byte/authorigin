# ACS-400 — Molecule Formation Constitution

Status: DRAFT — awaiting ratification
Depends on: ACS-300 (Origin Relationship Specification), Origin Runtime Certification v1.0
Supersedes: implicit formation rules scattered across originRuntime stage implementations

---

## 1. Purpose

Define what qualifies as an AuthOrigin Molecule before any code creates one.

The prior formation process was:

    Document → Chunk → Molecule → Classifier labels it

This is constitutionally incorrect. It produces containers of text, not knowledge objects.
The type assigned post-hoc is metadata, not identity.

The correct process is:

    Document → Meaning extraction → Candidate meaning unit
           → Type qualification → Formation invariant check
           → Canonical molecule (if admitted) | Rejected candidate (if not)

The type is part of whether the object is valid. A candidate that does not satisfy the
formation invariants for its proposed type is not a molecule. It is either reclassified to
a type whose invariants it does satisfy, or it is rejected from the corpus entirely.

This specification defines those invariants.

---

## 2. The Fundamental Question

Before any classification occurs, one question must be answered:

    Does this unit of meaning have a stable enough identity to warrant
    a canonical hash, a provenance record, and a governance lifecycle?

Three conditions must all be true:

**FC-1 Independence** — The meaning unit can be understood, verified, or challenged
independently of the surrounding document. A sentence that only makes sense in context of
the paragraph above it is not independent. A claim that stands alone — "System X reduced
latency by 40% under condition Y" — is independent.

**FC-2 Boundary Completeness** — The meaning unit contains all information required to
evaluate its own validity. If evaluating it requires importing undeclared assumptions from
elsewhere, it is not boundary-complete. The boundary may reference other molecules (via
lineage), but the reference must be explicit and declared, not implicit.

**FC-3 Canonical Representability** — The meaning unit can be expressed in a canonical
normalised form that deterministically identifies it. Two researchers encountering the same
knowledge unit in different documents should, after normalisation, produce the same
canonical hash.

A candidate that fails any of FC-1, FC-2, or FC-3 does not become a molecule of any type.
It may become an Observation (see §8), or it may be discarded.

---

## 3. Valid Molecule Types

AuthOrigin recognises exactly six content molecule types. The `molecule_type` field is
a constitutional declaration, not a label. Formation invariants differ per type.

| Type | Represents |
|---|---|
| `claim` | A falsifiable assertion about the world |
| `method` | A procedure that can be followed to achieve an outcome |
| `constraint` | A condition that restricts the applicability of other knowledge |
| `observation` | A recorded fact about a specific event, measurement, or state |
| `definition` | A constitutionally authoritative declaration of meaning |
| `container` | A structural anchor for a document, section, or corpus context |

Types `edge` and `knowledge_document` are also valid molecule_type values per the schema
(ACS-300 and legacy ingestion respectively) but are not content molecules. They have
separate formation rules and are not governed by this specification.

---

## 4. Claim Molecule — Formation Invariants

A Claim is a falsifiable assertion about the world. It represents the core epistemic unit
of AuthOrigin: something that can be verified, challenged, and whose survival or failure
carries evidential weight.

**CM-1 — Assertion Presence**
The lexical content must contain a propositional statement — something that can be true or
false. Normative statements ("should", "must"), rhetorical questions, definitions, and
procedural descriptions are not assertions.

Rejected: "AI is transforming many industries."
(Not falsifiable as stated — no condition, no boundary, no measurable predicate)

Admitted: "Neural network model X achieved 94.2% accuracy on benchmark Y under condition Z."
(Falsifiable: specific model, specific benchmark, specific condition)

**CM-2 — Subject Identifiability**
The subject of the assertion must be identifiable. Pronouns without antecedents, anonymous
"the system", unspecified "some models" do not satisfy this invariant.

Rejected: "It was found to improve performance."
Admitted: "BERT-large fine-tuned on dataset D improved F1 score on task T by 12 points."

**CM-3 — Evidential Boundary**
The claim must declare or reference its evidential basis. Where does this claim come from?
Who established it? Under what conditions? The evidential basis need not be reproduced in
full within the molecule, but it must be referenceable. This is satisfied by the molecule's
provenance fields (author_domain_id, source_name, parent_molecule_ids) but those fields
must be populated — a claim with no declared provenance is formation-incomplete.

**CM-4 — Falsifiability Condition**
There must exist at least one possible state of the world that would constitute evidence
against this claim. Universal claims ("X always", "X never") are admitted only if the
domain boundary is explicit ("within systems of type T, X always...").

**CM-5 — No Embedded Procedure**
A valid claim does not contain instructional or procedural content. If the candidate
contains "to do X, first do Y, then do Z", it is not a claim — it is a method. Formation
admissibility requires classification before admission, not labelling after.

---

## 5. Method Molecule — Formation Invariants

A Method is a procedure that, when followed, is intended to produce a defined outcome. It
is reusable knowledge — its value is in application, not in assertion.

**MM-1 — Objective Presence**
The method must state what it is for. What does following this procedure achieve? An
undirected sequence of actions is not a method molecule.

Rejected: "Step 1: open file. Step 2: parse headers. Step 3: write output."
(No stated objective — could be part of any number of procedures)

Admitted: "Procedure to extract molecule candidates from engineering documents:
Step 1... [objective: identify semantically independent meaning units]"

**MM-2 — Procedure Structure**
The method must contain ordered or partially-ordered actions. At minimum there must be a
sequence: before and after, or dependency between steps. An unordered list of
recommendations is not a method.

**MM-3 — Input Specification**
The method must declare what it requires. Required inputs may be materials, states,
preconditions, or data. A procedure with undeclared inputs is not reproducible and
therefore not independently verifiable.

**MM-4 — Outcome or Applicability Condition**
The method must declare what constitutes successful execution, or the conditions under
which the method is valid. Methods without outcome conditions cannot be challenged on
grounds of failure — they are unfalsifiable procedures, not knowledge objects.

**MM-5 — No Embedded Assertion**
A valid method does not contain claims about the world as its primary content. If the
candidate's primary content is "X is true because...", it is a claim, not a method.
Embedded justifications within a method are permitted as supporting context but must not
constitute the canonical meaning.

---

## 6. Constraint Molecule — Formation Invariants

A Constraint restricts the applicability of other knowledge. It is a boundary declaration:
the domain within which some claim, method, or definition is valid, or the condition under
which it does not hold.

**CON-1 — Condition Presence**
The constraint must declare a condition — the triggering state or domain that activates the
restriction. "When X", "for Y greater than Z", "in systems of type T".

Rejected: "The equation requires careful application."
(No declared condition — "careful" is not a constitutional boundary)

Admitted: "The Darcy-Weisbach equation is valid only for fully developed, steady-state,
incompressible flow in straight pipes of constant cross-section."
(Explicit condition: flow regime, state, fluid type, geometry)

**CON-2 — Affected Object**
The constraint must identify what it constrains. It must reference the molecule, claim,
method, or domain it applies to, either directly (by molecule_id) or by declared scope.

**CON-3 — Restriction Statement**
The constraint must state the actual restriction: what is prohibited, required, or bounded.
"Use with caution" is not a restriction. "Valid only when Reynolds number Re > 4000" is.

**CON-4 — Boundary Precision**
The constraint boundary must be precise enough to be operationalised. A future evaluator
must be able to determine, given a specific case, whether the constraint applies.

**CON-5 — Linkage at Formation**
A constraint that references another molecule must declare that reference at formation via
parent_molecule_ids or an edge molecule. A free-floating constraint — one that claims to
restrict something but declares no target — is incomplete and must be rejected until the
target is identified.

---

## 7. Observation Molecule — Formation Invariants

An Observation is a recorded state of the world at a specific time and context. It is
not an assertion about general truth — it is evidence. Its value is in what it confirms
or challenges in other molecules.

**OM-1 — Event or State Specificity**
The observation must describe a specific, bounded event or state — not a general pattern.
"Models trained on large corpora tend to generalise better" is a claim, not an observation.
"Model M trained on corpus C achieved accuracy A on evaluation date D" is an observation.

**OM-2 — Observation Context**
The observation must declare the context in which it was made: by whom, under what
conditions, at what time. Decontextualised measurements are not valid observations because
they cannot be compared against or reproduced.

**OM-3 — Source Boundary**
The observation must declare its source. Where did this datum originate? An observation
without a declared source is constitutionally indistinguishable from a claim and must be
classified as one (with the associated formation requirements).

**OM-4 — No Embedded Interpretation**
A valid observation does not contain the observer's interpretation of what the observation
means. Interpretation makes it a claim. The observation records what happened; a separate
claim molecule records what it implies.

Rejected: "The system processed 10,000 requests per second, demonstrating superior
scalability." [The second clause is interpretation — a claim, not an observation]

Admitted (as two molecules): 
  Observation: "System S processed 10,000 requests/second under load profile L on date D."
  Claim: "System S demonstrates superior scalability relative to class C under profile L."

---

## 8. Definition Molecule — Formation Invariants

A Definition is a constitutionally authoritative declaration of meaning. It has a special
status in AuthOrigin: it is the source of semantic authority for terms used in other
molecules. Constitutional amendments and governance rules are definitions.

**DM-1 — Term Identification**
The definition must identify the term being defined. A definition without a clear definiendum
is not a definition molecule — it may be an observation or a claim about language.

**DM-2 — Scope Declaration**
The definition must declare the domain within which it is authoritative. Definitions are
not universal — they are valid within a declared epistemic scope. "In the context of
AuthOrigin, a Molecule is..." is a valid definition. "A molecule is a unit of
knowledge" without scope is formation-incomplete.

**DM-3 — Constitutional Lineage**
Definitions that supersede previous definitions must declare their predecessor via
successor_molecule_id on the superseded molecule. A definition that silently replaces
another without constitutional lineage is inadmissible.

---

## 9. Container Molecule — Formation Invariants

A Container anchors a document, section, or corpus context. It is a structural molecule,
not a knowledge molecule — it holds provenance and scope but does not itself assert,
define, or observe.

**CTM-1 — Scope Declaration**
The container must declare the scope it anchors: document, section, chapter, corpus.

**CTM-2 — Source Attribution**
The container must carry the authoritative source attribution for all molecules it contains.
author_domain_id, source_name, and vsid must be populated.

**CTM-3 — No Epistemic Content**
A container must not assert, define, or observe. If a candidate contains propositional
content in addition to structural framing, that content must be extracted as a separate
child molecule. The container and the claim are not the same object.

---

## 10. The Classifier is a Proposal Mechanism

The extraction and classification process — whether deterministic, LLM-assisted, or
human-supplied — produces candidates. It does not produce molecules.

The formation invariant validator is the gate that converts a candidate into a molecule.

This separation is constitutional:

- The classifier proposes a type.
- The invariant validator determines whether the candidate satisfies the invariants for
  that type.
- If not, the candidate is either reclassified (if it satisfies a different type's
  invariants) or rejected (recorded as a gap observation — observation_type=formation_gap).

An LLM proposing that a chunk of text is a Claim does not make it a Claim. The formation
invariants make it a Claim. This is the same principle that governs edge molecules (ACS-300
§7): the algorithm proposes, the verification gate decides.

---

## 11. What Becomes an Observation vs What Is Rejected

Not every candidate that fails formation for its proposed type is discarded.

A candidate may be:

| Outcome | Condition |
|---|---|
| Admitted as proposed type | Satisfies all invariants for proposed type |
| Reclassified and admitted | Fails proposed type, satisfies a different type |
| Admitted as Observation | Fails all typed invariants but FC-1/FC-2/FC-3 are satisfied |
| Rejected — formation gap | Fails FC-1, FC-2, or FC-3 entirely |

Formation gaps are recorded as JournalObservation records with observation_type=formation_gap,
gap_type=molecule_formation, and evidence describing which invariant was violated. This
preserves a complete record of what was extracted but could not be constituted as a molecule,
enabling future reprocessing if the extraction model improves.

---

## 12. Relationship to kCv

Formation invariants are the prerequisite for meaningful kCv calculation.

- **kCv_v** (Verification) can only be meaningful for a Claim or Method — objects that can
  be challenged on grounds of falsifiability or procedural soundness. An Observation cannot
  be "verified" in the same sense; it can be confirmed or contradicted.

- **kCv_r** (Reuse) is primarily meaningful for Methods and Constraints — objects that are
  applied in other contexts. A Claim can also be cited, but its reuse pattern differs.

- **kCv_i** (Impact) is meaningful for Claims and Observations — objects that describe or
  predict states of the world.

- **kCv_o** (Originality) is type-agnostic but corpus-relative. See ACS Amendment
  mol-acs-kcv-o-temporal.

The correct dependency is:

    Typed, well-formed molecule
              ↓
    Type-appropriate kCv dimension activity
              ↓
    Derived kCv state (from journal)
              ↓
    kCv cache on Molecule entity (convenience, not authority)

This confirms the work order: ACS-400 (formation) before ACS-401 (kCv derivation). A kCv
derivation applied to a malformed molecule measures the wrong object precisely.

---

## 13. Rejection Conditions — Summary

A candidate is rejected from molecule formation if any of the following hold:

| Code | Condition |
|---|---|
| RF-1 | Fails FC-1: meaning is context-dependent, not independently evaluable |
| RF-2 | Fails FC-2: boundary incomplete — requires undeclared external assumptions |
| RF-3 | Fails FC-3: cannot be canonically represented with stable identity |
| RF-4 | Proposed type invariants not satisfied, and no alternative type admits it |
| RF-5 | Provenance fields empty: author_domain_id or source_name undeclared |
| RF-6 | Multiple molecule types embedded in a single candidate without decomposition |

RF-6 is particularly important. A passage that contains both a claim and a method must be
decomposed before either can be admitted. Admitting the compound as a single molecule
would collapse the type structure that makes kCv meaningful.

---

## 14. Open Questions (to be resolved before ratification)

**Q1: Degree of specificity for Claim CM-1**
How operationalised must the falsifiability condition be? Is "System X outperforms System Y
on task T" admissible, or does it require a quantitative condition ("by at least 10% on
benchmark B under conditions C")?

Proposed position: the weaker form is admitted at capture_confidence < 0.7. The stronger
form at capture_confidence >= 0.7. Confidence is set by the classifier and is challengeable
via governance.

**Q2: Formation invariant evolution**
These invariants are themselves constitutional artifacts. How do they evolve?
Via the same governance process as any other definition molecule — ACS-400 would be
superseded by ACS-401 or an amendment, not edited in place.

**Q3: Partial satisfaction**
A candidate that satisfies 4 of 5 invariants for a Claim — is it rejected, or admitted at
lower confidence? Proposed position: admitted at reduced capture_confidence (the missing
invariant is recorded as an evidence_gap_flag), not rejected outright. Full rejection
only on FC-1/FC-2/FC-3 failure or RF-5/RF-6.

---

## 15. Constitutional Anchoring

This specification, once ratified, becomes a Definition Molecule in the corpus with:
- molecule_type: definition
- weight_class: constitutional
- is_foundational: true
- scope_definition: authorigin:molecule-formation-constitution
- vsid: ACS-400

ACS-401 (kCv Derivation Constitution) depends on this specification and must not be
drafted until ACS-400 is ratified.
