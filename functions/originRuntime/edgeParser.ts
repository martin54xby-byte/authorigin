// Deterministic Edge Parser — Phase 1 (ACS-300 §7)
// Scope: regex/structural extraction only. No embeddings, no LLMs, no semantic inference.
// Relationship types: CITES, REFERENCES_STANDARD, DERIVES_FROM, IMPLEMENTS.
// SUPPORTS / CONTRADICTS deliberately NOT enabled — those require semantic interpretation.
//
// Pipeline: Molecule -> Pattern Scanner -> Reference Extractor -> Target Resolver
//           -> Edge Candidate -> Verification Gate -> Edge Molecule

export const ALGORITHM_VERSION = "edge-parser-1.0.0";

const STANDARD_REGEX = /\b(ASHRAE\s\d+(?:\.\d+)?|CIBSE\s+Guide\s+[A-Z]|CIBSE\s+TM\d+|TM\d+|BS\s?EN\s?\d+|BS\s\d+|ISO\s?\d+|Part\s+[A-Z])\b/g;
const CITATION_REGEX = /\b(?:see|refer to)\s+(?:figure\s+\d+\s+of\s+)?([A-Z][A-Za-z0-9\s\-]{2,80}?)(?=[\.,;]|$)/gi;
const DERIVATION_REGEX = /\b(?:calculated using|derived from)\s+(?:the\s+)?([A-Za-z0-9\-\s]{3,60}?)(?=[\.,;]|$)/gi;
const IMPLEMENTS_REGEX = /\bimplemented\s+according\s+to\s+([A-Za-z0-9\-\s]{3,60}?)(?=[\.,;]|$)/gi;

export interface RawCandidate {
  relationship_type: "CITES" | "REFERENCES_STANDARD" | "DERIVES_FROM" | "IMPLEMENTS";
  target_text: string;
  confidence: number;
  evidence_summary: string;
}

// Deterministic post-processing: if a captured span (from CITES/DERIVES_FROM/
// IMPLEMENTS) contains a known standard-code pattern, narrow the target to that
// exact code rather than the whole trailing clause. Reuses STANDARD_REGEX --
// no new heuristics, no fuzzy matching, just applying an already-approved
// deterministic pattern a second time against a narrower span.
function narrowToKnownCode(capturedText: string): string {
  const inner = new RegExp(STANDARD_REGEX.source, "");
  const found = inner.exec(capturedText);
  return found ? found[1].replace(/\s+/g, " ").trim() : capturedText;
}

// ── PATTERN SCANNER + REFERENCE EXTRACTOR ──────────────────────────────────
// Deterministic only: fixed regex patterns, no scoring, no inference of unstated meaning.
export function extractCandidates(text: string): RawCandidate[] {
  const candidates: RawCandidate[] = [];
  const sentenceOf = (idx: number): string => {
    const before = text.lastIndexOf(".", idx);
    const after = text.indexOf(".", idx);
    return text.substring(before === -1 ? 0 : before + 1, after === -1 ? text.length : after + 1).trim();
  };

  let m: RegExpExecArray | null;

  const std = new RegExp(STANDARD_REGEX);
  while ((m = std.exec(text)) !== null) {
    candidates.push({ relationship_type: "REFERENCES_STANDARD", target_text: m[1].replace(/\s+/g, " ").trim(), confidence: 1.0, evidence_summary: sentenceOf(m.index) });
  }

  const cit = new RegExp(CITATION_REGEX);
  while ((m = cit.exec(text)) !== null) {
    candidates.push({ relationship_type: "CITES", target_text: narrowToKnownCode(m[1].replace(/\s+/g, " ").trim()), confidence: 1.0, evidence_summary: sentenceOf(m.index) });
  }

  const der = new RegExp(DERIVATION_REGEX);
  while ((m = der.exec(text)) !== null) {
    candidates.push({ relationship_type: "DERIVES_FROM", target_text: narrowToKnownCode(m[1].replace(/\s+/g, " ").trim()), confidence: 0.9, evidence_summary: sentenceOf(m.index) });
  }

  const impl = new RegExp(IMPLEMENTS_REGEX);
  while ((m = impl.exec(text)) !== null) {
    candidates.push({ relationship_type: "IMPLEMENTS", target_text: narrowToKnownCode(m[1].replace(/\s+/g, " ").trim()), confidence: 0.9, evidence_summary: sentenceOf(m.index) });
  }

  return candidates;
}

// ── TARGET RESOLVER ────────────────────────────────────────────────────────
// Exact normalised-string match ONLY against known molecule source_name values.
// Deliberately NOT fuzzy/substring/heuristic — an unresolved reference is a valid,
// informative outcome (logged, not guessed at).
export function normaliseForResolution(s: string): string {
  return s.toLowerCase().replace(/[_\-]/g, " ").replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

export function resolveTarget(targetText: string, allMolecules: any[]): string | null {
  const norm = normaliseForResolution(targetText);
  const match = allMolecules.find((m) => m.molecule_type !== "edge" && m.source_name && normaliseForResolution(m.source_name) === norm);
  return match ? match.molecule_id : null;
}
