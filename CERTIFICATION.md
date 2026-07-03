# Origin Runtime Certification v1.0 — CERTIFIED

Molecule: mol-cert-65ff24b0bb80 (VERIFIED_STRONG, foundational)
Fact: fact-cert-origin-runtime-v1 (constitutional_snapshot)

## Canonical Equivalence Test Suite (CETS) — Run 1

Reference documents: 4 (constraint, method, claim, observation flavours)

| Level | Result |
|---|---|
| 1. Identity (canonicalHash) | 4/4 exact match — 100%, zero tolerance |
| 2. Structure (classification) | 4/4 exact match — 100% |
| 2. Structure (kCv_u, deterministic) | 4/4 exact match — 100% |
| 2. Structure (kCv_o, corpus-relative) | Diverged in all 4 — fully reconciled algebraically, root cause: corpus grew between legacy ingestion and certification run. Not an implementation defect. |
| 3. Runtime (Context/Events) | Present only in Origin Runtime — expected, by design |
| 4. Behaviour (search/detail/reuse/corpus) | 100% — confirmed live against legacy-created molecules |

**Trust Delta:** 5.5% avg absolute (fully attributed to documented Originality time-dependency)
**Reuse Delta:** 0%
**Status:** CERTIFIED

## Key finding
kCv_o (Originality) is corpus-relative, not a pure function of text. Any future comparison
of this dimension must be corpus-snapshot-relative, not absolute across time. This is now
a documented, permanent characteristic of the metric.

## Next steps
documentIngestion.ts may be marked deprecated but stays deployed as certified baseline for
at least one more release cycle. Cross-document lineage work may now proceed on the
certified Origin Runtime.
