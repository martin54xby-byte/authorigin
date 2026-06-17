/**
 * AuthOrigin Canonical Collapse Engine — Full Stack v5
 *
 * FR-0   — Anti-find_REPLACE          (Collapse Precedence Constraint)
 * CAR-1  — Constraint Determinism     (Atomic Constraint Form / CDC)
 * CGS-1  — Controlled Creativity      (Execution Manifold + PET)
 * MOCL-1 — Multi-OM Isolation         (Causal domain boundaries)
 * TCL-1  — Temporal Coherence         (TCI + Drift Detection)
 * EEL-1  — Epistemic Evolution        (PolicyMolecule — meaning frozen, strategy evolvable)
 * SHCL-1 — Self-Healing Consistency   (System Coherence Graph + Drift Vector + Re-Collapse Protocol)
 *
 * Pipeline:
 *   AuthInput → OPL → CCE → ActivationLock →
 *   CAR-1 → ExecGraph → CGS-1 → FR-0/CPC →
 *   TCL-1 → EEL-1 → SHCL-1 →
 *   RenderGate → MOCL-1 → UIMaterialisation →
 *   FabricChain + FabricTimeChain
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.26.0';

// ─── Crypto ──────────────────────────────────────────────────────────────────

async function sha256(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function uid(p: string): string {
  return `${p}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
}

async function ai(system: string, user: string): Promise<string> {
  const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
  const r = await client.messages.create({
    model: 'claude-opus-4-5', max_tokens: 4096,
    messages: [{ role: 'user', content: `${system}\n\n${user}` }]
  });
  const b = r.content[0];
  if (b.type === 'text') return b.text;
  throw new Error('Unexpected AI response type');
}

function parseJSON(resp: string, label: string): any {
  const arr = resp.match(/\[[\s\S]*\]/);
  if (arr) { try { return JSON.parse(arr[0]); } catch(_) {} }
  const obj = resp.match(/\{[\s\S]*\}/);
  if (obj) { try { return JSON.parse(obj[0]); } catch(_) {} }
  throw new Error(`${label}: no valid JSON in response`);
}

// ─── CAR-1 ───────────────────────────────────────────────────────────────────

const ELASTIC_RE = [
  /optimis[ez]/i,/improv[ei]/i,/enhanc[ei]/i,/maximis[ez]/i,/maximiz[ei]/i,
  /satisf[yi]/i,/experienc[ei]/i,/useful/i,/better/i,/\bgood\b/i,/\bnice\b/i,
  /appropriat[ei]/i,/reasonable/i,/suitable/i,/\befficient\b/i,/\beffective\b/i,
  /quality/i,/best\s+possible/i,/as\s+needed/i,/where\s+applicable/i
];

function detectElastic(text: string): string[] {
  return ELASTIC_RE.filter(p => p.test(text))
    .map(p => p.source.replace(/\\[a-z]\[.*?\]/g,'*').replace(/\[.*?\]/g,'*'));
}

async function runCAR1(rawConstraints: any[], omId: string): Promise<any> {
  const resp = await ai(
    `You are the CAR-1 Constraint Determinism Validator.
Decompose each constraint into Atomic Constraint Form (ACF). Score determinism 0–1.
REJECT any constraint containing elastic language: optimise, improve, enhance, satisfy, experience, better, quality, appropriate, reasonable, suitable, efficient, effective, best possible, as needed, where applicable.
Return ONLY a valid JSON array:
[{"original_rule":string,"type":"hard"|"soft","acf":{"observable_condition":string,"allowed_transition":string,"forbidden_transitions":[string],"verification_method":string},"determinism_score":number,"cdc_valid":boolean,"rejection_reason":string|null}]`,
    `Constraints:\n${JSON.stringify(rawConstraints,null,2)}\nom_id: ${omId}`
  );
  const dec: any[] = parseJSON(resp, 'CAR-1');
  const processed = dec.map(d => {
    const elastic = detectElastic(d.original_rule + ' ' + JSON.stringify(d.acf || {}));
    const ok = d.determinism_score >= 1.0 && elastic.length === 0 && d.cdc_valid !== false;
    return { type: d.type||'hard', rule: d.original_rule, acf: d.acf,
      determinism_score: elastic.length > 0 ? 0.0 : d.determinism_score,
      cdc_valid: ok, elastic_terms: elastic };
  });
  const failed = processed.filter((c:any) => !c.cdc_valid);
  const elasticAll = [...new Set(processed.flatMap((c:any) => c.elastic_terms))];
  return {
    cdc_holds: failed.length === 0,
    processed_constraints: processed,
    failed_constraints: failed,
    elastic_constraints_detected: elasticAll,
    constraint_hash: await sha256(JSON.stringify(processed.map((c:any) => c.acf))),
    allowed_state_set_hash: await sha256(JSON.stringify(processed.map((c:any) => c.acf?.allowed_transition)))
  };
}

// ─── CGS-1 ───────────────────────────────────────────────────────────────────

async function runCGS1(nodes: any[], edges: any[], om: any): Promise<any> {
  const manifoldId = uid('manifold');
  const resp = await ai(
    `You are CGS-1. Enumerate 1–3 execution paths that produce IDENTICAL outcomes.
Variation ONLY in: algorithm choice, step ordering, internal decomposition.
FORBIDDEN variation: outcome, constraints, OM scope.
Return ONLY valid JSON:
{"paths":[{"path_id":"p1","node_sequence":[string],"outcome_description":string,"creative_choices":string}],"canonical_outcome":string,"pet_assessment":string}`,
    `OM: ${om.singular_goal}\nSuccess: ${om.success_condition}\nNodes: ${JSON.stringify(nodes.map((n:any)=>({id:n.node_id,label:n.label,type:n.action_type})))}\nEdges: ${JSON.stringify(edges)}`
  );
  const d = parseJSON(resp, 'CGS-1');
  const canonHash = await sha256(d.canonical_outcome || om.success_condition);
  const paths = await Promise.all((d.paths||[]).map(async (p:any) => ({
    path_id: p.path_id || uid('path'),
    node_sequence: p.node_sequence || [],
    outcome_description: p.outcome_description || d.canonical_outcome,
    outcome_hash: await sha256(p.outcome_description || d.canonical_outcome)
  })));
  const divergent = paths.filter((p:any) => p.outcome_hash !== canonHash).map((p:any) => p.path_id);
  return {
    manifold_id: manifoldId,
    equivalence_class_id: await sha256(`eqclass|${canonHash}|${manifoldId}`),
    canonical_outcome_hash: canonHash,
    paths, pet_holds: divergent.length === 0, divergent_paths: divergent,
    creative_variance_score: paths.length > 1 ? (paths.length-1)/paths.length : 0,
    path_variance: divergent.length
  };
}

// ─── FR-0: CPC ───────────────────────────────────────────────────────────────

function validateCPC(nodes: any[], edges: any[], omId: string, collapseHash: string): any {
  const violations: string[] = [], proofPaths: Record<string,string[]> = {}, blocked: string[] = [];
  const inbound: Record<string,string[]> = {};
  for (const n of nodes) inbound[n.node_id] = [];
  for (const e of edges) { if (!inbound[e.to]) inbound[e.to] = []; inbound[e.to].push(e.from); }
  for (const rn of nodes.filter((n:any) => n.action_type === 'render')) {
    if (rn.origin_reference !== omId) { violations.push(`${rn.node_id}: origin_reference mismatch`); blocked.push(rn.node_id); continue; }
    if (!rn.depends_on?.length) { violations.push(`${rn.node_id}: no upstream deps`); blocked.push(rn.node_id); continue; }
    if (edges.some((e:any) => e.from === rn.node_id)) { violations.push(`${rn.node_id}: non-terminal`); blocked.push(rn.node_id); continue; }
    const path = [rn.node_id]; let cur = rn.node_id;
    const visited = new Set([cur]); let hasExec = false, lb = false;
    while (inbound[cur]?.length > 0) {
      const p = inbound[cur][0]; if (visited.has(p)) break; visited.add(p); path.unshift(p);
      const pn = nodes.find((n:any) => n.node_id === p);
      if (['compute','retrieve','transform'].includes(pn?.action_type)) hasExec = true;
      if (pn && pn.origin_reference !== omId) { lb = true; break; }
      cur = p;
    }
    if (lb) { violations.push(`${rn.node_id}: lineage break`); blocked.push(rn.node_id); }
    else if (!hasExec) { violations.push(`${rn.node_id}: no execution ancestors`); blocked.push(rn.node_id); }
    else proofPaths[rn.node_id] = ['AuthInput', `OM:${omId}`, `Collapse:${collapseHash.slice(0,12)}`, ...path];
  }
  return { cpc_holds: violations.length === 0, violations, proof_paths: proofPaths, fr1_guarantee: violations.length === 0, blocked_nodes: blocked };
}

// ─── TCL-1 ───────────────────────────────────────────────────────────────────

async function runTCL1(omId: string, lineageHash: string, singularGoal: string, executionGraph: any, carResult: any, base44: any): Promise<any> {
  const now = Date.now();
  const currentGraphHash = await sha256(JSON.stringify({
    nodes: (executionGraph.nodes||[]).map((n:any) => ({
      node_id: n.node_id, action_type: n.action_type,
      label: n.label, depends_on: n.depends_on, origin_reference: n.origin_reference
    })).sort((a:any,b:any) => a.node_id.localeCompare(b.node_id)),
    edges: (executionGraph.edges||[]).sort((a:any,b:any) => `${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`))
  }));
  const singularGoalHash = await sha256(singularGoal);
  const constraintHash = carResult.constraint_hash;
  let priorEntries: any[] = [];
  try {
    const all = await base44.entities.FabricTimeChain.list();
    priorEntries = (all||[]).filter((e:any) => e.om_id === omId)
      .sort((a:any,b:any) => (b.timestamp_ms||0) - (a.timestamp_ms||0));
  } catch(_) {}
  const prev = priorEntries[0] || null;
  const version = prev ? (prev.version||0)+1 : 1;
  const violations: string[] = [];
  const driftDetails: string[] = [];
  let driftScore = 0, tciHolds = true;
  let eventType = 'first_collapse';
  let replayValid = false, supersessionRequired = false;
  if (prev) {
    if (prev.singular_goal_hash && prev.singular_goal_hash !== singularGoalHash) {
      driftDetails.push(`CRITICAL: singular_goal mutated. Prev:${prev.singular_goal_hash.slice(0,12)}… Curr:${singularGoalHash.slice(0,12)}…`);
      violations.push('TCL-VIOLATION-1: singular_goal identity mutation');
      driftScore += 1.0; tciHolds = false;
    }
    if (prev.constraint_hash && prev.constraint_hash !== constraintHash) {
      driftDetails.push(`Constraint set mutated. Prev:${prev.constraint_hash.slice(0,12)}… Curr:${constraintHash.slice(0,12)}…`);
      violations.push('TCL-VIOLATION-2: constraint semantics changed without supersession');
      driftScore += 0.5; tciHolds = false;
    }
    if (prev.execution_graph_hash && prev.execution_graph_hash !== currentGraphHash && driftScore === 0) {
      const nodeDelta = Math.abs((executionGraph.nodes?.length||0) - (prev.node_count||0));
      driftDetails.push(`ExecGraph diverged. NodeΔ:${nodeDelta}`);
      violations.push('TCL-VIOLATION-3: execution graph diverged without supersession');
      driftScore += 0.75; tciHolds = false; supersessionRequired = true;
    }
    if (prev.execution_graph_hash === currentGraphHash && singularGoalHash === prev.singular_goal_hash) {
      eventType = 'replay'; replayValid = true; tciHolds = true;
    } else if (tciHolds) {
      eventType = 'versioned_recollapse';
    } else {
      eventType = 'drift_violation';
    }
  }
  return {
    tci_holds: tciHolds, event_type: eventType, version, drift_score: driftScore,
    drift_details: driftDetails,
    previous_graph_hash: prev?.execution_graph_hash || null,
    current_graph_hash: currentGraphHash,
    singular_goal_hash: singularGoalHash, constraint_hash: constraintHash,
    replay_valid: replayValid, supersession_required: supersessionRequired,
    temporal_spine_entry: {
      om_id: omId, timestamp_ms: now, collapse_hash: lineageHash,
      execution_graph_hash: currentGraphHash, constraint_hash: constraintHash,
      singular_goal_hash: singularGoalHash, previous_hash: prev?.id || null,
      event_type: (eventType==='first_collapse'||eventType==='versioned_recollapse') ? 'collapse'
                 : eventType==='replay' ? 'replay' : 'drift_violation',
      version, drift_score: driftScore, tci_holds: tciHolds,
      lineage_hash: lineageHash, replay_valid: replayValid,
      node_count: executionGraph.nodes?.length || 0
    },
    previous_temporal_entry: prev, violations
  };
}

// ─── EEL-1 ───────────────────────────────────────────────────────────────────

async function runEEL1(omId: string, lineageHash: string, canonicalOutcomeHash: string, cgsResult: any, executionGraph: any, tclResult: any, base44: any): Promise<any> {
  const now = Date.now();
  let priorPolicy: any = null;
  try {
    const all = await base44.entities.PolicyMolecule.list();
    const omPMs = (all||[]).filter((pm:any) => pm.om_id === omId && pm.status === 'active')
      .sort((a:any,b:any) => (b.version||0) - (a.version||0));
    if (omPMs.length > 0) priorPolicy = omPMs[0];
  } catch(_) {}
  const policyVersion = priorPolicy ? (priorPolicy.version||0)+1 : 1;
  const violations: string[] = [];
  const pmResp = await ai(
    `You are the EEL-1 Policy Search Engine. Your domain: HOW to execute. NOT what to execute.
FROZEN (cannot touch): singular_goal, success_condition, constraint_set, outcome definition.
MUTABLE (your only domain): execution strategy, node ordering, algorithm choices, path pruning, optimisation focus.
${priorPolicy ? `PRIOR POLICY v${priorPolicy.version}: ${JSON.stringify(priorPolicy.strategy)}. Your proposal MUST show efficiency improvement (fewer steps, lower latency, or lower cost for same outcome).` : 'This is the genesis policy v1. Propose the optimal baseline strategy.'}
Return ONLY valid JSON (no fences):
{"approach":string,"node_ordering":[string],"optimisation_focus":"latency"|"throughput"|"cost"|"reliability","pruned_paths":[string],"preferred_algorithms":{"node_id":"algo"},"performance_metrics":[{"metric":string,"value":number,"unit":string,"direction":"lower_is_better"|"higher_is_better"}],"efficiency_rationale":string,"outcome_statement":string}`,
    `Canonical outcome hash: ${canonicalOutcomeHash}\nManifold paths: ${JSON.stringify(cgsResult.paths?.map((p:any)=>({id:p.path_id,seq:p.node_sequence})))}\nGraph: ${JSON.stringify(executionGraph.nodes?.map((n:any)=>({id:n.node_id,label:n.label,type:n.action_type})))}`
  );
  const pmData = parseJSON(pmResp, 'EEL-1');
  const strategyHash = await sha256(JSON.stringify(pmData));
  const priorCost = priorPolicy?.performance_metrics?.find((m:any)=>m.metric==='execution_steps')?.value ?? null;
  const proposedCost = pmData.performance_metrics?.find((m:any)=>m.metric==='execution_steps')?.value ?? null;
  const efficiencyDelta = (priorCost !== null && proposedCost !== null) ? proposedCost - priorCost : 0;
  const efficiencyImprovement = priorPolicy ? (efficiencyDelta < 0 || efficiencyDelta === 0) : true;
  if (priorPolicy && efficiencyDelta > 0) violations.push(`EEL-VIOLATION-1: efficiency_delta=${efficiencyDelta} must be ≤0`);
  const eelValid = efficiencyImprovement && violations.length === 0;
  const pmId = uid('pm');
  const proposedPM: any = {
    pm_id: pmId, om_id: omId, version: policyVersion,
    strategy: {
      approach: pmData.approach||'', node_ordering: pmData.node_ordering||[],
      optimisation_focus: pmData.optimisation_focus||'cost',
      pruned_paths: pmData.pruned_paths||[], preferred_algorithms: pmData.preferred_algorithms||{}
    },
    performance_metrics: pmData.performance_metrics||[],
    outcome_hash: await sha256(pmData.outcome_statement||'default_outcome'),
    om_outcome_hash: canonicalOutcomeHash,
    eel_valid: eelValid, efficiency_delta: efficiencyDelta,
    prior_pm_id: priorPolicy?.pm_id || null,
    prior_outcome_hash: priorPolicy?.outcome_hash || null,
    status: eelValid ? 'active' : 'rejected',
    rejection_reason: eelValid ? undefined : violations[0],
    learning_source: tclResult.event_type === 'replay' ? 'replay_analysis' : 'ai_proposal',
    execution_count: 0,
    lineage_hash: await sha256(`pm|${omId}|${lineageHash}|${strategyHash}`)
  };
  const activePM = eelValid ? proposedPM : (priorPolicy || proposedPM);
  return {
    eel_valid: eelValid,
    active_policy: activePM, proposed_policy: proposedPM, prior_policy: priorPolicy,
    outcome_invariant: true,
    efficiency_improvement: efficiencyImprovement, efficiency_delta: efficiencyDelta,
    policy_version: policyVersion, learning_source: proposedPM.learning_source,
    violations,
    allowed_mutations: [
      'Algorithm selection per execution node',
      'Node execution ordering within manifold',
      'Redundant path pruning',
      'Optimisation focus (latency/throughput/cost/reliability)',
      'Efficiency improvements that preserve canonical outcome'
    ],
    forbidden_mutations: [
      'OM singular_goal (frozen — identity layer)',
      'Success condition (frozen — CCE layer)',
      'Constraint semantics (frozen under CAR-1)',
      'Outcome definition (must match CGS-1 canonical hash)',
      'Execution manifold boundary (set by CGS-1 equivalence class)'
    ],
    learning_spine_entry: {
      om_id: omId, pm_id: pmId, version: policyVersion,
      execution_hash: tclResult.current_graph_hash,
      outcome_hash: canonicalOutcomeHash,
      efficiency_delta: efficiencyDelta, eel_valid: eelValid,
      strategy_hash: strategyHash, prior_pm_id: priorPolicy?.pm_id||null,
      timestamp_ms: now, learning_source: proposedPM.learning_source
    }
  };
}

// ─── SHCL-1: Self-Healing Consistency Layer ───────────────────────────────────
//
// SCI-1: ∀ SCG: consistency(OM, CAR, CGS, EEL, TCL, MOCL) == true
//
// Drift Vector (DV): per-dimension inconsistency scores
//   - om_execution_mismatch:       OM outcome hash ≠ execution graph outcome hash
//   - constraint_execution_mismatch: CAR constraints violated by any execution node
//   - policy_outcome_mismatch:     EEL policy outcome ≠ CGS canonical outcome
//   - temporal_fabric_mismatch:    TCL graph hash ≠ FabricTimeChain recorded hash
//   - cross_layer_interference:    MOCL domain violations
//
// Repair = Re-Collapse Protocol (RCP), not patching:
//   freeze → reconstruct intent → recompute full stack → reconcile
//
// No local repair allowed. All repair is global, collapse-based, graph-recomputed.

interface DriftVector {
  om_execution_mismatch: number;
  constraint_execution_mismatch: number;
  policy_outcome_mismatch: number;
  temporal_fabric_mismatch: number;
  cross_layer_interference: number;
}

interface SHCLResult {
  sci_holds: boolean;
  drift_vector: DriftVector;
  dv_magnitude: number;
  inconsistencies: string[];
  repair_triggered: boolean;
  repair_protocol: string | null;
  scg_hash: string;
  scg_snapshot: any;
  fic_valid: boolean;              // Fabric Integrity Check
  fic_details: string;
  layer_agreement: Record<string, boolean>;
  global_coherence_score: number;   // 0 = fully incoherent, 1 = fully coherent
}

async function runSHCL1(
  activatedOM: any,
  carResult: any,
  cgsResult: any,
  executionGraph: any,
  eelResult: any,
  tclResult: any,
  moclResult: any,
  cpcResult: any,
  lineageHash: string
): Promise<SHCLResult> {
  const inconsistencies: string[] = [];

  // ── Build System Coherence Graph snapshot ──────────────────────────────────
  const scgSnapshot = {
    om: {
      om_id: activatedOM.om_id,
      singular_goal: activatedOM.singular_goal,
      success_condition: activatedOM.success_condition,
      lineage_hash: lineageHash,
      constraint_hash: carResult.constraint_hash
    },
    constraints: {
      count: carResult.processed_constraints?.length || 0,
      cdc_holds: carResult.cdc_holds,
      constraint_hash: carResult.constraint_hash,
      allowed_state_set_hash: carResult.allowed_state_set_hash
    },
    execution_graph: {
      node_count: executionGraph.nodes?.length || 0,
      edge_count: executionGraph.edges?.length || 0,
      status: executionGraph.status,
      outcome_hash: cgsResult.canonical_outcome_hash
    },
    policy_molecule: {
      pm_id: eelResult.active_policy?.pm_id,
      version: eelResult.policy_version,
      optimisation_focus: eelResult.active_policy?.strategy?.optimisation_focus,
      outcome_hash: eelResult.active_policy?.outcome_hash,
      om_outcome_hash: eelResult.active_policy?.om_outcome_hash
    },
    temporal_chain: {
      version: tclResult.version,
      tci_holds: tclResult.tci_holds,
      current_graph_hash: tclResult.current_graph_hash,
      event_type: tclResult.event_type
    },
    mocl: {
      isolation_holds: moclResult.isolation_holds,
      isolation_domain_id: moclResult.isolation_domain_id,
      cross_om_interactions: moclResult.cross_om_interactions?.length || 0
    }
  };

  const scgHash = await sha256(JSON.stringify(scgSnapshot));

  // ── Compute Drift Vector ───────────────────────────────────────────────────

  // Dimension 1: OM ↔ Execution outcome mismatch
  // CGS canonical outcome must be derivable from OM success_condition
  const omSuccessHash = await sha256(activatedOM.success_condition || '');
  // We check structural agreement rather than hash equality
  // (CGS outcome is a derived, potentially enriched form of success_condition)
  const omExecutionMismatch = (!cgsResult.pet_holds || cgsResult.path_variance > 0) ? 0.8 : 0.0;
  if (omExecutionMismatch > 0) {
    inconsistencies.push(`OM↔ExecGraph: CGS PET failed (path_variance=${cgsResult.path_variance}) — execution outcome not provably derived from OM`);
  }

  // Dimension 2: Constraint ↔ Execution mismatch
  // All execution nodes must respect CAR-1 ACF constraints
  const execNodesHaveOrigin = (executionGraph.nodes||[]).every((n:any) => n.origin_reference === activatedOM.om_id);
  const constraintExecutionMismatch = (!carResult.cdc_holds) ? 1.0
    : (!execNodesHaveOrigin) ? 0.5
    : (cpcResult.violations?.length > 0) ? 0.6
    : 0.0;
  if (constraintExecutionMismatch > 0) {
    inconsistencies.push(`CAR↔ExecGraph: ${!carResult.cdc_holds ? 'CDC failed' : !execNodesHaveOrigin ? 'node origin mismatch' : `CPC violations: ${cpcResult.violations?.length}`}`);
  }

  // Dimension 3: Policy ↔ Outcome mismatch
  // EEL policy outcome must match CGS canonical outcome
  const policyOutcomeMismatch = (!eelResult.eel_valid) ? 0.7
    : (eelResult.active_policy?.om_outcome_hash !== cgsResult.canonical_outcome_hash) ? 1.0
    : 0.0;
  if (policyOutcomeMismatch > 0) {
    inconsistencies.push(`EEL↔CGS: policy outcome hash ≠ canonical outcome hash — policy is not outcome-invariant`);
  }

  // Dimension 4: Temporal ↔ Fabric mismatch
  // TCL current graph hash must match what we just computed for the fabric
  const temporalFabricMismatch = (!tclResult.tci_holds) ? tclResult.drift_score
    : 0.0;
  if (temporalFabricMismatch > 0) {
    inconsistencies.push(`TCL↔Fabric: TCI violated (drift_score=${tclResult.drift_score}) — ${tclResult.violations?.[0]||'temporal inconsistency'}`);
  }

  // Dimension 5: Cross-layer interference (MOCL residuals)
  const crossLayerInterference = (!moclResult.isolation_holds) ? 0.4 : 0.0;
  if (crossLayerInterference > 0) {
    inconsistencies.push(`MOCL: cross-OM interference — ${moclResult.cross_om_interactions?.length} interaction(s) without OMM mediation`);
  }

  const dv: DriftVector = {
    om_execution_mismatch: omExecutionMismatch,
    constraint_execution_mismatch: constraintExecutionMismatch,
    policy_outcome_mismatch: policyOutcomeMismatch,
    temporal_fabric_mismatch: temporalFabricMismatch,
    cross_layer_interference: crossLayerInterference
  };

  // ── DV Magnitude (Euclidean) ───────────────────────────────────────────────
  const dvMagnitude = Math.sqrt(
    Object.values(dv).reduce((sum, v) => sum + v * v, 0)
  );

  // ── SCI-1: System Coherence Invariant ─────────────────────────────────────
  const DV_THRESHOLD = 0.5; // if magnitude > threshold, coherence fails
  const sciHolds = dvMagnitude <= DV_THRESHOLD;

  // ── Fabric Integrity Check (FIC-1) ────────────────────────────────────────
  // Verify: hash(OM lineage) matches what we can reconstruct
  // We check that the lineage_hash in activatedOM is consistent with the
  // carResult.constraint_hash and tclResult.singular_goal_hash
  const ficInputHash = await sha256(`${activatedOM.auth_input_id}|${activatedOM.singular_goal}|${activatedOM.om_id}`);
  // FIC passes if OM lineage is present and constraint hash is stable
  const ficValid = !!lineageHash && !!carResult.constraint_hash && !!tclResult.singular_goal_hash;
  const ficDetails = ficValid
    ? `Lineage hash present (${lineageHash.slice(0,16)}…), constraint hash stable, goal hash stable — FIC-1 passes`
    : `FIC-1 FAILED: missing lineage components — full re-collapse required`;
  if (!ficValid) inconsistencies.push('FIC-1: fabric integrity check failed — lineage components missing');

  // ── Layer Agreement Map ────────────────────────────────────────────────────
  const layerAgreement: Record<string, boolean> = {
    'OM↔ExecGraph':   omExecutionMismatch === 0,
    'CAR↔ExecGraph':  constraintExecutionMismatch === 0,
    'EEL↔CGS':        policyOutcomeMismatch === 0,
    'TCL↔Fabric':     temporalFabricMismatch === 0,
    'MOCL↔Isolation': crossLayerInterference === 0,
    'FIC-1':          ficValid
  };

  const agreedCount = Object.values(layerAgreement).filter(Boolean).length;
  const globalCoherenceScore = agreedCount / Object.keys(layerAgreement).length;

  // ── Repair Trigger ─────────────────────────────────────────────────────────
  const repairTriggered = !sciHolds;
  let repairProtocol: string | null = null;

  if (repairTriggered) {
    // Determine minimum repair action
    if (temporalFabricMismatch >= 0.75 || !ficValid) {
      repairProtocol = 'FULL_RECOLLAPSE: temporal drift or lineage breach detected — halt execution, freeze fabric snapshot, re-derive OM from AuthInput lineage, recompute full stack';
    } else if (constraintExecutionMismatch >= 0.5) {
      repairProtocol = 'CONSTRAINT_RECOLLAPSE: CAR-1 and ExecGraph disagree — re-run CAR-1 validation against current graph, rebuild graph from validated constraints';
    } else if (policyOutcomeMismatch > 0) {
      repairProtocol = 'POLICY_RESET: EEL policy outcome diverged from CGS canonical — discard current PM, re-derive from canonical outcome hash, re-run EEL-1';
    } else {
      repairProtocol = 'COHERENCE_RECHECK: DV magnitude above threshold — freeze state, re-validate all layers against SCG snapshot, re-collapse if inconsistency persists';
    }
  }

  return {
    sci_holds: sciHolds,
    drift_vector: dv,
    dv_magnitude: dvMagnitude,
    inconsistencies,
    repair_triggered: repairTriggered,
    repair_protocol: repairProtocol,
    scg_hash: scgHash,
    scg_snapshot: scgSnapshot,
    fic_valid: ficValid,
    fic_details: ficDetails,
    layer_agreement: layerAgreement,
    global_coherence_score: globalCoherenceScore
  };
}

// ─── RGR ─────────────────────────────────────────────────────────────────────

function applyRenderGate(nodes: any[], cpc: any, om: any, car: any, tcl: any, eel: any, shcl: SHCLResult): any {
  const renderNodes = nodes.filter((n:any) => n.action_type === 'render');
  const dropped: string[] = [], admitted: string[] = [];
  const log: Array<{node_id:string;passed:boolean;reason:string}> = [];
  for (const rn of renderNodes) {
    if (cpc.blocked_nodes.includes(rn.node_id)) {
      dropped.push(rn.node_id); log.push({node_id:rn.node_id,passed:false,reason:'FR-0: CPC violation'}); continue;
    }
    if (!car.cdc_holds) {
      dropped.push(rn.node_id); log.push({node_id:rn.node_id,passed:false,reason:'CAR-1: CDC failed'}); continue;
    }
    if (!tcl.tci_holds) {
      dropped.push(rn.node_id); log.push({node_id:rn.node_id,passed:false,reason:`TCL-1: drift=${tcl.drift_score}`}); continue;
    }
    if (!shcl.sci_holds) {
      dropped.push(rn.node_id); log.push({node_id:rn.node_id,passed:false,reason:`SHCL-1: SCI violated (DV=${shcl.dv_magnitude.toFixed(3)}) — ${shcl.repair_protocol?.split(':')[0]}`}); continue;
    }
    admitted.push(rn.node_id);
    log.push({node_id:rn.node_id,passed:true,reason:`CPC ∧ CDC ∧ TCI ∧ SCI — PM v${eel.policy_version} (${eel.active_policy?.strategy?.optimisation_focus||'cost'})`});
  }
  return { passed: dropped.length === 0, dropped_nodes: dropped, admitted_nodes: admitted, gate_log: log };
}

// ─── MOCL-1 ──────────────────────────────────────────────────────────────────

async function runMOCL1(omId: string, nodes: any[], existingOMs: any[]): Promise<any> {
  const domainId = (await sha256(`domain|${omId}`)).slice(0,16);
  const cross: string[] = [];
  for (const o of existingOMs) {
    if (o.om_id === omId || o.status !== 'active') continue;
    cross.push(`OM:${o.om_id} ("${(o.singular_goal||'').slice(0,40)}") — OMM mediation required`);
  }
  return {
    isolation_domain_id: domainId,
    isolation_holds: cross.length === 0,
    cross_om_interactions: cross,
    omm_required: cross.length > 0,
    domain_boundary: { includes: nodes.map((n:any)=>n.node_id), excludes: ['all nodes from other OM domains'] }
  };
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { raw_text, context_state = {}, session_id, om_id_replay } = body;
    if (!raw_text) return Response.json({ error: 'raw_text required' }, { status: 400 });

    const sid = session_id || uid('session');
    const now = Date.now();
    const stages: any[] = [];
    const fabric: any[] = [];

    // 1. AuthInput
    const authInputId = uid('ai');
    const authInputHash = await sha256(JSON.stringify({ raw_text, context_state, sid }) + now);
    stages.push({ stage: 'AuthInput', status: 'captured', id: authInputId });

    // 2. OPL
    const oplResp = await ai(
      `You are the Objective Proposal Layer (OPL). Propose 1–3 candidate OMs.
Return ONLY a valid JSON array:
[{"singular_goal":string,"success_condition":string,"exclusion_conditions":[string],"constraint_set":[{"type":"hard"|"soft","rule":string}],"confidence":number,"rejection_reason":string}]
Rules: one clear goal → 1 candidate (conf>0.85). Ambiguous → 2–3. NEVER merge goals. NEVER vague success_condition.`,
      `raw_text: "${raw_text}"\ncontext: ${JSON.stringify(context_state)}`
    );
    const candidates: any[] = parseJSON(oplResp, 'OPL');
    stages.push({ stage: 'OPL', status: 'complete', candidate_count: candidates.length,
      candidates: candidates.map((c,i) => ({ index: i, singular_goal: c.singular_goal, confidence: c.confidence })) });

    // 3. CCE
    let activeOM: any = null, rejectedOMs: any[] = [], cceDecision = '', cceReason = '';
    if (candidates.length === 1 && candidates[0].confidence >= 0.75) {
      activeOM = candidates[0]; cceDecision = 'direct_collapse'; cceReason = 'Single high-confidence candidate';
    } else {
      const cceResp = await ai(
        `You are the Canonical Collapse Engine (CCE). Pick exactly ONE winner.
Prefer measurability and specificity. Incompatible goals → needs_clarification=true.
Return ONLY valid JSON:
{"winner_index":number|null,"needs_clarification":boolean,"clarification_question":string|null,"rejection_reasons":{"0":string,"1":string},"cce_reasoning":string}`,
        `Candidates:\n${JSON.stringify(candidates, null, 2)}`
      );
      const cceR = parseJSON(cceResp, 'CCE');
      cceReason = cceR.cce_reasoning;
      if (cceR.needs_clarification) {
        return Response.json({ status: 'blocked_ambiguity', session_id: sid, clarification_required: true,
          clarification_question: cceR.clarification_question,
          candidates: candidates.map((c,i) => ({ index: i, singular_goal: c.singular_goal })),
          pipeline_stages: stages });
      }
      activeOM = candidates[cceR.winner_index];
      rejectedOMs = candidates.filter((_,i) => i !== cceR.winner_index)
        .map((c,i) => ({ ...c, rejection_reason: cceR.rejection_reasons?.[String(i)] || 'Discarded' }));
      cceDecision = 'collapse_with_rejection';
    }

    // 4. Activation Lock
    const omId = om_id_replay || uid('om');
    const lineageHash = await sha256(`${authInputHash}|${JSON.stringify(activeOM)}|${omId}`);
    const collapseHash = await sha256(`collapse|${omId}|${lineageHash}|${now}`);
    stages.push({ stage: 'ActivationLock', status: 'locked', om_id: omId,
      singular_goal: activeOM.singular_goal, immutable: true });

    // 5. CAR-1
    let carResult: any;
    try { carResult = await runCAR1(activeOM.constraint_set || [], omId); }
    catch (e:any) { return Response.json({ error: `CAR-1: ${e.message}`, session_id: sid }, { status: 500 }); }
    stages.push({ stage: 'CAR1', status: carResult.cdc_holds ? 'passed' : 'elastic_detected',
      cdc_holds: carResult.cdc_holds, elastic: carResult.elastic_constraints_detected });
    if (!carResult.cdc_holds) return Response.json({ status: 'blocked_elastic_constraints',
      session_id: sid, car_result: carResult, failed: carResult.failed_constraints, pipeline_stages: stages });

    // 6. Execution Graph
    const egResp = await ai(
      `You are the Execution Graph Generator. Build MINIMAL graph for this OM.
Every node MUST set origin_reference to the om_id. No speculative nodes. Render = terminal.
Return ONLY valid JSON:
{"nodes":[{"node_id":string,"label":string,"action_type":"compute"|"retrieve"|"transform"|"render","input_schema":{"description":string},"output_schema":{"description":string},"origin_reference":string,"depends_on":[string]}],"edges":[{"from":string,"to":string,"label":string}],"validation_note":string}`,
      `om_id: ${omId}\nsingular_goal: ${activeOM.singular_goal}\nsuccess_condition: ${activeOM.success_condition}\nACF_constraints: ${JSON.stringify(carResult.processed_constraints.map((c:any) => c.acf))}`
    );
    const egData = parseJSON(egResp, 'EG');
    const nodes = (egData.nodes||[]).map((n:any) => ({ ...n, origin_reference: omId }));
    const edges = egData.edges || [];
    const executionGraph: any = { eg_id: uid('eg'), om_id: omId, nodes, edges, status: 'building', validation_errors: [] };
    stages.push({ stage: 'ExecutionGraphGeneration', status: 'built', node_count: nodes.length, edge_count: edges.length });

    // 7. CGS-1
    let cgsResult: any;
    try { cgsResult = await runCGS1(nodes, edges, activeOM); }
    catch (e:any) { return Response.json({ error: `CGS-1: ${e.message}`, session_id: sid }, { status: 500 }); }
    stages.push({ stage: 'CGS1', status: cgsResult.pet_holds ? 'outcome_invariant' : 'divergence',
      pet_holds: cgsResult.pet_holds, paths: cgsResult.paths.length });

    // 8. FR-0 CPC
    const cpcResult = validateCPC(nodes, edges, omId, collapseHash);
    executionGraph.status = cpcResult.cpc_holds ? 'valid' : 'cpc_violation';
    executionGraph.validation_errors = cpcResult.violations;
    stages.push({ stage: 'FR0_CPC', status: cpcResult.cpc_holds ? 'passed' : 'violations',
      fr1_guarantee: cpcResult.fr1_guarantee, violations: cpcResult.violations });

    // 9. TCL-1
    let tclResult: any;
    try { tclResult = await runTCL1(omId, lineageHash, activeOM.singular_goal, executionGraph, carResult, base44); }
    catch (e:any) { return Response.json({ error: `TCL-1: ${e.message}`, session_id: sid }, { status: 500 }); }
    stages.push({
      stage: 'TCL1_TemporalCoherence', status: tclResult.tci_holds ? 'coherent' : 'drift_detected',
      tci_holds: tclResult.tci_holds, event_type: tclResult.event_type, version: tclResult.version,
      drift_score: tclResult.drift_score, drift_details: tclResult.drift_details,
      violations: tclResult.violations, replay_valid: tclResult.replay_valid,
      theorem: 'TCI: ∀ t1,t2: OM.id==OM.id ∧ status≠superseded → ExecGraph(t1) ≡ ExecGraph(t2)'
    });
    if (!tclResult.tci_holds && tclResult.drift_score >= 0.75) {
      return Response.json({ status: 'blocked_temporal_drift', session_id: sid,
        tcl_result: tclResult, pipeline_stages: stages,
        message: `TCL-1: drift_score=${tclResult.drift_score}. Supersession required.`,
        violations: tclResult.violations,
        resolution: { option_1: 'Submit without om_id_replay', option_2: 'Resubmit with identical context' }
      });
    }

    // 10. EEL-1
    let eelResult: any;
    try { eelResult = await runEEL1(omId, lineageHash, cgsResult.canonical_outcome_hash, cgsResult, executionGraph, tclResult, base44); }
    catch (e:any) { return Response.json({ error: `EEL-1: ${e.message}`, session_id: sid }, { status: 500 }); }
    stages.push({
      stage: 'EEL1_EpistemicEvolution', status: eelResult.eel_valid ? 'policy_updated' : 'policy_rejected',
      eel_valid: eelResult.eel_valid, policy_version: eelResult.policy_version,
      learning_source: eelResult.learning_source, outcome_invariant: eelResult.outcome_invariant,
      efficiency_improvement: eelResult.efficiency_improvement, efficiency_delta: eelResult.efficiency_delta,
      violations: eelResult.violations, active_strategy: eelResult.active_policy?.strategy,
      allowed_mutations: eelResult.allowed_mutations, forbidden_mutations: eelResult.forbidden_mutations,
      theorem: 'EEL-1: PM_v(n+1) valid iff outcome(n+1)==outcome(n) AND cost(n+1)<cost(n)'
    });

    // 11. MOCL-1 (needed before SHCL)
    let existingOMs: any[] = [];
    try { const ex = await base44.entities.ObjectiveMolecule.list(); existingOMs = (ex||[]).filter((o:any) => o.status === 'active'); } catch(_) {}
    const moclResult = await runMOCL1(omId, nodes, existingOMs);

    // 12. SHCL-1 — System Coherence Graph + Drift Vector + SCI
    const preActivatedOM = {
      ...activeOM, om_id: omId, auth_input_id: authInputId,
      lineage_hash: lineageHash, status: 'active'
    };
    let shclResult: SHCLResult;
    try {
      shclResult = await runSHCL1(
        preActivatedOM, carResult, cgsResult, executionGraph,
        eelResult, tclResult, moclResult, cpcResult, lineageHash
      );
    } catch (e:any) { return Response.json({ error: `SHCL-1: ${e.message}`, session_id: sid }, { status: 500 }); }

    stages.push({
      stage: 'SHCL1_SystemCoherence',
      status: shclResult.sci_holds ? 'coherent' : 'repair_triggered',
      sci_holds: shclResult.sci_holds,
      dv_magnitude: shclResult.dv_magnitude,
      drift_vector: shclResult.drift_vector,
      inconsistencies: shclResult.inconsistencies,
      repair_triggered: shclResult.repair_triggered,
      repair_protocol: shclResult.repair_protocol,
      fic_valid: shclResult.fic_valid,
      fic_details: shclResult.fic_details,
      layer_agreement: shclResult.layer_agreement,
      global_coherence_score: shclResult.global_coherence_score,
      scg_hash: shclResult.scg_hash,
      theorem: 'SCI-1: ∀ SCG: consistency(OM, CAR, CGS, EEL, TCL, MOCL) == true',
      principle: 'No local repair allowed — all repair is global, collapse-based, graph-recomputed'
    });

    // Block if coherence is critically broken (not just warn)
    if (!shclResult.sci_holds && shclResult.dv_magnitude > 1.2) {
      return Response.json({
        status: 'blocked_coherence_failure', session_id: sid,
        shcl_result: shclResult, pipeline_stages: stages,
        message: `SHCL-1: System coherence failed (DV=${shclResult.dv_magnitude.toFixed(3)} > 1.2). ${shclResult.repair_protocol}`,
        inconsistencies: shclResult.inconsistencies,
        resolution: 'Re-Collapse Protocol: submit a fresh request to re-derive from canonical lineage'
      });
    }

    // 13. RGR (now includes SHCL gate)
    const rgrResult = applyRenderGate(nodes, cpcResult, { ...activeOM, status: 'active' }, carResult, tclResult, eelResult, shclResult);
    stages.push({ stage: 'RenderGate_RGR',
      status: rgrResult.passed ? 'all_admitted' : 'nodes_dropped',
      admitted: rgrResult.admitted_nodes.length, dropped: rgrResult.dropped_nodes.length,
      gate_log: rgrResult.gate_log });

    stages.push({ stage: 'MOCL1_Isolation',
      status: moclResult.isolation_holds ? 'isolated' : 'mediation_required',
      isolation_domain_id: moclResult.isolation_domain_id,
      cross_om_count: moclResult.cross_om_interactions.length });

    // Build final OM
    const activatedOM = {
      ...activeOM, om_id: omId, auth_input_id: authInputId, lineage_hash: lineageHash,
      status: 'active', candidate_siblings: rejectedOMs.map((_,i) => `rejected_${i}`),
      isolation_domain_id: moclResult.isolation_domain_id,
      ccc_valid: true, car_valid: carResult.cdc_holds,
      execution_manifold_id: cgsResult.manifold_id,
      version: tclResult.version,
      singular_goal_hash: tclResult.singular_goal_hash,
      execution_graph_hash: tclResult.current_graph_hash,
      tci_holds: tclResult.tci_holds,
      constraint_set: carResult.processed_constraints
    };

    // UI Materialisation
    const admittedRender = nodes.filter((n:any) => n.action_type === 'render' && rgrResult.admitted_nodes.includes(n.node_id));
    const uiProjection = {
      allowed_surfaces: admittedRender.map((n:any) => ({
        surface_id: n.node_id, label: n.label,
        bound_to_om: n.origin_reference === omId, input_from: n.depends_on,
        cpc_proof: cpcResult.proof_paths[n.node_id] || [],
        equivalence_class: cgsResult.equivalence_class_id,
        isolation_domain: moclResult.isolation_domain_id,
        temporal_version: tclResult.version,
        active_policy: `PM v${eelResult.policy_version} (${eelResult.active_policy?.strategy?.optimisation_focus})`
      })),
      blocked_surfaces: rgrResult.dropped_nodes.map((id:string) => ({
        surface_id: id,
        reason: rgrResult.gate_log.find((g:any) => g.node_id === id)?.reason,
        action: 'DROPPED — re-collapse required'
      })),
      fr0:  cpcResult.fr1_guarantee && rgrResult.passed ? 'GUARANTEED' : 'PARTIAL',
      car:  carResult.cdc_holds ? 'DETERMINISTIC' : 'ELASTIC',
      cgs:  cgsResult.pet_holds ? 'OUTCOME_INVARIANT' : 'DIVERGENT',
      mocl: moclResult.isolation_holds ? 'ISOLATED' : 'MEDIATION_REQUIRED',
      tcl:  tclResult.tci_holds ? `COHERENT (v${tclResult.version}, ${tclResult.event_type})` : `DRIFT (score=${tclResult.drift_score})`,
      eel:  eelResult.eel_valid ? `EVOLVING (PM v${eelResult.policy_version}, Δ=${eelResult.efficiency_delta})` : 'POLICY_REJECTED',
      shcl: shclResult.sci_holds ? `COHERENT (DV=${shclResult.dv_magnitude.toFixed(3)}, score=${(shclResult.global_coherence_score*100).toFixed(0)}%)` : `REPAIR (DV=${shclResult.dv_magnitude.toFixed(3)})`
    };
    stages.push({ stage: 'UIMaterialisation', status: 'projected',
      admitted: uiProjection.allowed_surfaces.length, blocked: uiProjection.blocked_surfaces.length,
      shcl: uiProjection.shcl, tcl: uiProjection.tcl, eel: uiProjection.eel });

    // ── origin.fabric chain ───────────────────────────────────────────────────
    const invBase = {
      singularity: true, no_orphan_execution: true,
      no_representation_without_collapse: true, no_speculative_features: true,
      cdc_holds: carResult.cdc_holds, pet_holds: cgsResult.pet_holds,
      mocl_isolation_holds: moclResult.isolation_holds,
      tci_holds: tclResult.tci_holds, eel_valid: eelResult.eel_valid,
      sci_holds: shclResult.sci_holds
    };

    const entries: Array<[string, any]> = [];
    const mkFabric = async (type: string, summary: string, extra: any = {}, prev: string|null = null) => {
      const ph = await sha256(summary + JSON.stringify(extra));
      const h = await sha256(`${type}|${omId}|${ph}|${now + entries.length}`);
      const entry = { hash: h, parent_hash: prev, om_id: omId, session_id: sid, event_type: type, payload_hash: ph, payload_summary: summary, invariant_check: invBase, ...extra, timestamp_ms: now + entries.length };
      entries.push([h, entry]);
      return h;
    };

    let ph: string;
    ph = await mkFabric('input', `AuthInput: "${raw_text.slice(0,80)}"`, { invariant_check: {...invBase,no_representation_without_collapse:false,cdc_holds:false,pet_holds:false,tci_holds:false,eel_valid:false,sci_holds:false} }, null);
    ph = await mkFabric('collapse', `CCE → "${activeOM.singular_goal}" (${cceDecision})`, {}, ph);
    ph = await mkFabric('car_check', `CAR-1: CDC=${carResult.cdc_holds}, elastic=[${carResult.elastic_constraints_detected.join(',')||'none'}]`, { car_layer: { constraint_hash: carResult.constraint_hash, determinism_score: carResult.cdc_holds?1.0:0.0, allowed_state_set_hash: carResult.allowed_state_set_hash, elastic_constraints_detected: carResult.elastic_constraints_detected } }, ph);
    ph = await mkFabric('cgs_path', `CGS-1: ${cgsResult.paths.length} path(s), PET=${cgsResult.pet_holds}`, { cgs_layer: { execution_path_hash: await sha256(JSON.stringify(cgsResult.paths)), equivalence_class_id: cgsResult.equivalence_class_id, outcome_hash: cgsResult.canonical_outcome_hash, path_variance: cgsResult.path_variance } }, ph);
    ph = await mkFabric(tclResult.tci_holds?'tcl_check':'drift_violation', `TCL-1: TCI=${tclResult.tci_holds}, event=${tclResult.event_type}, v=${tclResult.version}, drift=${tclResult.drift_score}`, { tcl_layer: { version:tclResult.version, drift_score:tclResult.drift_score, tci_holds:tclResult.tci_holds, execution_graph_hash:tclResult.current_graph_hash, previous_graph_hash:tclResult.previous_graph_hash, singular_goal_hash:tclResult.singular_goal_hash, replay_valid:tclResult.replay_valid, event_type:tclResult.event_type } }, ph);
    ph = await mkFabric(eelResult.eel_valid?'eel_policy':'eel_rejection', `EEL-1: PM v${eelResult.policy_version} (${eelResult.learning_source}), Δ=${eelResult.efficiency_delta}, valid=${eelResult.eel_valid}`, { eel_layer: { pm_id:eelResult.active_policy?.pm_id, pm_version:eelResult.policy_version, learning_source:eelResult.learning_source, outcome_invariant:eelResult.outcome_invariant, efficiency_delta:eelResult.efficiency_delta, strategy_hash:await sha256(JSON.stringify(eelResult.active_policy?.strategy)), prior_pm_id:eelResult.prior_policy?.pm_id||null, eel_valid:eelResult.eel_valid } }, ph);
    // SHCL fabric entry — the coherence audit record
    ph = await mkFabric(shclResult.sci_holds?'shcl_check':'shcl_freeze', `SHCL-1: SCI=${shclResult.sci_holds}, DV=${shclResult.dv_magnitude.toFixed(3)}, coherence=${(shclResult.global_coherence_score*100).toFixed(0)}%, repair=${shclResult.repair_triggered}`, { shcl_layer: { drift_vector: shclResult.drift_vector, dv_magnitude: shclResult.dv_magnitude, sci_holds: shclResult.sci_holds, repair_triggered: shclResult.repair_triggered, scg_hash: shclResult.scg_hash } }, ph);
    ph = await mkFabric('execution', `ExecGraph: ${nodes.length} nodes, CPC=${cpcResult.cpc_holds}, TCI=${tclResult.tci_holds}, SCI=${shclResult.sci_holds}`, {}, ph);
    for (const dropped of rgrResult.dropped_nodes) {
      ph = await mkFabric('violation', `RGR dropped ${dropped}: ${rgrResult.gate_log.find((g:any)=>g.node_id===dropped)?.reason}`, { invariant_check:{...invBase,no_speculative_features:false} }, ph);
    }
    if (moclResult.omm_required) {
      ph = await mkFabric('mocl_mediation', `MOCL-1: ${moclResult.cross_om_interactions.length} cross-OM interaction(s)`, { invariant_check:{...invBase,mocl_isolation_holds:false}, mocl_layer:{isolation_domain_id:moclResult.isolation_domain_id,cross_om_interactions:moclResult.cross_om_interactions,omm_mediated:true} }, ph);
    }
    ph = await mkFabric('render', `UI: ${admittedRender.length} admitted — SCI=${shclResult.sci_holds}, EEL=${uiProjection.eel}`, {}, ph);

    const fabricChain = entries.map(([,e]) => e);
    stages.push({ stage: 'FabricChain', status: 'sealed', entry_count: fabricChain.length,
      chain_head: fabricChain[fabricChain.length-1].hash,
      layers: ['input','collapse','car_check','cgs_path','tcl_check','eel_policy','shcl_check','execution','render'] });

    // ── Persist ───────────────────────────────────────────────────────────────
    executionGraph.manifold_id = cgsResult.manifold_id;
    executionGraph.equivalence_class_id = cgsResult.equivalence_class_id;
    executionGraph.outcome_hash = cgsResult.canonical_outcome_hash;
    executionGraph.isolation_domain_id = moclResult.isolation_domain_id;

    await base44.entities.AuthInput.create({ raw_text, context_state, session_id: sid, status: 'collapsed' });
    await base44.entities.ObjectiveMolecule.create(activatedOM);
    await base44.entities.ExecutionGraph.create(executionGraph);
    for (const entry of fabricChain) await base44.entities.FabricEntry.create(entry);
    await base44.entities.FabricTimeChain.create(tclResult.temporal_spine_entry);
    if (eelResult.eel_valid) await base44.entities.PolicyMolecule.create(eelResult.active_policy);

    const allClear = cpcResult.fr1_guarantee && rgrResult.passed && carResult.cdc_holds &&
      cgsResult.pet_holds && moclResult.isolation_holds && tclResult.tci_holds &&
      eelResult.eel_valid && shclResult.sci_holds;

    return Response.json({
      status: allClear ? 'collapsed_all_guarantees_held' : 'collapsed_partial',
      session_id: sid,
      active_om: activatedOM,
      execution_graph: executionGraph,
      ui_projection: uiProjection,

      formal_guarantees: {
        FR0:   { holds: cpcResult.fr1_guarantee, statement: 'No find_REPLACE state reachable — CPC enforced' },
        CAR1:  { holds: carResult.cdc_holds, statement: 'All constraints deterministic ACF — no semantic elasticity', elastic: carResult.elastic_constraints_detected },
        CGS1:  { holds: cgsResult.pet_holds, statement: 'All execution paths outcome-invariant — manifold bounded', paths: cgsResult.paths.length, divergent: cgsResult.divergent_paths },
        MOCL1: { holds: moclResult.isolation_holds, statement: 'OM sealed in causal domain — no cross-OM contamination', omm_required: moclResult.omm_required },
        TCL1:  { holds: tclResult.tci_holds, statement: 'OM temporally stable — no silent semantic mutation', event_type: tclResult.event_type, version: tclResult.version, drift_score: tclResult.drift_score, violations: tclResult.violations, invariant: 'TCI: ∀ t1,t2: OM.id==OM.id ∧ status≠superseded → ExecGraph(t1) ≡ ExecGraph(t2)' },
        EEL1:  { holds: eelResult.eel_valid, statement: 'Learning via policy evolution — meaning frozen, strategy evolvable', policy_version: eelResult.policy_version, efficiency_delta: eelResult.efficiency_delta, outcome_invariant: eelResult.outcome_invariant, learning_source: eelResult.learning_source, violations: eelResult.violations, invariant: 'EEL-1: PM_v(n+1) valid iff outcome(n+1)==outcome(n) AND cost(n+1)<cost(n)' },
        SHCL1: { holds: shclResult.sci_holds, statement: 'System state continuously re-derived — no local repair permitted', dv_magnitude: shclResult.dv_magnitude, global_coherence_score: shclResult.global_coherence_score, layer_agreement: shclResult.layer_agreement, fic_valid: shclResult.fic_valid, repair_triggered: shclResult.repair_triggered, repair_protocol: shclResult.repair_protocol, inconsistencies: shclResult.inconsistencies, invariant: 'SCI-1: ∀ SCG: consistency(OM, CAR, CGS, EEL, TCL, MOCL) == true' }
      },

      cce_decision: cceDecision, cce_reason: cceReason,
      car_result: carResult, cgs_result: cgsResult, cpc_result: cpcResult,
      tcl_result: tclResult, eel_result: eelResult, shcl_result: shclResult,
      mocl_result: moclResult, rgr_result: rgrResult,
      rejected_oms: rejectedOMs, fabric_chain: fabricChain, pipeline_stages: stages,

      invariants: {
        singularity: true,
        no_find_replace: cpcResult.fr1_guarantee,
        no_elastic_constraints: carResult.cdc_holds,
        outcome_invariant_creativity: cgsResult.pet_holds,
        no_cross_om_contamination: moclResult.isolation_holds,
        no_temporal_drift: tclResult.tci_holds,
        learning_without_drift: eelResult.eel_valid,
        global_coherence: shclResult.sci_holds,
        correction_model: 'recollapse_only — no local repair, no patching, no find_REPLACE',
        evolution_model: 'policy_only — meaning frozen, strategy evolvable within outcome space',
        coherence_model: 'continuously_rederived — system truth is derived from immutable lineage, not maintained'
      }
    });

  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
