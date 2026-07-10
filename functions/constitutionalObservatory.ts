import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "corpus_health";

    // ─── READ-ONLY CORPUS FETCH ───────────────────────────────────────────────
    async function fetchAllMolecules() {
      const all: any[] = [];
      let skip = 0;
      while (true) {
        const result = await base44.asServiceRole.entities.Molecule.list({
          limit: 500,
          skip,
        });
        const records: any[] = Array.isArray(result) ? result : (result?.data ?? []);
        if (records.length === 0) break;
        all.push(...records);
        if (records.length < 500) break;
        skip += 500;
      }
      return all;
    }

    // ─── FIELD ACCESSORS (handle flat or nested .data) ────────────────────────
    const f = (m: any, key: string): any => m?.[key] ?? m?.data?.[key] ?? null;

    // ─── INVARIANT CHECKS ─────────────────────────────────────────────────────

    function checkFC1(m: any) {
      const type = f(m, "molecule_type") ?? "";
      if (["container", "edge"].includes(type)) return null;
      const content: string = f(m, "lexical_content") ?? "";
      const words = content.trim().split(/\s+/).filter(Boolean);
      const id = f(m, "molecule_id") ?? m.id;
      if (words.length < 8) {
        return { molecule_id: id, molecule_type: type,
          violated_invariant: "FC-1 Independence",
          evidence: `${words.length} words — insufficient for independent meaning`,
          confidence: 0.9,
          recommended_action: "Decompose or reject — not a standalone meaning unit" };
      }
      if (/^(It|They|This|These|Those|He|She)\b/i.test(content.trim())) {
        return { molecule_id: id, molecule_type: type,
          violated_invariant: "FC-1 Independence",
          evidence: "Starts with unresolved pronoun — context-dependent",
          confidence: 0.8,
          recommended_action: "Expand to include antecedent, or merge with parent" };
      }
      return null;
    }

    function checkFC2(m: any) {
      const type = f(m, "molecule_type") ?? "";
      if (["container", "edge"].includes(type)) return null;
      const source = f(m, "source_name");
      const author = f(m, "author_domain_id");
      const id = f(m, "molecule_id") ?? m.id;
      if (!source || source === "Unknown" || source === "") {
        return { molecule_id: id, molecule_type: type,
          violated_invariant: "FC-2 / RF-5 Provenance",
          evidence: "source_name absent or 'Unknown'",
          confidence: 1.0,
          recommended_action: "Declare source_name — molecule lacks evidential boundary" };
      }
      if (!author || author === "") {
        return { molecule_id: id, molecule_type: type,
          violated_invariant: "FC-2 / RF-5 Provenance",
          evidence: "author_domain_id absent",
          confidence: 1.0,
          recommended_action: "Declare author_domain_id — authorship provenance incomplete" };
      }
      return null;
    }

    function checkRF6(m: any) {
      const type = f(m, "molecule_type") ?? "";
      if (["container", "edge", "definition"].includes(type)) return null;
      const content: string = f(m, "lexical_content") ?? "";
      const id = f(m, "molecule_id") ?? m.id;
      const sentences = content.split(/(?<=[.!?])\s+/).filter((s: string) => s.trim().length > 20);
      if (sentences.length < 3) return null;
      const hasConstraint = /\b(only|valid only|must not|shall not|provided that|except when|unless|limited to|applies only)\b/i.test(content);
      const hasMethod    = /\b(step \d|1\.|2\.|first[,:]|then[,:]|in order to|calculated using|applied at)\b/i.test(content);
      const hasCitation  = /\b(see figure|per [A-Z]+|according to [A-Z]+|CIBSE|ASHRAE|BS EN|Part L|ISO \d)\b/i.test(content);
      const hasAssertion = /\b(is|are|was|were|has|have|provides|covers|includes)\b/i.test(content);
      const signals = [hasConstraint, hasMethod, hasCitation, hasAssertion].filter(Boolean).length;
      if (signals >= 3) {
        return { molecule_id: id, molecule_type: type,
          violated_invariant: "RF-6 Compound Molecule",
          evidence: `${sentences.length} sentences, ${signals} type signals (constraint:${hasConstraint} method:${hasMethod} citation:${hasCitation} assertion:${hasAssertion})`,
          confidence: 0.75,
          recommended_action: "Decompose into typed sub-molecules before admission" };
      }
      return null;
    }

    function checkConstraintMisclassification(m: any) {
      const type = f(m, "molecule_type") ?? "";
      if (type !== "constraint") return null;
      const content = (f(m, "lexical_content") ?? "").toLowerCase();
      const id = f(m, "molecule_id") ?? m.id;
      const hasCondition   = /\b(only|when |if |for |valid|must not|shall not|provided|except|unless|limited to|applies)\b/.test(content);
      const isDescription  = /\b(provides guidance|covers|describes|is a guide|gives guidance|sets out|explains)\b/.test(content);
      if (!hasCondition || isDescription) {
        return { molecule_id: id, molecule_type: type,
          violated_invariant: "CON-1/CON-3 Constraint Misclassification",
          evidence: isDescription
            ? "Contains description language ('provides guidance' etc.) — scope description, not a restriction"
            : "No condition marker (only/when/if/valid/must not) — describes rather than constrains",
          confidence: 0.8,
          recommended_action: "Reclassify: scope descriptions → definition or container" };
      }
      return null;
    }

    function checkClaimFalsifiability(m: any) {
      const type = f(m, "molecule_type") ?? "";
      if (type !== "claim") return null;
      const content: string = f(m, "lexical_content") ?? "";
      const id = f(m, "molecule_id") ?? m.id;
      const vague = /\b(is important|will transform|are key|plays a role|is critical|is essential|are significant|will change)\b/i.test(content);
      const specific = /\b(\d+[\s%]|under condition|benchmark|test case|measured|reduced by|increased by)\b/i.test(content);
      if (vague && !specific) {
        return { molecule_id: id, molecule_type: type,
          violated_invariant: "CM-4 Falsifiability",
          evidence: "Vague normative language without measurable condition or specific subject",
          confidence: 0.7,
          recommended_action: "Add falsifiable condition or reclassify as observation" };
      }
      return null;
    }

    function checkKcvStaleness(m: any) {
      const type = f(m, "molecule_type") ?? "";
      if (["container", "edge"].includes(type)) return null;
      const state: string = f(m, "current_state") ?? "";
      const lateStates = ["VERIFIED_STRONG", "VERIFIED_WEAK", "MATERIALISED", "REINFORCED"];
      if (!lateStates.includes(state)) return null;
      const kCv_v = parseFloat(f(m, "kCv_v_score") ?? "0");
      const kCv_i = parseFloat(f(m, "kCv_i_score") ?? "0");
      const kCv_r = parseFloat(f(m, "kCv_r_score") ?? "0");
      const v_quality = f(m, "kCv_v_quality") ?? "UNVERIFIED";
      const i_status  = f(m, "kCv_i_status")  ?? "UNOBSERVED";
      const r_status  = f(m, "kCv_r_status")  ?? "NEW";
      if (kCv_v === 0 && kCv_i === 0 && kCv_r === 0
          && v_quality === "UNVERIFIED" && i_status === "UNOBSERVED" && r_status === "NEW") {
        return { molecule_id: f(m, "molecule_id") ?? m.id, molecule_type: type,
          violated_invariant: "I-4 kCv Derivability — stale cache",
          evidence: `State='${state}' but kCv_v/kCv_i/kCv_r all at formation defaults`,
          confidence: 0.95,
          recommended_action: "Trigger kCv derivation from journal — cache stale vs constitutional state" };
      }
      return null;
    }

    // ─── ACTIONS ──────────────────────────────────────────────────────────────

    if (action === "corpus_health") {
      const molecules = await fetchAllMolecules();
      const byType: Record<string, number> = {};
      const byState: Record<string, number> = {};
      for (const m of molecules) {
        const t = f(m, "molecule_type") ?? "unknown";
        const s = f(m, "current_state") ?? "unknown";
        byType[t] = (byType[t] ?? 0) + 1;
        byState[s] = (byState[s] ?? 0) + 1;
      }
      const allFindings: any[] = [];
      const withFindings = new Set<string>();
      const checkers = [checkFC1, checkFC2, checkRF6, checkConstraintMisclassification, checkClaimFalsifiability, checkKcvStaleness];
      for (const m of molecules) {
        for (const check of checkers) {
          const finding = check(m);
          if (finding) { allFindings.push(finding); withFindings.add(finding.molecule_id); }
        }
      }
      const byInvariant: Record<string, number> = {};
      const byAction: Record<string, number> = {};
      for (const f2 of allFindings) {
        byInvariant[f2.violated_invariant] = (byInvariant[f2.violated_invariant] ?? 0) + 1;
        byAction[f2.recommended_action]   = (byAction[f2.recommended_action]   ?? 0) + 1;
      }
      const healthScore = molecules.length === 0 ? 100
        : Math.round(100 * (1 - withFindings.size / molecules.length));
      return Response.json({
        generated_at: new Date().toISOString(),
        corpus_snapshot: { total_molecules: molecules.length, by_type: byType, by_state: byState },
        findings: allFindings,
        summary: { total_findings: allFindings.length, by_invariant: byInvariant,
          by_recommended_action: byAction, health_score: healthScore },
      });
    }

    if (action === "rf6_scan") {
      const molecules = await fetchAllMolecules();
      const findings = molecules.map(checkRF6).filter(Boolean);
      return Response.json({ findings, count: findings.length });
    }

    if (action === "type_distribution") {
      const molecules = await fetchAllMolecules();
      const dist: Record<string, number> = {};
      for (const m of molecules) {
        const t = f(m, "molecule_type") ?? "unknown";
        dist[t] = (dist[t] ?? 0) + 1;
      }
      return Response.json({ total: molecules.length, by_type: dist });
    }

    if (action === "provenance_gaps") {
      const molecules = await fetchAllMolecules();
      const findings = molecules.map(checkFC2).filter(Boolean);
      return Response.json({ findings, count: findings.length });
    }

    if (action === "kcv_completeness") {
      const molecules = await fetchAllMolecules();
      const findings = molecules.map(checkKcvStaleness).filter(Boolean);
      return Response.json({ findings, count: findings.length });
    }

    return Response.json({
      error: `Unknown action '${action}'. Valid: corpus_health | rf6_scan | type_distribution | provenance_gaps | kcv_completeness`
    }, { status: 400 });

  } catch (err: any) {
    return Response.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
});
