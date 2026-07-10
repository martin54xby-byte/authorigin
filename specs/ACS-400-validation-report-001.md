# ACS-400 Validation Report 001

Date: 2026-07-10
Status: FILED — not a constitutional amendment
Purpose: Record corpus test results before any ratification decision

This report does not change ACS-400.
It records what the corpus test found, what it implies, and what amendments are proposed
for deliberate ratification. The constitution changes through governance, not through
observation.

---

## 1. Corpus Tested

13 content molecules from the live AuthOrigin corpus (EXPLORED state).
Types represented: claim (4), constraint (4), container (2), method (1),
observation (1), definition (1).
Edge molecules excluded — governed by ACS-300, not ACS-400.

---

## 2. Results

| Outcome | Count | % |
|---|---|---|
| Admitted as typed | 7 | 54% |
| Reclassify | 1 | 8% |
| Reduce confidence | 0 | 0% |
| Reject (FC failure) | 5 | 38% |

The distribution is diagnostically useful. 13/13 passing would mean the constitution
is not discriminating. 0/13 would mean it is unrealistic. The actual result — majority
admitted, failures clustered in identifiable patterns — suggests the specification is
functioning as a validator, not as a filter.

---

## 3. Findings

### F-001 — Compound Molecules (RF-6 violation)

**Molecule:** mol-f8e189ab0c6e47ee (typed: constraint)

Content contains four distinct meaning units in a single molecule:
1. A method reference (duct sizing follows CIBSE Guide B)
2. A procedure application (Darcy-Weisbach applied at each fitting)
3. A figure citation (Figure 5, reference velocities)
4. A regulatory constraint (ASHRAE 90.1 fan efficiency, post-2024)

None of these is a constraint in the sense ACS-400 §6 defines. Each is a different type.
The molecule passed the FC-1/FC-2/FC-3 checks because it has length, provenance, and
canonical representability. But it violates RF-6: multiple molecule types embedded
without decomposition.

**Assessment:** This is the most significant finding. It is not a classifier error.
The classifier cannot decompose — it can only propose a type for a chunk it receives.
The chunking process upstream is what created this compound object. ACS-400 can catch
RF-6 at admission time, but cannot fix it. Fixing it requires a decomposition step
before the formation gate.

**Implication:** RF-6 is not a rejection condition — it is a decomposition trigger.
A candidate that fails RF-6 should not be rejected; it should be returned to the
decomposition stage with a recorded gap observation.

**Proposed amendment:** Revise §11 and §13 to distinguish RF-6 from other rejection
conditions. RF-6 → decomposition required, not rejected. Gap observation recorded with
gap_type=decomposition_required.

---

### F-002 — Constraint Misclassification

**Molecule:** mol-186a6a18801a342b (typed: constraint)

Content: "CIBSE Guide B provides guidance on heating, ventilating and air conditioning
system design, covering ductwork sizing, plant selection, and commissioning requirements
across UK commercial buildings."

This molecule describes the scope of a document. It makes no restriction. It names no
condition. CON-1 (condition presence) and CON-3 (restriction statement) both fail.

Correct type: definition (it declares the scope and authority of CIBSE Guide B as a
constitutional artifact in this corpus) or container (it is the anchor for the document).
The molecule already has a parent container (mol-container-75456f7e12e0). If that container
exists, this molecule is a duplicate scope declaration — it should be absorbed into the
container's lexical_content, not exist as a separate molecule.

**Assessment:** Confirms that "constraint" is being used where "definition" or "container"
belongs. The classifier is over-applying "constraint" to scope descriptions.

**Implication:** The type boundary between constraint and definition needs sharper
articulation. A constraint restricts applicability of other knowledge. A definition
declares the authority or scope of a knowledge source. These are not the same.

**Proposed amendment:** Add to §6 (Constraint invariants): "A molecule whose primary
content declares the scope or authority of a source document is not a Constraint. It is
either a Definition (if constitutionally authoritative) or absorbed into the Container
for that source."

---

### F-003 — Containers are Non-Propositional Objects

**Molecules:** mol-container-97f1bd21acf2, mol-container-75456f7e12e0

Both failed FC-1 (independence) because their content is a filename or source name only.
The test applied FC-1 universally, which caused the failure.

**Assessment:** This is a constitutional discovery, not a corpus error. FC-1 as written
applies to propositional content. Containers are not propositional — their value is
structural, not epistemic. Applying proposition rules to non-propositional objects is a
category error.

FC-1 is not wrong. Its scope is wrong.

**Implication:** ACS-400 needs explicit constitutional scope for its own rules. FC-1/FC-2/FC-3
apply to content molecules (claim, method, constraint, observation). Container formation
is governed by CTM-1/CTM-2/CTM-3, which already require scope declaration and source
attribution rather than propositional independence. The test inadvertently applied
content-molecule rules to structural molecules.

**Proposed amendment:** Add to §2: "The Fundamental Conditions FC-1, FC-2, FC-3 apply
to content molecules only: claim, method, constraint, observation, definition. Container
molecules are governed exclusively by CTM-1/CTM-2/CTM-3. Edge molecules are governed by
ACS-300."

---

### F-004 — JSON as Canonical Representation, Not as Molecule Content

**Molecule:** mol-csm-rules-9c214ddd4f84 (typed: definition)

The constitutional rule molecule stores its content as raw JSON. FC-1 check
("too short") was triggered on a truncated string, but the underlying question is deeper:

Is a JSON document the molecule, or is JSON the canonical representation of the molecule?

If JSON is the molecule, then the lexical_content field contains machine-readable
structure rather than human-intelligible constitutional statement. A definition molecule
should be intelligible to a constitutional reviewer without a parser.

**Assessment:** The right answer is that Definition Molecules with structured content
(rules, schemas, invariants) should carry both:
- A human constitutional statement (what this rule means and why)
- A canonical structured representation (the machine-evaluable form)

The current mol-csm-rules-9c214ddd4f84 carries only the JSON. That satisfies the
machine but not the constitutional reviewer.

**Implication:** This does not require a carve-out in FC-1. It requires that Definition
Molecules with structured content include a human statement. FC-1 universality is
preserved: the definition molecule must contain sufficient information to establish
independent meaning — and a JSON blob without a human preamble does not fully satisfy
that for a constitutional reviewer.

**Proposed amendment:** Add to §8 (Definition invariants): "A Definition Molecule whose
canonical representation is machine-structured (JSON, schema, enumeration) must also
include a human constitutional statement describing what the structure defines and why.
The human statement is part of the lexical_content; the structured representation
may follow it as a fenced block."

---

### F-005 — Vague Claims Pass FC but Fail Type Boundary

**Molecules:** mol-e5f6a1b2c3d4 ("HVAC systems are important for building comfort"),
mol-f6a1b2c3d4e5 ("AI will transform the engineering industry in coming years")

Both failed FC-1 (too short, vague) or FC-2 (no source). These are correct rejections.
But they surface a question: if these were longer and had a declared source, would they
pass? "HVAC systems are generally important for building comfort, as documented in
industry literature" would pass FC-1/FC-2/FC-3 but still fail CM-4 (falsifiability).

**Assessment:** FC checks are necessary but not sufficient for Claims. CM-4 is the
discriminating invariant for the claim type. This finding confirms that the two-layer
check (FC first, then type invariants) is the right architecture. The FC checks are
not doing CM-4's job — that would collapse the layers.

**Implication:** No amendment needed. The finding validates the layered check structure.

---

## 4. The Two-Constitution Discovery

This test has surfaced a distinction that should be made explicit before further
development:

**Object Constitution** — What is a valid molecule?
Governed by: FC-1/FC-2/FC-3, CM/MM/CON/OM/DM/CTM invariants, RF rejection codes.
Families: ACS-400 and successors.

**Behaviour Constitution** — What may happen to a molecule?
Governed by: state lifecycle, cerTransition, challengeProtocol, constitutional validation,
bindings, kCv derivation.
Families: ACS-100 through ACS-300, ACS-500 and successors (kCv).

These are different constitutions governing different aspects of the same objects. They
should not be in the same ACS family. Mixing them risks the same pattern that was
corrected earlier: governance rules bleeding into formation rules.

This report proposes that future ACS numbering reflect this:

| Range | Domain |
|---|---|
| ACS-000 to ACS-099 | Constitutional primitives and foundations |
| ACS-100 to ACS-299 | Object Constitution (formation, identity, typing) |
| ACS-300 to ACS-399 | Relationship Constitution (edges, lineage) |
| ACS-400 to ACS-499 | Value Constitution (kCv, derivation) |
| ACS-500 to ACS-599 | Behaviour Constitution (governance, transitions, bindings) |

Under this numbering, the current ACS-400 would be better placed as ACS-100 (Molecule
Formation Constitution). ACS-400 would then be reserved for the Value Constitution
(kCv derivation), which depends on ACS-100.

This is a naming proposal only. No documents are renamed in this report. The proposal
is recorded here for deliberate consideration before ratification.

---

## 5. Proposed Amendments (not yet ratified)

| ID | Target | Change | Status |
|---|---|---|---|
| A-001 | §13 RF-6 | Reclassify RF-6 as decomposition trigger, not rejection | PROPOSED |
| A-002 | §6 CON | Add: scope declarations are not constraints | PROPOSED |
| A-003 | §2 FC scope | Restrict FC-1/FC-2/FC-3 to content molecules only | PROPOSED |
| A-004 | §8 DM | Structured definitions must include human constitutional statement | PROPOSED |
| A-005 | ACS numbering | Renumber ACS families by domain | PROPOSED — naming only |

None of these amendments are ratified by this report.
Ratification requires a constitutional governance process: a proposed amendment molecule,
review, and a JournalFact recording the ratification decision.

---

## 6. What This Report Does Not Do

- It does not change ACS-400.
- It does not ratify any amendment.
- It does not invalidate existing molecules in the corpus.
  Existing molecules are grandfathered — they were admitted under the rules that existed
  at the time. Future ingestion will apply the ratified invariants.
- It does not require immediate action.
  The findings are recorded. Work continues on other priorities. Amendments ratify
  when the governance process produces a fact.
