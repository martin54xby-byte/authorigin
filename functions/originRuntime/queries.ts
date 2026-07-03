// Query/read-side actions — parity with the frozen documentIngestion.ts reference
// implementation, adapted to top-level fields (lexical_content, section, source_name)
// rather than the legacy metadata.* nesting. These are not pipeline stages — they're
// service-layer reads/aggregates over already-registered molecules.

function tokenise(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3);
}

function tfidfScore(query: string, text: string, allTexts: string[]): number {
  const qTokens = tokenise(query);
  const tTokens = tokenise(text);
  const N = allTexts.length + 1;
  let score = 0;
  for (const qt of qTokens) {
    const tf = tTokens.filter((t) => t === qt).length / Math.max(tTokens.length, 1);
    const df = allTexts.filter((t) => tokenise(t).includes(qt)).length + 1;
    const idf = Math.log(N / df);
    score += tf * idf;
  }
  return score;
}

export async function searchMolecules(payload: any, base44: any) {
  const { query, limit = 10, min_kCv_q = 0, source_filter = null } = payload;
  if (!query || query.trim().length < 2) return { success: false, error: "query required (min 2 characters)" };

  const allMolecules = await base44.asServiceRole.entities.Molecule.list();
  const candidates = allMolecules.filter((m: any) =>
    m.lexical_content && m.molecule_type !== "container" &&
    (m.kCv_rank ?? 0) >= min_kCv_q &&
    (!source_filter || m.source_name === source_filter)
  );
  if (candidates.length === 0) return { success: true, query, results: [], total_searched: 0, message: "No molecules with lexical content found." };

  const allTexts = candidates.map((m: any) => m.lexical_content);
  const scored = candidates.map((m: any) => {
    const relevance = tfidfScore(query, m.lexical_content, allTexts);
    const kCv_q = m.kCv_rank ?? 0;
    const combined = relevance * 0.6 + kCv_q * 0.4;
    return { m, relevance: Math.round(relevance * 1000) / 1000, kCv_q, combined };
  });
  const top = scored.filter((s) => s.relevance > 0).sort((a, b) => b.combined - a.combined).slice(0, limit);

  return {
    success: true, query, total_searched: candidates.length, results_returned: top.length,
    results: top.map(({ m, relevance, kCv_q, combined }) => ({
      molecule_id: m.molecule_id, molecule_type: m.molecule_type, section: m.section, source_name: m.source_name,
      preview: (m.lexical_content ?? "").substring(0, 200) + "…",
      scores: { kCv_q, relevance_to_query: relevance, combined_rank: Math.round(combined * 1000) / 1000, kCv_o: m.kCv_o, kCv_u: m.kCv_u },
      state: m.current_state, reuse_count: m.reuse_count ?? 0, runtime_id: m.runtime_id,
    })),
  };
}

export async function getMoleculeDetail(payload: any, base44: any) {
  const { molecule_id } = payload;
  if (!molecule_id) return { success: false, error: "molecule_id required" };
  const [allM, allObs] = await Promise.all([
    base44.asServiceRole.entities.Molecule.list(),
    base44.asServiceRole.entities.JournalObservation.list(),
  ]);
  const m = allM.find((x: any) => x.molecule_id === molecule_id);
  if (!m) return { success: false, error: `Molecule ${molecule_id} not found` };

  const observations = allObs.filter((o: any) => o.molecule_id === molecule_id)
    .sort((a: any, b: any) => (a.journal_sequence ?? 0) - (b.journal_sequence ?? 0));
  const parents = allM.filter((x: any) => (m.parent_molecule_ids ?? []).includes(x.molecule_id));
  const children = allM.filter((x: any) => (x.parent_molecule_ids ?? []).includes(molecule_id));

  return {
    success: true, molecule_id, molecule_type: m.molecule_type, section: m.section, source_name: m.source_name,
    full_content: m.lexical_content,
    hol_anchor: { author_id: m.vsid, author_domain_id: m.author_domain_id, hol_context: m.hol_context },
    current_state: m.current_state, kCv_q: m.kCv_rank,
    kCv_dimensions: { kCv_o: m.kCv_o, kCv_u: m.kCv_u, kCv_v: m.kCv_v_score, kCv_i: m.kCv_i_score, kCv_r: m.kCv_r_score },
    value_note: "kCv_v, kCv_i, kCv_r grow as the molecule accumulates observations over time. They are 0 at ingest — this is correct.",
    reuse_count: m.reuse_count ?? 0,
    lineage: {
      parents: parents.map((p: any) => ({ molecule_id: p.molecule_id, section: p.section, kCv_q: p.kCv_rank })),
      children: children.map((c: any) => ({ molecule_id: c.molecule_id, section: c.section, kCv_q: c.kCv_rank })),
    },
    runtime_id: m.runtime_id,
    observation_count: observations.length,
    observations: observations.map((o: any) => ({ observation_type: o.observation_type, stage_name: o.stage_name, polarity: o.polarity, actor_id: o.actor_id, journal_sequence: o.journal_sequence })),
  };
}

export async function recordReuse(payload: any, base44: any) {
  const { molecule_id, actor_id = "unknown", actor_domain_id = "unknown", reuse_type = "citation" } = payload;
  if (!molecule_id) return { success: false, error: "molecule_id required" };
  const allM = await base44.asServiceRole.entities.Molecule.list();
  const m = allM.find((x: any) => x.molecule_id === molecule_id);
  if (!m) return { success: false, error: `Molecule ${molecule_id} not found` };

  const new_reuse = (m.reuse_count ?? 0) + 1;
  const new_kCv_r = Math.min(1.0, Math.log(1 + new_reuse) / Math.log(20));
  const new_kCv_rank = Math.round((0.35 * (m.kCv_o ?? 0) + 0.25 * (m.kCv_u ?? 0) + 0.2 * new_kCv_r + 0.2 * (m.kCv_v_score ?? 0)) * 100) / 100;

  if (m.id) {
    await base44.asServiceRole.entities.Molecule.update(m.id, {
      reuse_count: new_reuse,
      kCv_r_score: Math.round(new_kCv_r * 100) / 100,
      kCv_r_status: new_reuse >= 10 ? "WIDELY_ADOPTED" : new_reuse >= 3 ? "ADOPTED" : "EMERGING",
      kCv_rank: new_kCv_rank,
    });
  }

  const allObs = await base44.asServiceRole.entities.JournalObservation.list();
  const ls = Math.max(0, ...allObs.map((o: any) => o.journal_sequence ?? 0));
  return { success: true, molecule_id, reuse_count: new_reuse, kCv_r_score: Math.round(new_kCv_r * 100) / 100, kCv_rank_updated: new_kCv_rank, _journal_sequence_hint: ls + 1 };
}

export async function getCorpusSummary(payload: any, base44: any) {
  const allM = await base44.asServiceRole.entities.Molecule.list();
  const withContent = allM.filter((m: any) => m.lexical_content && m.molecule_type !== "container");
  if (withContent.length === 0) return { success: true, message: "No molecules ingested yet.", total: 0 };

  const scores = withContent.map((m: any) => m.kCv_rank ?? 0);
  const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;

  const bySrc: Record<string, any[]> = {};
  for (const m of withContent) { const src = m.source_name ?? "unknown"; (bySrc[src] ||= []).push(m); }

  const topMolecules = [...withContent].sort((a: any, b: any) => (b.kCv_rank ?? 0) - (a.kCv_rank ?? 0)).slice(0, 5)
    .map((m: any) => ({ molecule_id: m.molecule_id, molecule_type: m.molecule_type, section: m.section, source_name: m.source_name, kCv_q: m.kCv_rank, preview: (m.lexical_content ?? "").substring(0, 100) + "…" }));

  return {
    success: true, total_molecules: withContent.length,
    sources: Object.keys(bySrc).map((src) => ({ source_name: src, molecule_count: bySrc[src].length, avg_kCv_q: Math.round(bySrc[src].reduce((a: number, m: any) => a + (m.kCv_rank ?? 0), 0) / bySrc[src].length * 100) / 100 })),
    corpus_avg_kCv_q: Math.round(avg * 100) / 100,
    top_molecules: topMolecules,
    kCv_distribution: {
      high: withContent.filter((m: any) => (m.kCv_rank ?? 0) >= 0.7).length,
      medium: withContent.filter((m: any) => (m.kCv_rank ?? 0) >= 0.4 && (m.kCv_rank ?? 0) < 0.7).length,
      low: withContent.filter((m: any) => (m.kCv_rank ?? 0) < 0.4).length,
    },
  };
}
