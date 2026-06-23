// AuthOrigin — Document Ingestion + Molecule Decomposition + kCv-Scored Search
// Demonstrates: HOL → lexical content → molecule → value
// June 23, 2026

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { createHash } from "node:crypto";

const CONSTITUTION_VERSION = "v1.0";

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}
function generateId(...parts: any[]): string {
  return sha256(JSON.stringify(parts) + Date.now() + Math.random()).substring(0, 24);
}
function now(): string { return new Date().toISOString(); }

// ─────────────────────────────────────────────
// LEXICAL SCORING — kCv_q snapshot
// No trained model. Pure signal from text properties.
// These are observable proxies, not ground truth.
// ─────────────────────────────────────────────

function scoreOriginality(text: string, allTexts: string[]): number {
  // Proxy: unique word ratio vs corpus average
  const words = tokenise(text);
  const unique = new Set(words).size;
  const ratio = unique / Math.max(words.length, 1);

  if (allTexts.length === 0) return Math.min(ratio * 1.2, 1.0);

  // Compare against existing molecules — lower overlap = higher originality
  const corpusWords = new Set(allTexts.flatMap(t => tokenise(t)));
  const novelWords = words.filter(w => !corpusWords.has(w)).length;
  const novelRatio = novelWords / Math.max(words.length, 1);
  return Math.min(0.3 + novelRatio * 0.7, 1.0);
}

function scoreClarity(text: string): number {
  // Proxies: sentence length variance, avg sentence length, punctuation density
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length === 0) return 0.5;

  const lengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;

  // Ideal: 15–25 words per sentence
  const avgScore = avg < 8 ? 0.6 : avg > 40 ? 0.4 : avg > 25 ? 0.7 : 0.9;

  // Variance penalty: high variance = harder to parse
  const variance = lengths.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / lengths.length;
  const varPenalty = Math.min(variance / 200, 0.3);

  return Math.max(avgScore - varPenalty, 0.2);
}

function scoreUtility(text: string): number {
  // Proxy: presence of actionable / instructional signals
  const actionPatterns = [
    /\b(should|must|recommend|use|apply|ensure|calculate|measure|check|verify)\b/gi,
    /\b(therefore|thus|consequently|as a result|this means)\b/gi,
    /\b(equation|formula|value|result|output|procedure|method|approach)\b/gi,
    /\d+(\.\d+)?(\s)?(mm|m|kg|kPa|bar|°C|kW|MW|%|l\/s|m³)/gi,
  ];
  let hits = 0;
  for (const p of actionPatterns) {
    const matches = text.match(p);
    if (matches) hits += matches.length;
  }
  return Math.min(0.3 + (hits / Math.max(text.split(/\s+/).length, 1)) * 8, 1.0);
}

function scoreAccuracyEstimate(text: string): number {
  // At ingest time, accuracy is unknown. We proxy with:
  // - presence of hedging language (lowers score slightly — honest uncertainty)
  // - presence of cited sources or measurements (raises score)
  // - contradictory signals lower it
  let score = 0.6; // baseline: unknown

  const hedging = (text.match(/\b(may|might|could|possibly|approximately|roughly|estimated|assumed)\b/gi) || []).length;
  const grounding = (text.match(/\b(measured|verified|tested|confirmed|per|according to|standard|specification|±)\b/gi) || []).length;
  const numerical = (text.match(/\b\d+(\.\d+)?\b/g) || []).length;

  score -= hedging * 0.02;
  score += grounding * 0.04;
  score += Math.min(numerical * 0.01, 0.1);

  return Math.max(Math.min(score, 0.95), 0.2);
}

function computeKcvQ(A: number, U: number, O: number, C: number): number {
  return Math.round((0.35 * A + 0.25 * U + 0.20 * O + 0.20 * C) * 100) / 100;
}

function tokenise(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);
}

// ─────────────────────────────────────────────
// DOCUMENT DECOMPOSITION
// Splits text into semantic molecules.
// Strategy: section headings + paragraph boundaries.
// Each chunk must have minimum substance (>50 words).
// ─────────────────────────────────────────────

interface RawChunk {
  section:   string;
  content:   string;
  position:  number;
}

function decomposeDocument(text: string, source_name: string): RawChunk[] {
  const chunks: RawChunk[] = [];

  // Detect section headings: lines that are short, possibly numbered, no period
  const lines = text.split('\n');
  let currentSection = source_name;
  let buffer: string[] = [];
  let position = 0;

  const isHeading = (line: string): boolean => {
    const t = line.trim();
    if (t.length === 0) return false;
    if (t.length > 120) return false;
    // Numbered: "1.", "1.1", "Section 2", "INTRODUCTION", all-caps short lines
    if (/^(\d+\.?\d*\.?\s+\w|[A-Z][A-Z\s]{3,40}$)/.test(t)) return true;
    // Markdown headings
    if (/^#{1,4}\s/.test(t)) return true;
    return false;
  };

  const flush = () => {
    const content = buffer.join(' ').replace(/\s+/g, ' ').trim();
    if (content.split(/\s+/).length >= 30) {
      chunks.push({ section: currentSection, content, position: position++ });
    }
    buffer = [];
  };

  for (const line of lines) {
    if (isHeading(line)) {
      flush();
      currentSection = line.trim().replace(/^#+\s*/, '');
    } else if (line.trim() === '') {
      // Paragraph break — flush if substantial
      if (buffer.join(' ').split(/\s+/).length >= 40) flush();
    } else {
      buffer.push(line.trim());
    }
  }
  flush();

  // If decomposition produced fewer than 3 chunks, fall back to paragraph split
  if (chunks.length < 3) {
    chunks.length = 0;
    const paragraphs = text.split(/\n\s*\n/);
    let pos = 0;
    for (const para of paragraphs) {
      const content = para.replace(/\s+/g, ' ').trim();
      if (content.split(/\s+/).length >= 30) {
        chunks.push({ section: source_name, content, position: pos++ });
      }
    }
  }

  return chunks;
}

// ─────────────────────────────────────────────
// ACTION: INGEST DOCUMENT
// ─────────────────────────────────────────────

async function ingestDocument(payload: any, base44: any): Promise<any> {
  const {
    document_text,
    source_name = "uploaded_document",
    author_id   = "unknown",
    author_domain_id = "unknown",
    document_type = "knowledge_document",
    context_note = "",
  } = payload;

  if (!document_text || document_text.trim().length < 50) {
    return { success: false, error: "document_text must be at least 50 characters" };
  }

  // Decompose into raw chunks
  const chunks = decomposeDocument(document_text, source_name);
  if (chunks.length === 0) {
    return { success: false, error: "Could not extract any substance from document" };
  }

  // Fetch existing molecule content for originality comparison
  const existing = await base44.asServiceRole.entities.Molecule.list();
  const existingTexts: string[] = existing
    .map((m: any) => m.metadata?.lexical_content ?? '')
    .filter((t: string) => t.length > 0);

  // Score and store each molecule
  const created: any[] = [];
  let parentId: string | null = null;

  for (const chunk of chunks) {
    const A = scoreAccuracyEstimate(chunk.content);
    const U = scoreUtility(chunk.content);
    const O = scoreOriginality(chunk.content, existingTexts);
    const C = scoreClarity(chunk.content);
    const kCv_q = computeKcvQ(A, U, O, C);

    const canonicalHash = sha256(chunk.content);
    const molecule_id   = `mol-${canonicalHash.substring(0, 16)}`;

    // Skip if already ingested (same content)
    if (existing.find((m: any) => m.canonicalHash === canonicalHash)) {
      existingTexts.push(chunk.content);
      continue;
    }

    const molecule: any = {
      molecule_id,
      canonicalHash,
      molecule_type:        document_type,
      current_state:        "EXPLORED",
      constitutional_status: "active",
      access_tier:          "open",
      weight_class:         "operational",
      is_foundational:      false,

      // kCv snapshot at ingest — Layer 1 scores
      kCv_o:                Math.round(O * 100) / 100,
      kCv_u:                Math.round(U * 100) / 100,
      kCv_v_score:          0,       // not yet verified
      kCv_v_quality:        "UNVERIFIED",
      kCv_i_score:          0,       // no outcomes yet
      kCv_i_status:         "UNOBSERVED",
      kCv_r_score:          0,       // no reuse yet
      kCv_r_status:         "NEW",
      kCv_rank:             kCv_q,

      capture_confidence:   Math.round(((A + U + O + C) / 4) * 100) / 100,
      observation_density:  0,
      reuse_count:          0,

      // HOL anchor — attribution, not scoring
      author_domain_id,
      vsid:                 author_id,

      // Lineage within document
      parent_molecule_ids:  parentId ? [parentId] : [],
      lineage_types:        parentId ? ["sequential"] : [],
      lineage_certainty:    parentId ? 0.9 : 1.0,

      scope_definition:     `${source_name}::${chunk.section}`,
      constitution_version: CONSTITUTION_VERSION,
      state_since:          now(),

      // Lexical content stored in metadata for search
      metadata: {
        lexical_content:   chunk.content,
        section:           chunk.section,
        position:          chunk.position,
        source_name,
        context_note,
        kCv_snapshot: { A, U, O, C, kCv_q },
        ingested_at:       now(),
      },
    };

    await base44.asServiceRole.entities.Molecule.create(molecule);

    // Write ingest observation
    const allObs  = await base44.asServiceRole.entities.JournalObservation.list();
    const lastSeq = Math.max(0, ...allObs.map((o: any) => o.journal_sequence ?? 0));
    const obs_id  = generateId("obs-ingest", molecule_id);
    await base44.asServiceRole.entities.JournalObservation.create({
      observation_id:    obs_id,
      molecule_id,
      canonicalHash,
      observation_type:  "document_ingest",
      polarity:          1,
      conflict_flag:     false,
      actor_id:          author_id,
      actor_domain_id:   author_domain_id,
      actor_trust_score: 1.0,
      metadata:          { source_name, section: chunk.section, kCv_q },
      constitution_version: CONSTITUTION_VERSION,
      journal_sequence:  lastSeq + 1,
      observation_hash:  sha256(obs_id + molecule_id + now()),
      prior_entry_hash:  allObs.length > 0
        ? allObs[allObs.length - 1].observation_hash ?? "genesis"
        : "genesis",
    });

    existingTexts.push(chunk.content);
    created.push({
      molecule_id,
      section:   chunk.section,
      position:  chunk.position,
      kCv_q,
      kCv_components: { A: Math.round(A*100)/100, U: Math.round(U*100)/100, O: Math.round(O*100)/100, C: Math.round(C*100)/100 },
      word_count: chunk.content.split(/\s+/).length,
      preview:   chunk.content.substring(0, 120) + (chunk.content.length > 120 ? '…' : ''),
    });

    parentId = molecule_id;
  }

  return {
    success: true,
    source_name,
    molecules_created: created.length,
    molecules_skipped: chunks.length - created.length,
    hol_anchor: { author_id, author_domain_id, context_note },
    molecules: created.sort((a, b) => b.kCv_q - a.kCv_q),
    top_molecule: created.sort((a, b) => b.kCv_q - a.kCv_q)[0] ?? null,
    ingested_at: now(),
  };
}

// ─────────────────────────────────────────────
// ACTION: SEARCH MOLECULES
// Keyword + kCv-ranked. Tier 1 (informational) — no Binding evaluation.
// ─────────────────────────────────────────────

function tfidfScore(query: string, text: string, allTexts: string[]): number {
  const qTokens = tokenise(query);
  const tTokens = tokenise(text);
  const tSet    = new Set(tTokens);
  const N       = allTexts.length + 1;

  let score = 0;
  for (const qt of qTokens) {
    // TF: frequency in this text
    const tf = tTokens.filter(t => t === qt).length / Math.max(tTokens.length, 1);
    // IDF: how rare across corpus
    const df = allTexts.filter(t => tokenise(t).includes(qt)).length + 1;
    const idf = Math.log(N / df);
    score += tf * idf;
  }
  return score;
}

async function searchMolecules(payload: any, base44: any): Promise<any> {
  const {
    query,
    limit         = 10,
    min_kCv_q     = 0,
    source_filter = null,
    mode          = "informational", // informational | decision
  } = payload;

  if (!query || query.trim().length < 2) {
    return { success: false, error: "query required (min 2 characters)" };
  }

  const allMolecules = await base44.asServiceRole.entities.Molecule.list();
  const candidates   = allMolecules.filter((m: any) =>
    m.metadata?.lexical_content &&
    m.kCv_rank >= min_kCv_q &&
    (!source_filter || m.metadata?.source_name === source_filter)
  );

  if (candidates.length === 0) {
    return { success: true, query, results: [], total_searched: 0, message: "No molecules with lexical content found. Ingest a document first." };
  }

  const allTexts = candidates.map((m: any) => m.metadata.lexical_content);

  // Score each candidate: TF-IDF relevance × kCv_rank
  const scored = candidates.map((m: any) => {
    const relevance = tfidfScore(query, m.metadata.lexical_content, allTexts);
    const kCv_q     = m.kCv_rank ?? 0;
    // Combined rank: relevance carries 60%, knowledge value 40%
    const combined  = relevance * 0.6 + kCv_q * 0.4;
    return { m, relevance: Math.round(relevance * 1000) / 1000, kCv_q, combined };
  });

  const top = scored
    .filter(s => s.relevance > 0)
    .sort((a, b) => b.combined - a.combined)
    .slice(0, limit);

  // For decision mode: attach binding advisories (lightweight, non-blocking)
  let bindingAdvisories: Record<string, any[]> = {};
  if (mode === "decision") {
    const allBindings = await base44.asServiceRole.entities.JournalBinding.list();
    for (const { m } of top) {
      const active = allBindings.filter((b: any) =>
        b.binding_state === "ACTIVE" &&
        (b.molecule_id === m.molecule_id || (b.scope_ids ?? []).includes(m.molecule_id))
      );
      if (active.length > 0) {
        bindingAdvisories[m.molecule_id] = active.map((b: any) => ({
          binding_type: b.binding_type,
          alteration_class: b.alteration_class,
          advisory: `Active ${b.binding_type} binding. Governance tier required: ${b.challenge_minimum_tier ?? 'N/A'}.`,
        }));
      }
    }
  }

  return {
    success: true,
    query,
    mode,
    total_searched:    candidates.length,
    results_returned:  top.length,
    results: top.map(({ m, relevance, kCv_q, combined }) => ({
      molecule_id:   m.molecule_id,
      section:       m.metadata?.section,
      source_name:   m.metadata?.source_name,
      preview:       (m.metadata?.lexical_content ?? '').substring(0, 200) + '…',
      scores: {
        kCv_q,
        relevance_to_query: relevance,
        combined_rank:      Math.round(combined * 1000) / 1000,
        kCv_components: m.metadata?.kCv_snapshot ?? {},
      },
      state:         m.current_state,
      reuse_count:   m.reuse_count ?? 0,
      binding_advisories: bindingAdvisories[m.molecule_id] ?? [],
    })),
  };
}

// ─────────────────────────────────────────────
// ACTION: GET MOLECULE DETAIL
// Full record: content, scores, lineage, observation history
// ─────────────────────────────────────────────

async function getMoleculeDetail(payload: any, base44: any): Promise<any> {
  const { molecule_id } = payload;
  if (!molecule_id) return { success: false, error: "molecule_id required" };

  const [allM, allObs] = await Promise.all([
    base44.asServiceRole.entities.Molecule.list(),
    base44.asServiceRole.entities.JournalObservation.list(),
  ]);

  const m = allM.find((x: any) => x.molecule_id === molecule_id);
  if (!m) return { success: false, error: `Molecule ${molecule_id} not found` };

  const observations = allObs
    .filter((o: any) => o.molecule_id === molecule_id)
    .sort((a: any, b: any) => (a.journal_sequence ?? 0) - (b.journal_sequence ?? 0));

  // Lineage: parent and child molecules
  const parents  = allM.filter((x: any) => (m.parent_molecule_ids ?? []).includes(x.molecule_id));
  const children = allM.filter((x: any) => (x.parent_molecule_ids ?? []).includes(molecule_id));

  return {
    success: true,
    molecule_id,
    section:       m.metadata?.section,
    source_name:   m.metadata?.source_name,
    full_content:  m.metadata?.lexical_content,
    hol_anchor: {
      author_id:        m.vsid,
      author_domain_id: m.author_domain_id,
      context_note:     m.metadata?.context_note,
      ingested_at:      m.metadata?.ingested_at,
    },
    current_state:   m.current_state,
    kCv_q:           m.kCv_rank,
    kCv_components:  m.metadata?.kCv_snapshot ?? {},
    kCv_dimensions: {
      kCv_o:  m.kCv_o,   // originality
      kCv_u:  m.kCv_u,   // utility
      kCv_v:  m.kCv_v_score, // verification (0 at ingest)
      kCv_i:  m.kCv_i_score, // impact (0 at ingest)
      kCv_r:  m.kCv_r_score, // reuse (0 at ingest)
    },
    value_note: "kCv_v, kCv_i, kCv_r grow as molecule accumulates observations over time. They are 0 at ingest — this is correct.",
    reuse_count:    m.reuse_count ?? 0,
    lineage: {
      parents:  parents.map((p: any)  => ({ molecule_id: p.molecule_id, section: p.metadata?.section, kCv_q: p.kCv_rank })),
      children: children.map((c: any) => ({ molecule_id: c.molecule_id, section: c.metadata?.section, kCv_q: c.kCv_rank })),
    },
    observation_count: observations.length,
    observations: observations.map((o: any) => ({
      observation_type: o.observation_type,
      polarity:         o.polarity,
      actor_id:         o.actor_id,
      journal_sequence: o.journal_sequence,
    })),
  };
}

// ─────────────────────────────────────────────
// ACTION: RECORD REUSE
// When a molecule is cited or used in a decision — feeds kCv_r over time
// ─────────────────────────────────────────────

async function recordReuse(payload: any, base44: any): Promise<any> {
  const { molecule_id, actor_id = "unknown", actor_domain_id = "unknown", reuse_type = "citation", outcome_note = "" } = payload;
  if (!molecule_id) return { success: false, error: "molecule_id required" };

  const allM = await base44.asServiceRole.entities.Molecule.list();
  const m    = allM.find((x: any) => x.molecule_id === molecule_id);
  if (!m) return { success: false, error: `Molecule ${molecule_id} not found` };

  // Increment reuse count
  const new_reuse = (m.reuse_count ?? 0) + 1;
  // Simple kCv_r update: grows with reuse, damped
  const new_kCv_r = Math.min(1.0, Math.log(1 + new_reuse) / Math.log(20));

  if (m.id) {
    await base44.asServiceRole.entities.Molecule.update(m.id, {
      reuse_count: new_reuse,
      kCv_r_score: Math.round(new_kCv_r * 100) / 100,
      kCv_r_status: new_reuse >= 10 ? "WIDELY_ADOPTED" : new_reuse >= 3 ? "ADOPTED" : "EMERGING",
      kCv_rank: Math.round(
        (0.35 * (m.kCv_o ?? 0) + 0.25 * (m.kCv_u ?? 0) + 0.20 * new_kCv_r + 0.20 * (m.kCv_v_score ?? 0)) * 100
      ) / 100,
    });
  }

  // Write reuse observation
  const allObs  = await base44.asServiceRole.entities.JournalObservation.list();
  const lastSeq = Math.max(0, ...allObs.map((o: any) => o.journal_sequence ?? 0));
  const obs_id  = generateId("obs-reuse", molecule_id, actor_id, now());
  await base44.asServiceRole.entities.JournalObservation.create({
    observation_id:    obs_id,
    molecule_id,
    observation_type:  "reuse",
    polarity:          1,
    conflict_flag:     false,
    actor_id,
    actor_domain_id,
    actor_trust_score: 1.0,
    metadata:          { reuse_type, outcome_note, reuse_count: new_reuse },
    constitution_version: CONSTITUTION_VERSION,
    journal_sequence:  lastSeq + 1,
    observation_hash:  sha256(obs_id + molecule_id + now()),
    prior_entry_hash:  allObs.length > 0
      ? allObs[allObs.length - 1].observation_hash ?? "genesis"
      : "genesis",
  });

  return {
    success: true,
    molecule_id,
    reuse_count: new_reuse,
    kCv_r_score: Math.round(new_kCv_r * 100) / 100,
    kCv_rank_updated: Math.round(
      (0.35 * (m.kCv_o ?? 0) + 0.25 * (m.kCv_u ?? 0) + 0.20 * new_kCv_r + 0.20 * (m.kCv_v_score ?? 0)) * 100
    ) / 100,
    message: `Reuse recorded. kCv_r grows with adoption. Current status: ${new_reuse >= 10 ? "WIDELY_ADOPTED" : new_reuse >= 3 ? "ADOPTED" : "EMERGING"}.`,
  };
}

// ─────────────────────────────────────────────
// ACTION: GET CORPUS SUMMARY
// Overview of all ingested molecules and value distribution
// ─────────────────────────────────────────────

async function getCorpusSummary(payload: any, base44: any): Promise<any> {
  const allM = await base44.asServiceRole.entities.Molecule.list();
  const withContent = allM.filter((m: any) => m.metadata?.lexical_content);
  if (withContent.length === 0) return { success: true, message: "No molecules ingested yet.", total: 0 };

  const scores = withContent.map((m: any) => m.kCv_rank ?? 0);
  const avg    = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;

  const bySrc: Record<string, any[]> = {};
  for (const m of withContent) {
    const src = m.metadata?.source_name ?? "unknown";
    if (!bySrc[src]) bySrc[src] = [];
    bySrc[src].push(m);
  }

  const topMolecules = [...withContent]
    .sort((a: any, b: any) => (b.kCv_rank ?? 0) - (a.kCv_rank ?? 0))
    .slice(0, 5)
    .map((m: any) => ({
      molecule_id: m.molecule_id,
      section:     m.metadata?.section,
      source_name: m.metadata?.source_name,
      kCv_q:       m.kCv_rank,
      preview:     (m.metadata?.lexical_content ?? '').substring(0, 100) + '…',
    }));

  return {
    success: true,
    total_molecules: withContent.length,
    sources: Object.keys(bySrc).map(src => ({
      source_name:     src,
      molecule_count:  bySrc[src].length,
      avg_kCv_q:       Math.round(bySrc[src].reduce((a: number, m: any) => a + (m.kCv_rank ?? 0), 0) / bySrc[src].length * 100) / 100,
    })),
    corpus_avg_kCv_q:   Math.round(avg * 100) / 100,
    top_molecules:      topMolecules,
    kCv_distribution: {
      high:   withContent.filter((m: any) => (m.kCv_rank ?? 0) >= 0.7).length,
      medium: withContent.filter((m: any) => (m.kCv_rank ?? 0) >= 0.4 && (m.kCv_rank ?? 0) < 0.7).length,
      low:    withContent.filter((m: any) => (m.kCv_rank ?? 0) < 0.4).length,
    },
  };
}

// ─────────────────────────────────────────────
// HTTP HANDLER
// ─────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const body = await req.json();
    const { action, ...payload } = body;

    if (action === "ingest_document")    return Response.json(await ingestDocument(payload, base44));
    if (action === "search_molecules")   return Response.json(await searchMolecules(payload, base44));
    if (action === "get_molecule_detail") return Response.json(await getMoleculeDetail(payload, base44));
    if (action === "record_reuse")       return Response.json(await recordReuse(payload, base44));
    if (action === "get_corpus_summary") return Response.json(await getCorpusSummary(payload, base44));

    return Response.json({
      error: `Unknown action: ${action}`,
      valid_actions: ["ingest_document", "search_molecules", "get_molecule_detail", "record_reuse", "get_corpus_summary"],
    }, { status: 400 });

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
