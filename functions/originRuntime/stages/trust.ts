// Stage 7 — TRUST SCORED  (this is kCv: trust and economic scoring)
// Pure function given explicit context: validated unit + corpus texts → scored unit
// Computes the Layer-1 kCv snapshot (Originality, Utility, Accuracy-estimate, Clarity).
// kCv_v, kCv_i, kCv_r remain 0 here — they only grow from later Observations (survival-based).

import { ValidatedUnit } from "./validate.ts";

export interface TrustContext {
  corpusTexts: string[];
}

export interface ScoredUnit extends ValidatedUnit {
  stage: "TRUST_SCORED";
  kCv_o: number;
  kCv_u: number;
  kCv_rank: number;
  capture_confidence: number;
}

function tok(t: string): string[] {
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3);
}

function scoreOriginality(text: string, corpus: string[]): number {
  const w = tok(text);
  if (corpus.length === 0) return Math.min((new Set(w).size / Math.max(w.length, 1)) * 1.2, 1.0);
  const cw = new Set(corpus.flatMap((t) => tok(t)));
  const novel = w.filter((x) => !cw.has(x)).length;
  return Math.min(0.3 + (novel / Math.max(w.length, 1)) * 0.7, 1.0);
}

function scoreClarity(text: string): number {
  const s = text.split(/[.!?]+/).filter((x) => x.trim().length > 0);
  if (!s.length) return 0.5;
  const l = s.map((x) => x.trim().split(/\s+/).length);
  const avg = l.reduce((a, b) => a + b, 0) / l.length;
  const asc = avg < 8 ? 0.6 : avg > 40 ? 0.4 : avg > 25 ? 0.7 : 0.9;
  const v = l.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / l.length;
  return Math.max(asc - Math.min(v / 200, 0.3), 0.2);
}

function scoreUtility(text: string, moleculeType: string): number {
  const patterns = [
    /\b(should|must|recommend|use|apply|ensure|calculate|measure|check|verify)\b/gi,
    /\b(therefore|thus|consequently|as a result)\b/gi,
    /\b(equation|formula|value|result|procedure|method|approach)\b/gi,
    /\d+(\.\d+)?(\s)?(mm|m|kg|kPa|bar|kW|MW|%|Pa\/m|m\/s)/gi,
  ];
  let hits = 0;
  for (const p of patterns) { const m = text.match(p); if (m) hits += m.length; }
  let base = Math.min(0.3 + (hits / Math.max(text.split(/\s+/).length, 1)) * 8, 1.0);
  if (moleculeType === "constraint") base = Math.min(base + 0.15, 1.0);
  if (moleculeType === "method") base = Math.min(base + 0.1, 1.0);
  return base;
}

function scoreAccuracy(text: string, moleculeType: string): number {
  let s = 0.6;
  const hedges = (text.match(/\b(may|might|could|possibly|approximately|roughly|estimated|assumed)\b/gi) || []).length;
  const grounding = (text.match(/\b(measured|verified|tested|confirmed|per|according to|standard|specification)\b/gi) || []).length;
  const numerical = (text.match(/\b\d+(\.\d+)?\b/g) || []).length;
  s -= hedges * 0.02; s += grounding * 0.04; s += Math.min(numerical * 0.01, 0.1);
  if (moleculeType === "constraint") s = Math.min(s + 0.1, 0.95);
  return Math.max(Math.min(s, 0.95), 0.2);
}

export function trust(unit: ValidatedUnit, ctx: TrustContext): ScoredUnit {
  const A = scoreAccuracy(unit.normalised_text, unit.molecule_type);
  const U = scoreUtility(unit.normalised_text, unit.molecule_type);
  const O = scoreOriginality(unit.normalised_text, ctx.corpusTexts);
  const C = scoreClarity(unit.normalised_text);
  const kCv_q = Math.round((0.35 * A + 0.25 * U + 0.2 * O + 0.2 * C) * 100) / 100;

  return {
    ...unit,
    stage: "TRUST_SCORED",
    kCv_o: Math.round(O * 100) / 100,
    kCv_u: Math.round(U * 100) / 100,
    kCv_rank: kCv_q,
    capture_confidence: Math.round(((A + U + O + C) / 4) * 100) / 100,
  };
}
