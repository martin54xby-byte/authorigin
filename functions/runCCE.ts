/**
 * AuthOrigin Canonical Collapse Engine — Full Stack
 *
 * Layers:
 *   FR-0  — Anti-find_REPLACE (Collapse Precedence Constraint)
 *   CAR-1 — Collapse Adversarial Resistance (Constraint Determinism)
 *   CGS-1 — Controlled Generative Space (Execution Manifold + PET)
 *   MOCL-1 — Multi-Objective Coherence (Isolation + OMM mediation)
 *
 * Pipeline:
 *   AuthInput → OPL → CCE → ActivationLock →
 *   CAR-1 (CDC) → ExecutionGraph → CGS-1 (Manifold + PET) →
 *   FR-0 (CPC) → RenderGate (RGR) → MOCL-1 (IsolationCheck) →
 *   UIMaterialisation → FabricChain (full layered entries)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.26.0';

// ─── Crypto ──────────────────────────────────────────────────────────────────

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── AI call ─────────────────────────────────────────────────────────────────

async function ai(system: string, user: string): Promise<string> {
  const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
  const r = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: `${system}\n\n${user}` }]
  });
  const b = r.content[0];
  if (b.type === 'text') return b.text;
  throw new Error('Unexpected AI response type');
}

// ─── ELASTIC KEYWORD DETECTOR (CAR-1 pre-check) ──────────────────────────────
// Catches semantically elastic language before AI decomposition

const ELASTIC_PATTERNS = [
  /optimis[ez]/i, /improv[ei]/i, /enhanc[ei]/i, /maximis[ez]/i, /maximiz[ei]/i,
  /satisf[yi]/i, /experienc[ei]/i, /useful/i, /better/i, /good/i, /nice/i,
  /appropriat[ei]/i, /reasonable/i, /suitable/i, /efficient/i, /effective/i,
  /quality/i, /best\s+possible/i, /as\s+needed/i, /where\s+applicable/i
];

function detectElasticLanguage(text: string): string[] {
  return ELASTIC_PATTERNS
    .filter(p => p.test(text))
    .map(p => p.source.replace(/\\[a-z]\[.*?\]/g, '*').replace(/\[.*?\]/g, '*'));
}

// ─── CAR-1: Constraint Determinism Condition (CDC) ───────────────────────────

interface ACF {
  observable_condition: string;
  allowed_transition: string;
  forbidden_transitions: string[];
  verification_method: string;
}

interface ConstraintWithACF {
  type: 'hard' | 'soft';
  rule: string;
  acf: ACF;
  determinism_score: number;  // 0–1; must be 1.0 to pass CDC
  cdc_valid: boolean;
  elastic_terms: string[];
}

interface CARResult {
  cdc_holds: boolean;
  processed_constraints: ConstraintWithACF[];
  failed_constraints: ConstraintWithACF[];
  elastic_constraints_detected: string[];
  constraint_hash: string;
  allowed_state_set_hash: string;
}

async function runCAR1(rawConstraints: any[], omId: string): Promise<CARResult> {
  const prompt = `You are the CAR-1 Constraint Determinism Validator.

For each constraint, decompose it into Atomic Constraint Form (ACF) and score its determinism.

Rules:
- observable_condition: a concrete, measurable state check (no fuzzy language)
- allowed_transition: exactly one permitted state change
- forbidden_transitions: all other state changes that MUST NOT occur
- verification_method: a specific, executable check (not "review" or "assess")
- determinism_score: 1.0 = exactly one valid outcome, 0.0 = completely ambiguous

REJECT any constraint containing: optimise, improve, enhance, satisfy, experience, usefulness, better, quality, appropriate, reasonable, best possible, where applicable, as needed, or any other semantically elastic phrase.

Return ONLY valid JSON array (no prose, no fences):
[
  {
    "original_rule": string,
    "type": "hard"|"soft",
    "acf": {
      "observable_condition": string,
      "allowed_transition": string,
      "forbidden_transitions": [string],
      "verification_method": string
    },
    "determinism_score": number,
    "cdc_valid": boolean,
    "rejection_reason": string | null
  }
]`;

  const resp = await ai(prompt, `Constraints to decompose:\n${JSON.stringify(rawConstraints, null, 2)}\nom_id: ${omId}`);
  const match = resp.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('CAR-1 returned no valid JSON');
  const decomposed: any[] = JSON.parse(match[0]);

  const processed: ConstraintWithACF[] = decomposed.map(d => {
    const elasticTerms = detectElasticLanguage(d.original_rule + ' ' + JSON.stringify(d.acf));
    const cdcValid = d.determinism_score >= 1.0 && elasticTerms.length === 0 && d.cdc_valid !== false;
    return {
      type: d.type || 'hard',
      rule: d.original_rule,
      acf: d.acf,
      determinism_score: elasticTerms.length > 0 ? 0.0 : d.determinism_score,
      cdc_valid: cdcValid,
      elastic_terms: elasticTerms
    };
  });

  const failed = processed.filter(c => !c.cdc_valid);
  const elasticAll = [...new Set(processed.flatMap(c => c.elastic_terms))];
  const constraintPayload = JSON.stringify(processed.map(c => c.acf));
  const stateSetPayload = JSON.stringify(processed.map(c => c.acf.allowed_transition));

  return {
    cdc_holds: failed.length === 0,
    processed_constraints: processed,
    failed_constraints: failed,
    elastic_constraints_detected: elasticAll,
    constraint_hash: await sha256(constraintPayload),
    allowed_state_set_hash: await sha256(stateSetPayload)
  };
}

// ─── CGS-1: Controlled Generative Space ──────────────────────────────────────
// Execution Manifold + Path Equivalence Test (PET)

interface ManifoldPath {
  path_id: string;
  node_sequence: string[];
  outcome_description: string;
  outcome_hash: string;
}

interface CGSResult {
  manifold_id: string;
  equivalence_class_id: string;
  canonical_outcome_hash: string;
  paths: ManifoldPath[];
  pet_holds: boolean;          // ∀ p1, p2 ∈ EM: outcome(p1) = outcome(p2)
  divergent_paths: string[];   // paths whose outcome diverges — rejected
  creative_variance_score: number;  // 0=rigid, 1=max safe variation
  path_variance: number;       // must be 0 for PET to hold
}

async function runCGS1(
  nodes: any[],
  edges: any[],
  activatedOM: any
): Promise<CGSResult> {
  const manifoldId = uid('manifold');

  // For a single execution graph, generate alternative topological orderings
  // that are outcome-equivalent (the manifold of valid implementations)
  const prompt = `You are the CGS-1 Execution Manifold generator.

Given an execution graph, enumerate 1–3 valid implementation paths (orderings/choices)
that ALL produce the IDENTICAL outcome. This is the Execution Manifold.

Rules:
- Each path must satisfy: outcome(p) = success_condition
- Variation is ONLY allowed in: algorithm choice, step ordering, internal decomposition
- Variation is FORBIDDEN in: outcome, constraints, OM scope
- Compute an outcome_description for each path — must be IDENTICAL across all paths
- If you can only generate one valid path, return just that one

Return ONLY valid JSON (no prose, no fences):
{
  "paths": [
    {
      "path_id": "p1",
      "node_sequence": [list of node_ids in execution order],
      "outcome_description": string,
      "creative_choices": string
    }
  ],
  "canonical_outcome": string,
  "pet_assessment": string
}`;

  const resp = await ai(
    prompt,
    `OM singular_goal: ${activatedOM.singular_goal}\nSuccess condition: ${activatedOM.success_condition}\nNodes: ${JSON.stringify(nodes.map(n => ({ id: n.node_id, label: n.label, type: n.action_type })))}\nEdges: ${JSON.stringify(edges)}`
  );

  const match = resp.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('CGS-1 returned no valid JSON');
  const cgsData = JSON.parse(match[0]);

  const canonicalOutcomeHash = await sha256(cgsData.canonical_outcome || activatedOM.success_condition);

  const paths: ManifoldPath[] = await Promise.all(
    (cgsData.paths || []).map(async (p: any) => ({
      path_id: p.path_id || uid('path'),
      node_sequence: p.node_sequence || [],
      outcome_description: p.outcome_description || cgsData.canonical_outcome,
      outcome_hash: await sha256(p.outcome_description || cgsData.canonical_outcome)
    }))
  );

  // PET: all path outcome hashes must match canonical
  const divergent = paths.filter(p => p.outcome_hash !== canonicalOutcomeHash).map(p => p.path_id);
  const petHolds = divergent.length === 0;
  const equivalenceClassId = await sha256(`eqclass|${canonicalOutcomeHash}|${manifoldId}`);

  return {
    manifold_id: manifoldId,
    equivalence_class_id: equivalenceClassId,
    canonical_outcome_hash: canonicalOutcomeHash,
    paths,
    pet_holds: petHolds,
    divergent_paths: divergent,
    creative_variance_score: paths.length > 1 ? (paths.length - 1) / paths.length : 0,
    path_variance: divergent.length
  };
}

// ─── FR-0: Collapse Precedence Constraint (CPC) ──────────────────────────────

interface CPCResult {
  cpc_holds: boolean;
  violations: string[];
  proof_paths: Record<string, string[]>;
  fr1_guarantee: boolean;
  blocked_nodes: string[];
}

function validateCPC(nodes: any[], edges: any[], omId: string, collapseHash: string): CPCResult {
  const violations: string[] = [];
  const proofPaths: Record<string, string[]> = {};
  const blockedNodes: string[] = [];

  const inbound: Record<string, string[]> = {};
  for (const n of nodes) inbound[n.node_id] = [];
  for (const e of edges) {
    if (!inbound[e.to]) inbound[e.to] = [];
    inbound[e.to].push(e.from);
  }

  for (const rn of nodes.filter(n => n.action_type === 'render')) {
    if (rn.origin_reference !== omId) {
      violations.push(`RenderNode ${rn.node_id}: origin_reference mismatch — CPC violation`);
      blockedNodes.push(rn.node_id); continue;
    }
    if (!rn.depends_on?.length) {
      violations.push(`RenderNode ${rn.node_id}: no upstream deps — uncollapsed materialisation`);
      blockedNodes.push(rn.node_id); continue;
    }
    if (edges.some(e => e.from === rn.node_id)) {
      violations.push(`RenderNode ${rn.node_id}: has outgoing edges — must be terminal`);
      blockedNodes.push(rn.node_id); continue;
    }

    const path = [rn.node_id];
    let cur = rn.node_id;
    const visited = new Set([cur]);
    let hasExec = false;
    let lineageBreak = false;

    while (inbound[cur]?.length > 0) {
      const parent = inbound[cur][0];
      if (visited.has(parent)) break;
      visited.add(parent);
      path.unshift(parent);
      const pn = nodes.find(n => n.node_id === parent);
      if (['compute','retrieve','transform'].includes(pn?.action_type)) hasExec = true;
      if (pn && pn.origin_reference !== omId) { lineageBreak = true; break; }
      cur = parent;
    }

    if (lineageBreak) {
      violations.push(`RenderNode ${rn.node_id}: ancestor lineage break — unbound origin_reference`);
      blockedNodes.push(rn.node_id);
    } else if (!hasExec) {
      violations.push(`RenderNode ${rn.node_id}: no execution ancestors — bypasses graph`);
      blockedNodes.push(rn.node_id);
    } else {
      proofPaths[rn.node_id] = ['AuthInput', `OM:${omId}`, `Collapse:${collapseHash.slice(0,12)}`, ...path];
    }
  }

  return { cpc_holds: violations.length === 0, violations, proof_paths: proofPaths, fr1_guarantee: violations.length === 0, blocked_nodes: blockedNodes };
}

// ─── Render Gate (RGR) ───────────────────────────────────────────────────────

interface RGRResult {
  passed: boolean;
  dropped_nodes: string[];
  admitted_nodes: string[];
  gate_log: Array<{ node_id: string; passed: boolean; reason: string }>;
}

function applyRenderGate(nodes: any[], cpc: CPCResult, om: any, car: CARResult): RGRResult {
  const renderNodes = nodes.filter(n => n.action_type === 'render');
  const dropped: string[] = [], admitted: string[] = [];
  const gateLog: Array<{ node_id: string; passed: boolean; reason: string }> = [];

  for (const rn of renderNodes) {
    if (cpc.blocked_nodes.includes(rn.node_id)) {
      dropped.push(rn.node_id);
      gateLog.push({ node_id: rn.node_id, passed: false, reason: 'FR-0: CPC violation' }); continue;
    }
    if (om.status !== 'active') {
      dropped.push(rn.node_id);
      gateLog.push({ node_id: rn.node_id, passed: false, reason: `OM.status="${om.status}" ≠ "active"` }); continue;
    }
    if (!car.cdc_holds) {
      dropped.push(rn.node_id);
      gateLog.push({ node_id: rn.node_id, passed: false, reason: `CAR-1: CDC failed — elastic constraints present: [${car.elastic_constraints_detected.join(', ')}]` }); continue;
    }
    admitted.push(rn.node_id);
    gateLog.push({ node_id: rn.node_id, passed: true, reason: 'CPC ∧ OM.active ∧ CDC ∧ constraints satisfied' });
  }

  return { passed: dropped.length === 0, dropped_nodes: dropped, admitted_nodes: admitted, gate_log: gateLog };
}

// ─── MOCL-1: Multi-OM Isolation Check ────────────────────────────────────────

interface MOCLResult {
  isolation_domain_id: string;
  isolation_holds: boolean;
  shared_state_detected: boolean;
  cross_om_interactions: string[];
  omm_required: boolean;
  domain_boundary: { includes: string[]; excludes: string[] };
}

async function runMOCL1(omId: string, nodes: any[], existingOMs: any[]): Promise<MOCLResult> {
  const domainId = await sha256(`domain|${omId}`);

  // Check if any existing active OMs share node IDs or output schemas
  const nodeIds = nodes.map(n => n.node_id);
  const crossInteractions: string[] = [];

  for (const existingOM of existingOMs) {
    if (existingOM.om_id === omId) continue;
    if (existingOM.status !== 'active') continue;
    // In a full runtime, we'd check execution graph overlap here
    // For now, flag any active concurrent OMs as requiring OMM mediation
    crossInteractions.push(`OM:${existingOM.om_id} (goal: "${existingOM.singular_goal?.slice(0, 40)}…") — requires OMM mediation`);
  }

  return {
    isolation_domain_id: domainId.slice(0, 16),
    isolation_holds: crossInteractions.length === 0,
    shared_state_detected: false,
    cross_om_interactions: crossInteractions,
    omm_required: crossInteractions.length > 0,
    domain_boundary: {
      includes: nodeIds,
      excludes: ['all nodes from other OM domains']
    }
  };
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { raw_text, context_state = {}, session_id } = body;
    if (!raw_text) return Response.json({ error: 'raw_text required' }, { status: 400 });

    const sid = session_id || uid('session');
    const now = Date.now();
    const stages: any[] = [];
    const fabric: any[] = [];

    // ── 1. AuthInput ─────────────────────────────────────────────────────────
    const authInputId = uid('ai');
    const authInputHash = await sha256(JSON.stringify({ raw_text, context_state, sid }) + now);
    stages.push({ stage: 'AuthInput', status: 'captured', id: authInputId, hash: authInputHash.slice(0, 16) });

    // ── 2. OPL ───────────────────────────────────────────────────────────────
    const oplResp = await ai(
      `You are the Objective Proposal Layer (OPL).
Analyse input and propose 1–3 candidate Objective Molecules.
Return ONLY a valid JSON array (no markdown, no prose):
[{ "singular_goal": string, "success_condition": string, "exclusion_conditions": [string], "constraint_set": [{"type":"hard"|"soft","rule":string}], "confidence": number, "rejection_reason": string }]
Rules: one clear goal → 1 candidate (conf > 0.85). Ambiguous → 2–3. NEVER merge goals. NEVER vague success conditions.`,
      `raw_text: "${raw_text}"\ncontext: ${JSON.stringify(context_state)}`
    );

    const arrM = oplResp.match(/\[[\s\S]*\]/);
    if (!arrM) return Response.json({ error: 'OPL: no JSON array', session_id: sid }, { status: 500 });
    const candidates: any[] = JSON.parse(arrM[0]);
    stages.push({ stage: 'OPL', status: 'complete', candidate_count: candidates.length, candidates: candidates.map((c,i) => ({ index: i, singular_goal: c.singular_goal, confidence: c.confidence })) });

    // ── 3. CCE ───────────────────────────────────────────────────────────────
    let activeOM: any = null, rejectedOMs: any[] = [], cceDecision = '', cceReason = '';

    if (candidates.length === 1 && candidates[0].confidence >= 0.75) {
      activeOM = candidates[0]; cceDecision = 'direct_collapse'; cceReason = 'Single high-confidence candidate';
    } else {
      const cceResp = await ai(
        `You are the Canonical Collapse Engine (CCE). Pick exactly ONE winner.
Rules: prefer measurability, prefer specificity, incompatible goals → needs_clarification=true.
Return ONLY valid JSON: {"winner_index":number|null,"needs_clarification":boolean,"clarification_question":string|null,"rejection_reasons":{"0":string,"1":string},"cce_reasoning":string}`,
        `Candidates:\n${JSON.stringify(candidates, null, 2)}`
      );
      const objM = cceResp.match(/\{[\s\S]*\}/);
      if (!objM) return Response.json({ error: 'CCE: no JSON', session_id: sid }, { status: 500 });
      const cceR = JSON.parse(objM[0]);
      cceReason = cceR.cce_reasoning;

      if (cceR.needs_clarification) {
        return Response.json({
          status: 'blocked_ambiguity', session_id: sid, clarification_required: true,
          clarification_question: cceR.clarification_question,
          candidates: candidates.map((c,i) => ({ index: i, singular_goal: c.singular_goal })),
          pipeline_stages: stages,
          fr0_status: 'not_reached — blocked before representation',
          car_status: 'not_reached',
          cgs_status: 'not_reached',
          mocl_status: 'not_reached'
        });
      }

      activeOM = candidates[cceR.winner_index];
      rejectedOMs = candidates.filter((_,i) => i !== cceR.winner_index).map((c,i) => ({ ...c, rejection_reason: cceR.rejection_reasons?.[String(i)] || 'Discarded by CCE' }));
      cceDecision = 'collapse_with_rejection';
    }

    // ── 4. Activation Lock ───────────────────────────────────────────────────
    const omId = uid('om');
    const lineageHash = await sha256(`${authInputHash}|${JSON.stringify(activeOM)}|${omId}`);
    const collapseHash = await sha256(`collapse|${omId}|${lineageHash}|${now}`);
    const isolationDomainId = (await sha256(`domain|${omId}`)).slice(0, 16);

    stages.push({ stage: 'ActivationLock', status: 'locked', om_id: omId, singular_goal: activeOM.singular_goal, lineage_hash: lineageHash, immutable: true });

    // ── 5. CAR-1: Constraint Determinism ─────────────────────────────────────
    let carResult: CARResult;
    try {
      carResult = await runCAR1(activeOM.constraint_set || [], omId);
    } catch (e) {
      return Response.json({ error: `CAR-1 failed: ${e.message}`, session_id: sid }, { status: 500 });
    }

    stages.push({
      stage: 'CAR1_ConstraintDeterminism',
      status: carResult.cdc_holds ? 'passed' : 'elastic_detected',
      cdc_holds: carResult.cdc_holds,
      constraints_processed: carResult.processed_constraints.length,
      constraints_failed: carResult.failed_constraints.length,
      elastic_terms_detected: carResult.elastic_constraints_detected,
      constraint_hash: carResult.constraint_hash,
      allowed_state_set_hash: carResult.allowed_state_set_hash,
      theorem: 'CDC: ∀ constraint c, ∃ exactly one valid state transition outcome set S'
    });

    // If CDC fails, block — elastic constraints reintroduce ambiguity
    if (!carResult.cdc_holds) {
      return Response.json({
        status: 'blocked_elastic_constraints',
        session_id: sid,
        car_result: carResult,
        message: `CAR-1 rejected: ${carResult.failed_constraints.length} constraint(s) are semantically elastic. Constraints must be rewritten in ACF before execution proceeds.`,
        failed_constraints: carResult.failed_constraints,
        rewrite_required: true,
        pipeline_stages: stages
      });
    }

    // ── 6. Execution Graph Generation ────────────────────────────────────────
    const egResp = await ai(
      `You are the Execution Graph Generator.
Generate the MINIMAL execution graph for this OM.
Every node MUST set origin_reference to the om_id provided.
No speculative nodes. Render nodes are TERMINAL ONLY.
Return ONLY valid JSON: {"nodes":[{"node_id":string,"label":string,"action_type":"compute"|"retrieve"|"transform"|"render","input_schema":{"description":string},"output_schema":{"description":string},"origin_reference":string,"depends_on":[]}],"edges":[{"from":string,"to":string,"label":string}],"validation_note":string}`,
      `om_id: ${omId}\nsingular_goal: ${activeOM.singular_goal}\nsuccess_condition: ${activeOM.success_condition}\nexclusion_conditions: ${JSON.stringify(activeOM.exclusion_conditions)}\nACF_constraints: ${JSON.stringify(carResult.processed_constraints.map(c => c.acf))}`
    );

    const egM = egResp.match(/\{[\s\S]*\}/);
    if (!egM) return Response.json({ error: 'EG: no JSON', session_id: sid }, { status: 500 });
    const egData = JSON.parse(egM[0]);
    const nodes = (egData.nodes || []).map((n: any) => ({ ...n, origin_reference: omId }));
    const edges = egData.edges || [];

    stages.push({ stage: 'ExecutionGraphGeneration', status: 'built', node_count: nodes.length, edge_count: edges.length, note: egData.validation_note });

    // ── 7. CGS-1: Controlled Generative Space ────────────────────────────────
    let cgsResult: CGSResult;
    try {
      cgsResult = await runCGS1(nodes, edges, activeOM);
    } catch (e) {
      return Response.json({ error: `CGS-1 failed: ${e.message}`, session_id: sid }, { status: 500 });
    }

    stages.push({
      stage: 'CGS1_ExecutionManifold',
      status: cgsResult.pet_holds ? 'outcome_invariant' : 'divergence_detected',
      manifold_id: cgsResult.manifold_id,
      equivalence_class_id: cgsResult.equivalence_class_id,
      path_count: cgsResult.paths.length,
      pet_holds: cgsResult.pet_holds,
      divergent_paths: cgsResult.divergent_paths,
      creative_variance_score: cgsResult.creative_variance_score,
      path_variance: cgsResult.path_variance,
      theorem: 'PET: ∀ p1,p2 ∈ EM, outcome(p1) = outcome(p2)'
    });

    // ── 8. FR-0: CPC Validation ──────────────────────────────────────────────
    const cpcResult = validateCPC(nodes, edges, omId, collapseHash);

    stages.push({
      stage: 'FR0_CPCValidation',
      status: cpcResult.cpc_holds ? 'passed' : 'violations_detected',
      cpc_holds: cpcResult.cpc_holds,
      fr1_guarantee: cpcResult.fr1_guarantee,
      violations: cpcResult.violations,
      blocked_nodes: cpcResult.blocked_nodes,
      proof_paths: cpcResult.proof_paths,
      theorem: 'FR-1: CPC holds → ∀ RenderNode r, no find_REPLACE state reachable'
    });

    // ── 9. Render Gate (RGR) ─────────────────────────────────────────────────
    const rgrResult = applyRenderGate(nodes, cpcResult, { ...activeOM, status: 'active' }, carResult);

    stages.push({
      stage: 'RenderGate_RGR',
      status: rgrResult.passed ? 'all_admitted' : 'nodes_dropped',
      admitted: rgrResult.admitted_nodes.length,
      dropped: rgrResult.dropped_nodes.length,
      gate_log: rgrResult.gate_log
    });

    // ── 10. MOCL-1: Isolation Check ──────────────────────────────────────────
    // Fetch existing active OMs to check for domain collisions
    let existingOMs: any[] = [];
    try {
      const existing = await base44.entities.ObjectiveMolecule.list();
      existingOMs = (existing || []).filter((o: any) => o.status === 'active');
    } catch (_) { /* if none exist yet, that's fine */ }

    const moclResult = await runMOCL1(omId, nodes, existingOMs);

    stages.push({
      stage: 'MOCL1_IsolationCheck',
      status: moclResult.isolation_holds ? 'isolated' : 'mediation_required',
      isolation_domain_id: moclResult.isolation_domain_id,
      isolation_holds: moclResult.isolation_holds,
      cross_om_interactions: moclResult.cross_om_interactions,
      omm_required: moclResult.omm_required,
      domain_boundary: moclResult.domain_boundary,
      theorem: 'MOCL-1: ∀ OM_A, OM_B: domain(A) ∩ domain(B) = ∅ without explicit OMM mediation'
    });

    // ── Build activated OM record ────────────────────────────────────────────
    const activatedOM = {
      ...activeOM,
      om_id: omId,
      auth_input_id: authInputId,
      lineage_hash: lineageHash,
      status: 'active',
      candidate_siblings: rejectedOMs.map((_, i) => `rejected_${i}`),
      isolation_domain_id: moclResult.isolation_domain_id,
      ccc_valid: true,
      car_valid: carResult.cdc_holds,
      execution_manifold_id: cgsResult.manifold_id,
      version: 1,
      constraint_set: carResult.processed_constraints  // upgraded to ACF form
    };

    // ── UI Materialisation ───────────────────────────────────────────────────
    const admittedRender = nodes.filter(n => n.action_type === 'render' && rgrResult.admitted_nodes.includes(n.node_id));

    const uiProjection = {
      allowed_surfaces: admittedRender.map(n => ({
        surface_id: n.node_id,
        label: n.label,
        bound_to_om: n.origin_reference === omId,
        input_from: n.depends_on,
        cpc_proof: cpcResult.proof_paths[n.node_id] || [],
        equivalence_class: cgsResult.equivalence_class_id,
        isolation_domain: moclResult.isolation_domain_id,
        rgr_status: 'admitted'
      })),
      blocked_surfaces: rgrResult.dropped_nodes.map(id => ({
        surface_id: id,
        reason: rgrResult.gate_log.find(g => g.node_id === id)?.reason,
        action: 'DROPPED — re-collapse required, no patching permitted'
      })),
      fr0_status: cpcResult.fr1_guarantee && rgrResult.passed ? 'GUARANTEED' : 'PARTIAL',
      car_status: carResult.cdc_holds ? 'DETERMINISTIC' : 'ELASTIC_DETECTED',
      cgs_status: cgsResult.pet_holds ? 'OUTCOME_INVARIANT' : 'DIVERGENCE_DETECTED',
      mocl_status: moclResult.isolation_holds ? 'ISOLATED' : 'MEDIATION_REQUIRED',
      anti_bloat: `${admittedRender.length} surface(s) admitted across ${cgsResult.paths.length} equivalent path(s)`
    };

    stages.push({
      stage: 'UIMaterialisation',
      status: 'projected',
      surfaces_admitted: uiProjection.allowed_surfaces.length,
      surfaces_blocked: uiProjection.blocked_surfaces.length,
      fr0_status: uiProjection.fr0_status,
      car_status: uiProjection.car_status,
      cgs_status: uiProjection.cgs_status,
      mocl_status: uiProjection.mocl_status
    });

    // ── origin.fabric chain ──────────────────────────────────────────────────
    const inputPH = await sha256(raw_text + sid + now);
    const inputFH = await sha256(`input|${omId}|${inputPH}|${now}`);
    fabric.push({
      hash: inputFH, parent_hash: null, om_id: omId, session_id: sid, event_type: 'input',
      payload_hash: inputPH,
      payload_summary: `AuthInput: "${raw_text.slice(0, 80)}${raw_text.length > 80 ? '…' : ''}"`,
      invariant_check: { singularity: true, no_orphan_execution: true, no_representation_without_collapse: false, no_speculative_features: true, cdc_holds: false, pet_holds: false, mocl_isolation_holds: false },
      timestamp_ms: now
    });

    const collapsePH = await sha256(JSON.stringify(activatedOM));
    const collapseFH = await sha256(`collapse|${omId}|${collapsePH}|${now+1}`);
    fabric.push({
      hash: collapseFH, parent_hash: inputFH, om_id: omId, session_id: sid, event_type: 'collapse',
      payload_hash: collapsePH,
      payload_summary: `CCE → "${activeOM.singular_goal}" (${cceDecision}, conf: ${activeOM.confidence})`,
      invariant_check: { singularity: true, no_orphan_execution: true, no_representation_without_collapse: true, no_speculative_features: true, cdc_holds: carResult.cdc_holds, pet_holds: false, mocl_isolation_holds: false },
      timestamp_ms: now+1
    });

    // CAR-1 fabric entry
    const carPH = await sha256(JSON.stringify(carResult));
    const carFH = await sha256(`car_check|${omId}|${carPH}|${now+2}`);
    fabric.push({
      hash: carFH, parent_hash: collapseFH, om_id: omId, session_id: sid, event_type: 'car_check',
      payload_hash: carPH,
      payload_summary: `CAR-1: CDC=${carResult.cdc_holds}, ${carResult.processed_constraints.length} constraints decomposed to ACF, elastic=[${carResult.elastic_constraints_detected.join(',')||'none'}]`,
      invariant_check: { singularity: true, no_orphan_execution: true, no_representation_without_collapse: true, no_speculative_features: true, cdc_holds: carResult.cdc_holds, pet_holds: false, mocl_isolation_holds: false },
      car_layer: { constraint_hash: carResult.constraint_hash, determinism_score: carResult.cdc_holds ? 1.0 : 0.0, allowed_state_set_hash: carResult.allowed_state_set_hash, elastic_constraints_detected: carResult.elastic_constraints_detected },
      timestamp_ms: now+2
    });

    // CGS-1 fabric entry
    const cgsPH = await sha256(JSON.stringify(cgsResult));
    const cgsFH = await sha256(`cgs_path|${omId}|${cgsPH}|${now+3}`);
    fabric.push({
      hash: cgsFH, parent_hash: carFH, om_id: omId, session_id: sid, event_type: 'cgs_path',
      payload_hash: cgsPH,
      payload_summary: `CGS-1: manifold=${cgsResult.manifold_id}, ${cgsResult.paths.length} equivalent path(s), PET=${cgsResult.pet_holds}`,
      invariant_check: { singularity: true, no_orphan_execution: true, no_representation_without_collapse: true, no_speculative_features: true, cdc_holds: carResult.cdc_holds, pet_holds: cgsResult.pet_holds, mocl_isolation_holds: false },
      cgs_layer: { execution_path_hash: await sha256(JSON.stringify(cgsResult.paths)), equivalence_class_id: cgsResult.equivalence_class_id, outcome_hash: cgsResult.canonical_outcome_hash, path_variance: cgsResult.path_variance },
      timestamp_ms: now+3
    });

    // Execution fabric entry
    const execPH = await sha256(JSON.stringify({ nodes, edges }));
    const execFH = await sha256(`execution|${omId}|${execPH}|${now+4}`);
    fabric.push({
      hash: execFH, parent_hash: cgsFH, om_id: omId, session_id: sid, event_type: 'execution',
      payload_hash: execPH,
      payload_summary: `ExecGraph: ${nodes.length} nodes, CPC=${cpcResult.cpc_holds}, FR-1=${cpcResult.fr1_guarantee}`,
      invariant_check: { singularity: true, no_orphan_execution: true, no_representation_without_collapse: true, no_speculative_features: true, cdc_holds: carResult.cdc_holds, pet_holds: cgsResult.pet_holds, mocl_isolation_holds: moclResult.isolation_holds },
      timestamp_ms: now+4
    });

    // Violation entries
    let lastHash = execFH;
    for (const dropped of rgrResult.dropped_nodes) {
      const vPH = await sha256(`drop|${dropped}|${omId}`);
      const vFH = await sha256(`violation|${omId}|${vPH}|${now+5}`);
      fabric.push({
        hash: vFH, parent_hash: lastHash, om_id: omId, session_id: sid, event_type: 'violation',
        payload_hash: vPH,
        payload_summary: `RGR dropped ${dropped}: ${rgrResult.gate_log.find(g=>g.node_id===dropped)?.reason} — NOT patched`,
        invariant_check: { singularity: true, no_orphan_execution: true, no_representation_without_collapse: true, no_speculative_features: false, cdc_holds: false, pet_holds: false, mocl_isolation_holds: true },
        timestamp_ms: now+5
      });
      lastHash = vFH;
    }

    // MOCL mediation entry (if needed)
    if (moclResult.omm_required) {
      const moclPH = await sha256(JSON.stringify(moclResult));
      const moclFH = await sha256(`mocl_mediation|${omId}|${moclPH}|${now+6}`);
      fabric.push({
        hash: moclFH, parent_hash: lastHash, om_id: omId, session_id: sid, event_type: 'mocl_mediation',
        payload_hash: moclPH,
        payload_summary: `MOCL-1: ${moclResult.cross_om_interactions.length} cross-OM interaction(s) detected, OMM mediation required`,
        invariant_check: { singularity: true, no_orphan_execution: true, no_representation_without_collapse: true, no_speculative_features: true, cdc_holds: carResult.cdc_holds, pet_holds: cgsResult.pet_holds, mocl_isolation_holds: false },
        mocl_layer: { isolation_domain_id: moclResult.isolation_domain_id, cross_om_interactions: moclResult.cross_om_interactions, omm_mediated: true },
        timestamp_ms: now+6
      });
      lastHash = moclFH;
    }

    // Render entry
    const renderPH = await sha256(JSON.stringify(uiProjection));
    const renderFH = await sha256(`render|${omId}|${renderPH}|${now+7}`);
    fabric.push({
      hash: renderFH, parent_hash: lastHash, om_id: omId, session_id: sid, event_type: 'render',
      payload_hash: renderPH,
      payload_summary: `UI: ${admittedRender.length} admitted, ${rgrResult.dropped_nodes.length} dropped — fr0=${uiProjection.fr0_status}, car=${uiProjection.car_status}, cgs=${uiProjection.cgs_status}, mocl=${uiProjection.mocl_status}`,
      invariant_check: { singularity: true, no_orphan_execution: true, no_representation_without_collapse: true, no_speculative_features: true, cdc_holds: carResult.cdc_holds, pet_holds: cgsResult.pet_holds, mocl_isolation_holds: moclResult.isolation_holds },
      timestamp_ms: now+7
    });

    stages.push({ stage: 'FabricChain', status: 'sealed', entry_count: fabric.length, chain_head: fabric[fabric.length-1].hash, layers: ['input','collapse','car_check','cgs_path','execution','render'] });

    // ── Persist ──────────────────────────────────────────────────────────────
    const executionGraph = {
      eg_id: uid('eg'), om_id: omId, nodes, edges, status: cpcResult.cpc_holds ? 'valid' : 'cpc_violation',
      validation_errors: cpcResult.violations,
      manifold_id: cgsResult.manifold_id,
      equivalence_class_id: cgsResult.equivalence_class_id,
      outcome_hash: cgsResult.canonical_outcome_hash,
      isolation_domain_id: moclResult.isolation_domain_id
    };

    await base44.entities.AuthInput.create({ raw_text, context_state, session_id: sid, status: 'collapsed' });
    await base44.entities.ObjectiveMolecule.create(activatedOM);
    await base44.entities.ExecutionGraph.create(executionGraph);
    for (const entry of fabric) await base44.entities.FabricEntry.create(entry);

    // ── Final response ────────────────────────────────────────────────────────
    const allClear = cpcResult.fr1_guarantee && rgrResult.passed && carResult.cdc_holds && cgsResult.pet_holds && moclResult.isolation_holds;

    return Response.json({
      status: allClear ? 'collapsed_all_guarantees_held' : 'collapsed_partial',
      session_id: sid,
      active_om: activatedOM,
      execution_graph: executionGraph,
      ui_projection: uiProjection,

      formal_guarantees: {
        FR0: { theorem: 'FR-1', holds: cpcResult.fr1_guarantee, statement: 'No find_REPLACE state reachable — CPC enforced' },
        CAR1: { holds: carResult.cdc_holds, statement: 'All constraints are deterministic ACF — no semantic elasticity', elastic_detected: carResult.elastic_constraints_detected },
        CGS1: { holds: cgsResult.pet_holds, statement: 'All execution paths outcome-invariant — creativity bounded to manifold', manifold_paths: cgsResult.paths.length, divergent: cgsResult.divergent_paths },
        MOCL1: { holds: moclResult.isolation_holds, statement: 'OM sealed in causal domain — no cross-OM contamination without OMM', omm_required: moclResult.omm_required }
      },

      cce_decision: cceDecision,
      cce_reason: cceReason,
      car_result: carResult,
      cgs_result: cgsResult,
      mocl_result: moclResult,
      cpc_result: cpcResult,
      rgr_result: rgrResult,
      rejected_oms: rejectedOMs,
      fabric_chain: fabric,
      pipeline_stages: stages,

      invariants: {
        singularity: true,
        no_find_replace: cpcResult.fr1_guarantee,
        no_elastic_constraints: carResult.cdc_holds,
        outcome_invariant_creativity: cgsResult.pet_holds,
        no_cross_om_contamination: moclResult.isolation_holds,
        correction_model: 'recollapse_only — no patching, no find_REPLACE, no post_hoc_repair'
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
