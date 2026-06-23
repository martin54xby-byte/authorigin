# Contribution Value Framework
## The Score Before the Vault
## AuthOrigin — June 23, 2026

---

## The Central Clarification

There are three distinct things that have been conflated throughout this design:

| Thing | Question | When computable |
|-------|----------|----------------|
| Answer quality | Was this response good? | Immediately |
| Contribution value | Did this matter over time? | Weeks to years later |
| Provenance trust | Can the score be believed? | Only needed once scores matter |

These are not the same product. They should not be designed as one system.

**kCv is a value-estimation mechanism.**
**Governance is a trust-preservation mechanism.**

You can build and validate the first long before you need the second.
The full AuthOrigin constitutional architecture is Layer 4.
It should be the last thing built, not the first.

---

## The Four Value Vectors

A contribution is not a single number. It is four independent measurements:

```
Contribution = (kCv, fCv, aCv, rCv)
```

These must not be collapsed into one score. They answer different questions
and a high score on one says nothing about the others.

---

## kCv — Knowledge Contribution Value

*How good is the knowledge contribution?*

### Layer 1: Answer Quality (immediate)

```
kCv_q = 0.35·A + 0.25·U + 0.20·O + 0.20·C
```

| Signal | Meaning | How measured |
|--------|---------|-------------|
| A — Accuracy | Was it correct? | Subsequent confirmation or refutation |
| U — Utility | Was it useful? | Did someone act on it? |
| O — Originality | Was it novel? | Semantic distance from existing corpus |
| C — Clarity | Was it understood? | Comprehension signals, follow-up rate |

This is computable at the moment of an answer, with initial estimates,
and updated as signals arrive. No infrastructure required beyond a record.

### Layer 2: Contribution Value (time-weighted)

```
kCv_c = 0.35·A + 0.25·U + 0.20·O + 0.20·D
```

Clarity (C) is replaced by Durability (D): is it still relevant and cited
at 3 months, 6 months, 12 months? This is the same formula with the
time-dependent signal replacing the immediate one.

**The key distinction:** answer quality is about the moment.
Contribution value is about what actually happened afterward.

Many answers score high on kCv_q and vanish. A few score modestly but
become foundational. kCv_c is the better measure of actual value delivered —
but you can only calculate it retrospectively.

---

## fCv — Financial Contribution Value

*How much economic value did this contribution create?*

```
fCv = Impact × Confidence
```

| Term | Meaning |
|------|---------|
| Impact | Estimated economic effect (savings, revenue, risk avoided) |
| Confidence | Fraction of that effect attributable to this contribution |

### Example

```
Engineer B observes: "The pump sizing assumption is wrong.
                      Reduce pipe diameter in Zones 4–8."

Estimated project saving:  £500,000
Attribution confidence:    0.60
fCv =                      £300,000
```

This is crude. It is also honest. It does not pretend to precision it
cannot have. The confidence figure carries the epistemic weight.

### The attribution chain

fCv requires lineage to be credible:

```
Project saving: £1,000,000
    ↑ Decision (40% engineer)
    ↑ Design option (20% AI analysis)
    ↑ Source knowledge (25% historical projects)
    ↑ Standards corpus (10%)
    ↑ External research (5%)

AI contribution fCv = £1,000,000 × 0.20 = £200,000
```

Without lineage, fCv is a guess. With lineage, it is an estimate with
traceable reasoning. This is why the journal architecture matters —
not to compute the score, but to make the attribution chain auditable.

### The critical asymmetry

```
Engineer A:  kCv_q = 0.87   fCv ≈ £0
Engineer B:  kCv_q = 0.41   fCv = £300,000
```

This happens constantly. High knowledge quality does not imply high
financial value. Low knowledge quality does not preclude massive impact.
**These dimensions must never be collapsed into a single number.**

---

## aCv — Adoption Contribution Value

*How widely was this contribution used?*

```
aCv = reuse_count / time_window
```

This is adoption velocity — not just how often it was used, but the
rate at which usage is growing or declining. A contribution cited 10 times
in its first week and never again is different from one cited steadily
for three years.

aCv is partially captured by kCv_u (utility) in the existing kCv projection,
but as a separate vector it measures ecosystem spread rather than
quality of any individual use.

---

## rCv — Risk Contribution Value

*How much risk did this contribution prevent or reduce?*

```
rCv = risk_avoided × confidence
```

This is often the largest number and the least tracked.

An answer that prevents a £5 million construction error has enormous rCv
even if it has low kCv_q (it may be a simple correction, not a novel insight)
and low fCv (no direct financial gain, only cost avoidance).

Risk value compounds: a contribution that prevents a mistake early in a
project prevents all the downstream costs of that mistake. The lineage
chain here is particularly important for attribution.

---

## The Correct Build Sequence

```
Layer 1 — kCv_q
  Score an answer immediately on four signals.
  No infrastructure. A form, a formula, a number.
  Ship this. See if it is useful.

Layer 2 — kCv_c + aCv
  Track what happens to answers over time.
  Reuse events, citations, survival.
  Needs: observation recording, time-windowed projection.
  The molecule + JournalObservation layer handles this.

Layer 3 — fCv + rCv
  Connect contributions to project outcomes.
  Requires: outcome recording, lineage traversal, confidence assignment.
  Needs: the full lineage graph.

Layer 4 — Provenance trust (AuthOrigin full architecture)
  Make the scores auditable, challengeable, and resistant to gaming.
  Only needed once the scores matter to enough people that
  someone has an incentive to manipulate them.
  The journal, challenge protocol, constitutional governance,
  and binding architecture all live here.
```

**We built Layer 4 first.**

The architecture is correct. The sequence was inverted.

---

## What to Build Next

Not Phase 7.

A simple, working kCv_q calculator.

Inputs:
- accuracy_estimate (0–1): initial signal, updatable
- utility_signal (0–1): was it used in a decision?
- originality_signal (0–1): how novel vs existing corpus?
- clarity_signal (0–1): was it understood without follow-up?

Output:
- kCv_q score (0–1)
- confidence (how many signals are estimated vs observed?)
- decay_flag (has accuracy been refuted since scoring?)

Then track it over time and see whether kCv_q at creation predicts
kCv_c (contribution) at 6 months.

If it does: the metric is useful. Build more infrastructure around it.
If it doesn't: revise the formula before protecting it.

The full constitutional architecture is the right eventual home.
But the score needs to prove itself first.

---

## Summary

| Metric | Question | Formula | When |
|--------|----------|---------|------|
| kCv_q | Was this answer good? | 0.35A + 0.25U + 0.20O + 0.20C | Immediate |
| kCv_c | Did this matter? | 0.35A + 0.25U + 0.20O + 0.20D | 3–12 months |
| fCv | What did it earn or save? | Impact × Confidence | On outcome |
| aCv | How widely was it adopted? | reuse_count / time_window | Ongoing |
| rCv | What risk did it prevent? | risk_avoided × Confidence | On near-miss or avoidance |

These are four independent vectors. Never collapse them.
A complete contribution record carries all four.

---

*Contribution Value Framework*
*AuthOrigin — June 23, 2026*
