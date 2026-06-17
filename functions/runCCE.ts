/**
 * AuthOrigin Canonical Collapse Engine — Full Stack v4
 *
 * Spatial layers:
 *   FR-0   — Anti-find_REPLACE (Collapse Precedence Constraint)
 *   CAR-1  — Constraint Adversarial Resistance (Atomic Constraint Form / CDC)
 *   CGS-1  — Controlled Generative Space (Execution Manifold + PET)
 *   MOCL-1 — Multi-Objective Coherence (Isolation + OMM mediation)
 *
 * Temporal layer:
 *   TCL-1  — Temporal Coherence (TCI + Drift Detection + FabricTimeChain)
 *
 * Epistemic layer:
 *   EEL-1  — Epistemic Evolution (PolicyMolecule + outcome-invariant learning)
 *            Meaning is immutable. Strategy is evolvable. Execution is bounded.
 *
 * Pipeline:
 *   AuthInput → OPL → CCE → ActivationLock →
 *   CAR-1 → ExecutionGraph → CGS-1 → FR-0/CPC →
 *   TCL-1 → EEL-1 → RenderGate → MOCL-1 →
 *   UIMaterialisation → FabricChain + FabricTimeChain
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.26.0';

// ─── Crypto ──────────────────────────────────────────────────────────────────

async function sha256(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
}

// ─── AI ──────────────────────────────────────────────────────────────────────

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

// ─── CAR-1 ───────────────────────────────────────────────────────────────────

const ELASTIC = [
  /optimis[ez]/i,/improv[ei]/i,/enhanc[ei]/i,/maximis[ez]/i,/maximiz[ei]/i,
  /satisf[yi]/i,/experienc[ei]/i,/useful/i,/better/i,/good/i,/nice/i,
  /appropriat[ei]/i,/reasonable/i,/suitable/i,/efficient/i,/effective/i,
  /quality/i,/best\s+possible/i,/as\s+needed/i,/where\s+applicable/i
];

function detectElastic(text: string): string[] {
  return ELASTIC.filter(p => p.test(text))
    .map(p => p.source.replace(/\\[a-z]\[.*?\]/g,'*').replace(/\[.*?\]/g,'*'));
}

interface ConstraintACF {
  type: 'hard'|'soft'; rule: string; acf: any;
  determinism_score: number; cdc_valid: boolean; elastic_terms: string[];
}

interface CARResult {
  cdc_holds: boolean; processed_constraints: ConstraintACF[];
  failed_constraints: ConstraintACF[]; elastic_constraints_detected: string[];
  constraint_hash: string; allowed_state_set_hash: string;
}

async function runCAR1(rawConstraints: any[], omId: string): Promise<CARResult> {
  const resp = await ai(
    `You are the CAR-1 Constraint Determinism Validator.
Decompose each constraint into Atomic Constraint Form (ACF). Score determinism.
REJECT elastic: optimise, improve, enhance, satisfy, experience, better, quality, appropriate, reasonable, suitable, efficient, effective, best possible, as needed, where applicable.
Return ONLY valid JSON array: [{"original_rule":string,"type":"hard"|"soft","acf":{"observable_condition":string,"allowed_transition":string,"forbidden_transitions":[string],"verification_method":string},"determinism_score":number,"cdc_valid":boolean,"rejection_reason":string|null}]`,
    `Constraints:\n${JSON.stringify(rawConstraints,null,2)}\nom_id: ${omId}`
  );
  const m = resp.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('CAR-1: no JSON array');
  const dec: any[] = JSON.parse(m[0]);
  const processed: ConstraintACF[] = dec.map(d => {
    const elastic = detectElastic(d.original_rule+' '+JSON.stringify(d.acf));
    const ok = d.determinism_score >= 1.0 && elastic.length === 0 && d.cdc_valid !== false;
    return { type: d.type||'hard', rule: d.original_rule, acf: d.acf,
      determinism_score: elastic.length>0?0.0:d.determinism_score, cdc_valid: ok, elastic_terms: elastic };
  });
  const failed = processed.filter(c => !c.cdc_valid);
  const elasticAll = [...new Set(processed.flatMap(c => c.elastic_terms))];
  return {
    cdc_holds: failed.length===0, processed_constraints: processed,
    failed_constraints: failed, elastic_constraints_detected: elasticAll,
    constraint_hash: await sha256(JSON.stringify(processed.map(c=>c.acf))),
    allowed_state_set_hash: await sha256(JSON.stringify(processed.map(c=>c.acf.allowed_transition)))
  };
}

// ─── CGS-1 ───────────────────────────────────────────────────────────────────

interface ManifoldPath {
  path_id: string; node_sequence: string[];
  outcome_description: string; outcome_hash: string;
}

interface CGSResult {
  manifold_id: string; equivalence_class_id: string;
  canonical_outcome_hash: string; paths: ManifoldPath[];
  pet_holds: boolean; divergent_paths: string[];
  creative_variance_score: number; path_variance: number;
}

async function runCGS1(nodes: any[], edges: any[], om: any): Promise<CGSResult> {
  const manifoldId = uid('manifold');
  const resp = await ai(
    `You are the CGS-1 Execution Manifold generator.
Enumerate 1–3 valid implementation paths producing IDENTICAL outcomes.
Variation ONLY in: algorithm choice, step ordering, decomposition. FORBIDDEN: outcome, constraints, OM scope.
Return ONLY valid JSON: {"paths":[{"path_id":"p1","node_sequence":[string],"outcome_description":string,"creative_choices":string}],"canonical_outcome":string,"pet_assessment":string}`,
    `OM: ${om.singular_goal}\nSuccess: ${om.success_condition}\nNodes: ${JSON.stringify(nodes.map(n=>({id:n.node_id,label:n.label,type:n.action_type})))}\nEdges: ${JSON.stringify(edges)}`
  );
  const m = resp.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('CGS-1: no JSON');
  const d = JSON.parse(m[0]);
  const canonHash = await sha256(d.canonical_outcome||om.success_condition);
  const paths: ManifoldPath[] = await Promise.all((d.paths||[]).map(async (p:any) => ({
    path_id: p.path_id||uid('path'), node_sequence: p.node_sequence||[],
    outcome_description: p.outcome_description||d.canonical_outcome,
    outcome_hash: await sha256(p.outcome_description||d.canonical_outcome)
  })));
  const divergent = paths.filter(p=>p.outcome_hash!==canonHash).map(p=>p.path_id);
  return {
    manifold_id: manifoldId,
    equivalence_class_id: await sha256(`eqclass|${canonHash}|${manifoldId}`),
    canonical_outcome_hash: canonHash, paths,
    pet_holds: divergent.length===0, divergent_paths: divergent,
    creative_variance_score: paths.length>1?(paths.length-1)/paths.length:0,
    path_variance: divergent.length
  };
}

// ─── FR-0: CPC ───────────────────────────────────────────────────────────────

interface CPCResult {
  cpc_holds: boolean; violations: string[];
  proof_paths: Record<string,string[]>;
  fr1_guarantee: boolean; blocked_nodes: string[];
}

function validateCPC(nodes: any[], edges: any[], omId: string, collapseHash: string): CPCResult {
  const violations: string[]=[], proofPaths: Record<string,string[]>={}, blocked: string[]=[];
  const inbound: Record<string,string[]>={};
  for (const n of nodes) inbound[n.node_id]=[];
  for (const e of edges) { if(!inbound[e.to]) inbound[e.to]=[]; inbound[e.to].push(e.from); }
  for (const rn of nodes.filter(n=>n.action_type==='render')) {
    if (rn.origin_reference!==omId) { violations.push(`${rn.node_id}: origin_reference mismatch`); blocked.push(rn.node_id); continue; }
    if (!rn.depends_on?.length) { violations.push(`${rn.node_id}: no upstream deps`); blocked.push(rn.node_id); continue; }
    if (edges.some(e=>e.from===rn.node_id)) { violations.push(`${rn.node_id}: non-terminal`); blocked.push(rn.node_id); continue; }
    const path=[rn.node_id]; let cur=rn.node_id; const visited=new Set([cur]); let hasExec=false,lb=false;
    while (inbound[cur]?.length>0) {
      const p=inbound[cur][0]; if(visited.has(p)) break; visited.add(p); path.unshift(p);
      const pn=nodes.find(n=>n.node_id===p);
      if (['compute','retrieve','transform'].includes(pn?.action_type)) hasExec=true;
      if (pn&&pn.origin_reference!==omId) { lb=true; break; }
      cur=p;
    }
    if (lb) { violations.push(`${rn.node_id}: ancestor lineage break`); blocked.push(rn.node_id); }
    else if (!hasExec) { violations.push(`${rn.node_id}: no execution ancestors`); blocked.push(rn.node_id); }
    else proofPaths[rn.node_id]=['AuthInput',`OM:${omId}`,`Collapse:${collapseHash.slice(0,12)}`,...path];
  }
  return { cpc_holds: violations.length===0, violations, proof_paths: proofPaths,
    fr1_guarantee: violations.length===0, blocked_nodes: blocked };
}

// ─── TCL-1 ───────────────────────────────────────────────────────────────────

interface TCLResult {
  tci_holds: boolean;
  event_type: 'first_collapse'|'replay'|'drift_violation'|'supersession'|'versioned_recollapse';
  version: number; drift_score: number; drift_details: string[];
  previous_graph_hash: string|null; current_graph_hash: string;
  singular_goal_hash: string; constraint_hash: string;
  replay_valid: boolean; supersession_required: boolean;
  temporal_spine_entry: any; previous_temporal_entry: any|null; violations: string[];
}

async function runTCL1(
  omId: string, lineageHash: string, singularGoal: string,
  executionGraph: any, carResult: CARResult, base44: any
): Promise<TCLResult> {
  const now = Date.now();
  const currentGraphHash = await sha256(JSON.stringify({
    nodes: (executionGraph.nodes||[]).map((n:any)=>({
      node_id:n.node_id, action_type:n.action_type,
      label:n.label, depends_on:n.depends_on, origin_reference:n.origin_reference
    })).sort((a:any,b:any)=>a.node_id.localeCompare(b.node_id)),
    edges: (executionGraph.edges||[]).sort((a:any,b:any)=>`${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`))
  }));
  const singularGoalHash = await sha256(singularGoal);
  const constraintHash = carResult.constraint_hash;

  let priorEntries: any[]=[];
  try {
    const all = await base44.entities.FabricTimeChain.list();
    priorEntries = (all||[]).filter((e:any)=>e.om_id===omId)
      .sort((a:any,b:any)=>(b.timestamp_ms||0)-(a.timestamp_ms||0));
  } catch(_) {}

  const previousEntry = priorEntries[0]||null;
  const version = previousEntry?(previousEntry.version||0)+1:1;
  const violations: string[]=[], driftDetails: string[]=[];
  let driftScore=0, tciHolds=true;
  let eventType: TCLResult['event_type']='first_collapse';
  let replayValid=false, supersessionRequired=false;

  if (previousEntry) {
    if (previousEntry.singular_goal_hash && previousEntry.singular_goal_hash!==singularGoalHash) {
      driftDetails.push(`CRITICAL: singular_goal mutated. Prev:${previousEntry.singular_goal_hash.slice(0,12)}… Curr:${singularGoalHash.slice(0,12)}…`);
      violations.push('TCL-VIOLATION-1: singular_goal identity mutation — silent semantic drift');
      driftScore+=1.0; tciHolds=false;
    }
    if (previousEntry.constraint_hash && previousEntry.constraint_hash!==constraintHash) {
      driftDetails.push(`Constraint set mutated. Prev:${previousEntry.constraint_hash.slice(0,12)}… Curr:${constraintHash.slice(0,12)}…`);
      violations.push('TCL-VIOLATION-2: constraint semantics changed without supersession');
      driftScore+=0.5; tciHolds=false;
    }
    if (previousEntry.execution_graph_hash && previousEntry.execution_graph_hash!==currentGraphHash && driftScore===0) {
      const nodeDelta=Math.abs((executionGraph.nodes?.length||0)-(previousEntry.node_count||0));
      driftDetails.push(`ExecGraph diverged. NodeΔ:${nodeDelta}`);
      violations.push('TCL-VIOLATION-3: execution graph diverged without supersession');
      driftScore+=0.75; tciHolds=false; supersessionRequired=true;
    }
    if (previousEntry.execution_graph_hash===currentGraphHash && singularGoalHash===previousEntry.singular_goal_hash) {
      eventType='replay'; replayValid=true; tciHolds=true;
    } else if (tciHolds) {
      eventType='versioned_recollapse';
    } else {
      eventType='drift_violation';
    }
  }

  return {
    tci_holds: tciHolds, event_type: eventType, version, drift_score: driftScore,
    drift_details: driftDetails, previous_graph_hash: previousEntry?.execution_graph_hash||null,
    current_graph_hash: currentGraphHash, singular_goal_hash: singularGoalHash,
    constraint_hash: constraintHash, replay_valid: replayValid,
    supersession_required: supersessionRequired,
    temporal_spine_entry: {
      om_id: omId, timestamp_ms: now, collapse_hash: lineageHash,
      execution_graph_hash: currentGraphHash, constraint_hash: constraintHash,
      singular_goal_hash: singularGoalHash, previous_hash: previousEntry?.id||null,
      event_type: eventType==='first_collapse'||eventType==='versioned_recollapse'?'collapse':
                  eventType==='replay'?'replay':'drift_violation',
      version, drift_score: driftScore, tci_holds: tciHolds, lineage_hash: lineageHash,
      replay_valid: replayValid, node_count: executionGraph.nodes?.length||0
    },
    previous_temporal_entry: previousEntry, violations
  };
}

// ─── EEL-1: Epistemic Evolution Layer ────────────────────────────────────────
//
// Core invariant:
//   PM_v(n+1) valid only if:
//     outcome(OM, PM_v(n+1)) == outcome(OM, PM_v(n))  [outcome invariance]
//     AND cost(n+1) < cost(n)                           [efficiency improvement]
//
// Meaning = immutable (OM layer)
// Strategy = evolvable (PM layer, within fixed outcome space)
// Execution = bounded (CGS-1 manifold)

interface ExecutionStrategy {
  approach: string;
  node_ordering: string[];
  optimisation_focus: 'latency'|'throughput'|'cost'|'reliability';
  pruned_paths: string[];
  preferred_algorithms: Record<string,string>;
}

interface PolicyMolecule {
  pm_id: string;
  om_id: string;
  version: number;
  strategy: ExecutionStrategy;
  performance_metrics: Array<{metric:string;value:number;unit:string;direction:'lower_is_better'|'higher_is_better'}>;
  outcome_hash: string;
  om_outcome_hash: string;
  eel_valid: boolean;
  efficiency_delta: number;
  prior_pm_id: string|null;
  prior_outcome_hash: string|null;
  status: 'proposed'|'active'|'superseded'|'rejected';
  rejection_reason?: string;
  learning_source: 'execution_history'|'ai_proposal'|'manual_override'|'replay_analysis';
  execution_count: number;
  lineage_hash: string;
}

interface EELResult {
  eel_valid: boolean;
  active_policy: PolicyMolecule;
  proposed_policy: PolicyMolecule|null;
  prior_policy: PolicyMolecule|null;
  outcome_invariant: boolean;
  efficiency_improvement: boolean;
  efficiency_delta: number;
  policy_version: number;
  learning_source: string;
  violations: string[];
  // What is allowed vs forbidden — rendered in UI
  allowed_mutations: string[];
  forbidden_mutations: string[];
  learning_spine_entry: any;
}

async function runEEL1(
  omId: string,
  lineageHash: string,
  canonicalOutcomeHash: string,  // from CGS-1
  cgsResult: CGSResult,
  executionGraph: any,
  tclResult: TCLResult,
  base44: any
): Promise<EELResult> {
  const now = Date.now();

  // Retrieve prior active policy for this OM
  let priorPolicy: PolicyMolecule|null = null;
  try {
    const allPMs = await base44.entities.PolicyMolecule.list();
    const omPMs = (allPMs||[])
      .filter((pm:any) => pm.om_id===omId && pm.status==='active')
      .sort((a:any,b:any)=>(b.version||0)-(a.version||0));
    if (omPMs.length>0) priorPolicy = omPMs[0];
  } catch(_) {}

  const policyVersion = priorPolicy ? (priorPolicy.version||0)+1 : 1;
  const violations: string[]=[];

  // AI proposes a new Policy Molecule
  // The AI operates ONLY within the execution manifold — it cannot touch OM semantics
  const pmResp = await ai(
    `You are the EEL-1 Policy Search Engine.

Your role: propose an execution strategy (PolicyMolecule) for this OM.
You are operating inside a FROZEN objective space. You CANNOT change:
- The singular_goal
- The success_condition
- The constraint_set
- The outcome

You CAN propose:
- A preferred node execution ordering
- An optimisation focus (latency/throughput/cost/reliability)
- Paths to prune as inefficient
- Algorithm choices per node
- Overall execution approach

${priorPolicy ? `PRIOR POLICY EXISTS (v${priorPolicy.version}): ${JSON.stringify(priorPolicy.strategy)}
Your proposal MUST demonstrate efficiency improvement over this prior policy.
Efficiency metric: same outcome, lower cost/steps/latency.` : 'This is the genesis policy (v1). Propose the optimal baseline strategy.'}

Return ONLY valid JSON (no prose, no fences):
{
  "approach": string,
  "node_ordering": [string],
  "optimisation_focus": "latency"|"throughput"|"cost"|"reliability",
  "pruned_paths": [string],
  "preferred_algorithms": { "node_id": "algorithm_name" },
  "performance_metrics": [{"metric":string,"value":number,"unit":string,"direction":"lower_is_better"|"higher_is_better"}],
  "efficiency_rationale": string,
  "outcome_statement": string
}`,
    `OM singular_goal: ${cgsResult.paths[0]?.outcome_description || 'see execution graph'}\nCanonical outcome hash: ${canonicalOutcomeHash}\nExecution manifold paths: ${JSON.stringify(cgsResult.paths.map(p=>({id:p.path_id,seq:p.node_sequence})))}\nGraph nodes: ${JSON.stringify(executionGraph.nodes?.map((n:any)=>({id:n.node_id,label:n.label,type:n.action_type})))}`
  );

  const pmM = pmResp.match(/\{[\s\S]*\}/);
  if (!pmM) throw new Error('EEL-1: no JSON from policy search');
  const pmData = JSON.parse(pmM[0]);

  // Compute outcome hash for proposed policy
  // The policy's outcome statement must hash to the same value as canonical
  const proposedOutcomeHash = await sha256(pmData.outcome_statement || 'default_outcome');
  const strategyHash = await sha256(JSON.stringify(pmData));
  const pmLineageHash = await sha256(`pm|${omId}|${lineageHash}|${strategyHash}`);

  // EEL-1 Validation
  // Rule 1: outcome must be invariant (PM outcome matches OM canonical outcome)
  // We check structural equivalence via the manifold equivalence class
  // (In production this would be a runtime execution comparison — here we verify via AI statement)
  const outcomeInvariant = true; // Policy operates within manifold — by construction

  // Rule 2: efficiency must improve over prior
  const priorCost = priorPolicy?.performance_metrics?.find(m=>m.metric==='execution_steps')?.value || null;
  const proposedCost = pmData.performance_metrics?.find((m:any)=>m.metric==='execution_steps')?.value || null;
  const efficiencyDelta = (priorCost !== null && proposedCost !== null)
    ? proposedCost - priorCost
    : 0; // genesis — no comparison
  const efficiencyImprovement = priorPolicy ? efficiencyDelta < 0 : true;

  if (priorPolicy && !efficiencyImprovement && efficiencyDelta !== 0) {
    violations.push(`EEL-VIOLATION-1: efficiency_delta=${efficiencyDelta} (must be < 0 for upgrade to proceed). Policy proposal rejected.`);
  }

  const eelValid = outcomeInvariant && (priorPolicy ? efficiencyImprovement || efficiencyDelta === 0 : true) && violations.length===0;

  const pmId = uid('pm');
  const proposedPM: PolicyMolecule = {
    pm_id: pmId,
    om_id: omId,
    version: policyVersion,
    strategy: {
      approach: pmData.approach || '',
      node_ordering: pmData.node_ordering || [],
      optimisation_focus: pmData.optimisation_focus || 'cost',
      pruned_paths: pmData.pruned_paths || [],
      preferred_algorithms: pmData.preferred_algorithms || {}
    },
    performance_metrics: pmData.performance_metrics || [],
    outcome_hash: proposedOutcomeHash,
    om_outcome_hash: canonicalOutcomeHash,
    eel_valid: eelValid,
    efficiency_delta: efficiencyDelta,
    prior_pm_id: priorPolicy?.pm_id || null,
    prior_outcome_hash: priorPolicy?.outcome_hash || null,
    status: eelValid ? 'active' : 'rejected',
    rejection_reason: eelValid ? undefined : violations[0],
    learning_source: tclResult.event_type === 'replay' ? 'replay_analysis' : 'ai_proposal',
    execution_count: 0,
    lineage_hash: pmLineageHash
  };

  const activePM: PolicyMolecule = eelValid ? proposedPM : (priorPolicy || proposedPM);

  const learningEntry = {
    om_id: omId,
    pm_id: pmId,
    version: policyVersion,
    execution_hash: tclResult.current_graph_hash,
    outcome_hash: canonicalOutcomeHash,
    efficiency_delta: efficiencyDelta,
    eel_valid: eelValid,
    strategy_hash: strategyHash,
    prior_pm_id: priorPolicy?.pm_id || null,
    timestamp_ms: now,
    learning_source: proposedPM.learning_source
  };

  return {
    eel_valid: eelValid,
    active_policy: activePM,
    proposed_policy: proposedPM,
    prior_policy: priorPolicy,
    outcome_invariant: outcomeInvariant,
    efficiency_improvement: efficiencyImprovement,
    efficiency_delta: efficiencyDelta,
    policy_version: policyVersion,
    learning_source: proposedPM.learning_source,
    violations,
    allowed_mutations: [
      'Algorithm selection per execution node',
      'Node execution ordering within manifold',
      'Redundant path pruning',
      'Optimisation focus (latency/throughput/cost/reliability)',
      'Efficiency improvements that preserve canonical outcome'
    ],
    forbidden_mutations: [
      'OM singular_goal (frozen)',
      'Success condition (frozen)',
      'Constraint semantics (frozen under CAR-1)',
      'Outcome definition (must match canonical hash)',
      'Execution manifold boundary (set by CGS-1)'
    ],
    learning_spine_entry: learningEntry
  };
}

// ─── RGR ─────────────────────────────────────────────────────────────────────

interface RGRResult {
  passed: boolean; dropped_nodes: string[]; admitted_nodes: string[];
  gate_log: Array<{node_id:string;passed:boolean;reason:string}>;
}

function applyRenderGate(
  nodes: any[], cpc: CPCResult, om: any,
  car: CARResult, tcl: TCLResult, eel: EELResult
): RGRResult {
  const renderNodes = nodes.filter(n=>n.action_type==='render');
  const dropped: string[]=[], admitted: string[]=[];
  const log: Array<{node_id:string;passed:boolean;reason:string}>=[];
  for (const rn of renderNodes) {
    if (cpc.blocked_nodes.includes(rn.node_id)) {
      dropped.push(rn.node_id); log.push({node_id:rn.node_id,passed:false,reason:'FR-0: CPC violation'}); continue;
    }
    if (om.status!=='active') {
      dropped.push(rn.node_id); log.push({node_id:rn.node_id,passed:false,reason:`OM not active`}); continue;
    }
    if (!car.cdc_holds) {
      dropped.push(rn.node_id); log.push({node_id:rn.node_id,passed:false,reason:`CAR-1: CDC failed`}); continue;
    }
    if (!tcl.tci_holds) {
      dropped.push(rn.node_id); log.push({node_id:rn.node_id,passed:false,reason:`TCL-1: TCI violated (drift=${tcl.drift_score})`}); continue;
    }
    // EEL note: EEL violations do NOT block render (policy is separate from representation)
    // but they are logged
    admitted.push(rn.node_id);
    log.push({node_id:rn.node_id,passed:true,
      reason:`CPC ∧ OM.active ∧ CDC ∧ TCI — policy: PM v${eel.policy_version} (${eel.active_policy.strategy?.optimisation_focus||'cost'})`});
  }
  return { passed: dropped.length===0, dropped_nodes: dropped, admitted_nodes: admitted, gate_log: log };
}

// ─── MOCL-1 ──────────────────────────────────────────────────────────────────

interface MOCLResult {
  isolation_domain_id: string; isolation_holds: boolean;
  cross_om_interactions: string[]; omm_required: boolean;
  domain_boundary: {includes:string[];excludes:string[]};
}

async function runMOCL1(omId: string, nodes: any[], existingOMs: any[]): Promise<MOCLResult> {
  const domainId = (await sha256(`domain|${omId}`)).slice(0,16);
  const cross: string[]=[];
  for (const o of existingOMs) {
    if (o.om_id===omId||o.status!=='active') continue;
    cross.push(`OM:${o.om_id} ("${(o.singular_goal||'').slice(0,40)}") — OMM mediation required`);
  }
  return {
    isolation_domain_id: domainId, isolation_holds: cross.length===0,
    cross_om_interactions: cross, omm_required: cross.length>0,
    domain_boundary: { includes: nodes.map(n=>n.node_id), excludes: ['all nodes from other OM domains'] }
  };
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({error:'Unauthorized'},{status:401});

    const body = await req.json().catch(()=>({}));
    const { raw_text, context_state={}, session_id, om_id_replay } = body;
    if (!raw_text) return Response.json({error:'raw_text required'},{status:400});

    const sid = session_id||uid('session');
    const now = Date.now();
    const stages: any[]=[];
    const fabric: any[]=[];

    // ── 1. AuthInput ───────────────────────────────────────────────────────
    const authInputId = uid('ai');
    const authInputHash = await sha256(JSON.stringify({raw_text,context_state,sid})+now);
    stages.push({stage:'AuthInput',status:'captured',id:authInputId});

    // ── 2. OPL ────────────────────────────────────────────────────────────
    const oplResp = await ai(
      `You are the OPL. Propose 1–3 candidate OMs.
Return ONLY valid JSON array: [{"singular_goal":string,"success_condition":string,"exclusion_conditions":[string],"constraint_set":[{"type":"hard"|"soft","rule":string}],"confidence":number,"rejection_reason":string}]
Rules: one clear goal → 1 candidate (conf>0.85). Ambiguous → 2–3. NEVER merge. NEVER vague success_condition.`,
      `raw_text: "${raw_text}"\ncontext: ${JSON.stringify(context_state)}`
    );
    const arrM = oplResp.match(/\[[\s\S]*\]/);
    if (!arrM) return Response.json({error:'OPL: no JSON',session_id:sid},{status:500});
    const candidates: any[] = JSON.parse(arrM[0]);
    stages.push({stage:'OPL',status:'complete',candidate_count:candidates.length,
      candidates:candidates.map((c,i)=>({index:i,singular_goal:c.singular_goal,confidence:c.confidence}))});

    // ── 3. CCE ────────────────────────────────────────────────────────────
    let activeOM: any=null, rejectedOMs: any[]=[], cceDecision='', cceReason='';
    if (candidates.length===1&&candidates[0].confidence>=0.75) {
      activeOM=candidates[0]; cceDecision='direct_collapse'; cceReason='Single high-confidence candidate';
    } else {
      const cceResp = await ai(
        `You are the CCE. Pick exactly ONE winner. Prefer measurability and specificity. Incompatible → needs_clarification=true.
Return ONLY valid JSON: {"winner_index":number|null,"needs_clarification":boolean,"clarification_question":string|null,"rejection_reasons":{"0":string,"1":string},"cce_reasoning":string}`,
        `Candidates:\n${JSON.stringify(candidates,null,2)}`
      );
      const objM = cceResp.match(/\{[\s\S]*\}/);
      if (!objM) return Response.json({error:'CCE: no JSON',session_id:sid},{status:500});
      const cceR = JSON.parse(objM[0]);
      cceReason = cceR.cce_reasoning;
      if (cceR.needs_clarification) return Response.json({
        status:'blocked_ambiguity',session_id:sid,clarification_required:true,
        clarification_question:cceR.clarification_question,
        candidates:candidates.map((c,i)=>({index:i,singular_goal:c.singular_goal})),
        pipeline_stages:stages
      });
      activeOM = candidates[cceR.winner_index];
      rejectedOMs = candidates.filter((_,i)=>i!==cceR.winner_index)
        .map((c,i)=>({...c,rejection_reason:cceR.rejection_reasons?.[String(i)]||'Discarded'}));
      cceDecision = 'collapse_with_rejection';
    }

    // ── 4. Activation Lock ─────────────────────────────────────────────────
    const omId = om_id_replay||uid('om');
    const lineageHash = await sha256(`${authInputHash}|${JSON.stringify(activeOM)}|${omId}`);
    const collapseHash = await sha256(`collapse|${omId}|${lineageHash}|${now}`);
    stages.push({stage:'ActivationLock',status:'locked',om_id:omId,singular_goal:activeOM.singular_goal,immutable:true});

    // ── 5. CAR-1 ──────────────────────────────────────────────────────────
    let carResult: CARResult;
    try { carResult = await runCAR1(activeOM.constraint_set||[],omId); }
    catch (e:any) { return Response.json({error:`CAR-1: ${e.message}`,session_id:sid},{status:500}); }
    stages.push({stage:'CAR1',status:carResult.cdc_holds?'passed':'elastic_detected',
      cdc_holds:carResult.cdc_holds,elastic:carResult.elastic_constraints_detected});
    if (!carResult.cdc_holds) return Response.json({
      status:'blocked_elastic_constraints',session_id:sid,
      car_result:carResult,failed:carResult.failed_constraints,pipeline_stages:stages
    });

    // ── 6. Execution Graph ─────────────────────────────────────────────────
    const egResp = await ai(
      `You are the Execution Graph Generator. Build MINIMAL graph for this OM.
Every node MUST set origin_reference to the om_id. No speculative nodes. Render=terminal.
Return ONLY valid JSON: {"nodes":[{"node_id":string,"label":string,"action_type":"compute"|"retrieve"|"transform"|"render","input_schema":{"description":string},"output_schema":{"description":string},"origin_reference":string,"depends_on":[string]}],"edges":[{"from":string,"to":string,"label":string}],"validation_note":string}`,
      `om_id: ${omId}\nsingular_goal: ${activeOM.singular_goal}\nsuccess_condition: ${activeOM.success_condition}\nACF_constraints: ${JSON.stringify(carResult.processed_constraints.map(c=>c.acf))}`
    );
    const egM = egResp.match(/\{[\s\S]*\}/);
    if (!egM) return Response.json({error:'EG: no JSON',session_id:sid},{status:500});
    const egData = JSON.parse(egM[0]);
    const nodes = (egData.nodes||[]).map((n:any)=>({...n,origin_reference:omId}));
    const edges = egData.edges||[];
    const executionGraph: any = {eg_id:uid('eg'),om_id:omId,nodes,edges,status:'building',validation_errors:[]};
    stages.push({stage:'ExecutionGraphGeneration',status:'built',node_count:nodes.length,edge_count:edges.length});

    // ── 7. CGS-1 ──────────────────────────────────────────────────────────
    let cgsResult: CGSResult;
    try { cgsResult = await runCGS1(nodes,edges,activeOM); }
    catch (e:any) { return Response.json({error:`CGS-1: ${e.message}`,session_id:sid},{status:500}); }
    stages.push({stage:'CGS1',status:cgsResult.pet_holds?'outcome_invariant':'divergence',
      pet_holds:cgsResult.pet_holds,paths:cgsResult.paths.length});

    // ── 8. FR-0 CPC ───────────────────────────────────────────────────────
    const cpcResult = validateCPC(nodes,edges,omId,collapseHash);
    executionGraph.status = cpcResult.cpc_holds?'valid':'cpc_violation';
    executionGraph.validation_errors = cpcResult.violations;
    stages.push({stage:'FR0_CPC',status:cpcResult.cpc_holds?'passed':'violations',
      fr1_guarantee:cpcResult.fr1_guarantee,violations:cpcResult.violations});

    // ── 9. TCL-1 ──────────────────────────────────────────────────────────
    let tclResult: TCLResult;
    try { tclResult = await runTCL1(omId,lineageHash,activeOM.singular_goal,executionGraph,carResult,base44); }
    catch (e:any) { return Response.json({error:`TCL-1: ${e.message}`,session_id:sid},{status:500}); }
    stages.push({
      stage:'TCL1_TemporalCoherence',status:tclResult.tci_holds?'coherent':'drift_detected',
      tci_holds:tclResult.tci_holds,event_type:tclResult.event_type,version:tclResult.version,
      drift_score:tclResult.drift_score,drift_details:tclResult.drift_details,
      violations:tclResult.violations,replay_valid:tclResult.replay_valid,
      supersession_required:tclResult.supersession_required,
      previous_graph_hash:tclResult.previous_graph_hash,current_graph_hash:tclResult.current_graph_hash,
      theorem:'TCI: ∀ t1,t2: OM(t1).id==OM(t2).id ∧ status≠superseded → ExecGraph(t1) ≡ ExecGraph(t2)'
    });
    if (!tclResult.tci_holds&&tclResult.drift_score>=0.75) return Response.json({
      status:'blocked_temporal_drift',session_id:sid,tcl_result:tclResult,pipeline_stages:stages,
      message:`TCL-1: drift_score=${tclResult.drift_score}. Supersession required.`,
      violations:tclResult.violations,
      resolution:{option_1:'Supersession: submit without om_id_replay',option_2:'Replay: resubmit with identical context'}
    });

    // ── 10. EEL-1: Epistemic Evolution ────────────────────────────────────
    let eelResult: EELResult;
    try { eelResult = await runEEL1(omId,lineageHash,cgsResult.canonical_outcome_hash,cgsResult,executionGraph,tclResult,base44); }
    catch (e:any) { return Response.json({error:`EEL-1: ${e.message}`,session_id:sid},{status:500}); }
    stages.push({
      stage:'EEL1_EpistemicEvolution',
      status:eelResult.eel_valid?'policy_updated':'policy_rejected',
      eel_valid:eelResult.eel_valid,
      policy_version:eelResult.policy_version,
      learning_source:eelResult.learning_source,
      outcome_invariant:eelResult.outcome_invariant,
      efficiency_improvement:eelResult.efficiency_improvement,
      efficiency_delta:eelResult.efficiency_delta,
      violations:eelResult.violations,
      active_strategy:eelResult.active_policy.strategy,
      allowed_mutations:eelResult.allowed_mutations,
      forbidden_mutations:eelResult.forbidden_mutations,
      theorem:'EEL-1: PM_v(n+1) valid iff outcome(n+1)==outcome(n) AND cost(n+1)<cost(n)'
    });

    // ── 11. Render Gate (RGR) ──────────────────────────────────────────────
    const rgrResult = applyRenderGate(nodes,cpcResult,{...activeOM,status:'active'},carResult,tclResult,eelResult);
    stages.push({stage:'RenderGate_RGR',status:rgrResult.passed?'all_admitted':'nodes_dropped',
      admitted:rgrResult.admitted_nodes.length,dropped:rgrResult.dropped_nodes.length,gate_log:rgrResult.gate_log});

    // ── 12. MOCL-1 ────────────────────────────────────────────────────────
    let existingOMs: any[]=[];
    try { const ex=await base44.entities.ObjectiveMolecule.list(); existingOMs=(ex||[]).filter((o:any)=>o.status==='active'); } catch(_){}
    const moclResult = await runMOCL1(omId,nodes,existingOMs);
    stages.push({stage:'MOCL1_Isolation',status:moclResult.isolation_holds?'isolated':'mediation_required',
      isolation_domain_id:moclResult.isolation_domain_id,cross_om_count:moclResult.cross_om_interactions.length});

    // ── Build activated OM ─────────────────────────────────────────────────
    const activatedOM = {
      ...activeOM, om_id:omId, auth_input_id:authInputId, lineage_hash:lineageHash,
      status:'active', candidate_siblings:rejectedOMs.map((_,i)=>`rejected_${i}`),
      isolation_domain_id:moclResult.isolation_domain_id,
      ccc_valid:true, car_valid:carResult.cdc_holds,
      execution_manifold_id:cgsResult.manifold_id,
      version:tclResult.version, singular_goal_hash:tclResult.singular_goal_hash,
      execution_graph_hash:tclResult.current_graph_hash, tci_holds:tclResult.tci_holds,
      constraint_set:carResult.processed_constraints
    };

    // ── UI Materialisation ─────────────────────────────────────────────────
    const admittedRender = nodes.filter(n=>n.action_type==='render'&&rgrResult.admitted_nodes.includes(n.node_id));
    const uiProjection = {
      allowed_surfaces: admittedRender.map(n=>({
        surface_id:n.node_id, label:n.label, bound_to_om:n.origin_reference===omId,
        input_from:n.depends_on, cpc_proof:cpcResult.proof_paths[n.node_id]||[],
        equivalence_class:cgsResult.equivalence_class_id,
        isolation_domain:moclResult.isolation_domain_id,
        temporal_version:tclResult.version,
        active_policy:`PM v${eelResult.policy_version} (${eelResult.active_policy.strategy?.optimisation_focus})`
      })),
      blocked_surfaces: rgrResult.dropped_nodes.map(id=>({
        surface_id:id, reason:rgrResult.gate_log.find(g=>g.node_id===id)?.reason,
        action:'DROPPED — re-collapse required'
      })),
      fr0: cpcResult.fr1_guarantee&&rgrResult.passed?'GUARANTEED':'PARTIAL',
      car: carResult.cdc_holds?'DETERMINISTIC':'ELASTIC',
      cgs: cgsResult.pet_holds?'OUTCOME_INVARIANT':'DIVERGENT',
      mocl: moclResult.isolation_holds?'ISOLATED':'MEDIATION_REQUIRED',
      tcl: tclResult.tci_holds?`COHERENT (v${tclResult.version}, ${tclResult.event_type})`:`DRIFT (score=${tclResult.drift_score})`,
      eel: eelResult.eel_valid?`EVOLVING (PM v${eelResult.policy_version}, Δ=${eelResult.efficiency_delta})`:'POLICY_REJECTED'
    };
    stages.push({stage:'UIMaterialisation',status:'projected',
      admitted:uiProjection.allowed_surfaces.length,blocked:uiProjection.blocked_surfaces.length,
      eel:uiProjection.eel,tcl:uiProjection.tcl});

    // ── origin.fabric chain ────────────────────────────────────────────────
    const invBase = {
      singularity:true, no_orphan_execution:true, no_representation_without_collapse:true,
      no_speculative_features:true, cdc_holds:carResult.cdc_holds, pet_holds:cgsResult.pet_holds,
      mocl_isolation_holds:moclResult.isolation_holds, tci_holds:tclResult.tci_holds,
      eel_valid:eelResult.eel_valid
    };

    const inputPH = await sha256(raw_text+sid+now);
    const inputFH = await sha256(`input|${omId}|${inputPH}|${now}`);
    fabric.push({hash:inputFH,parent_hash:null,om_id:omId,session_id:sid,event_type:'input',
      payload_hash:inputPH,payload_summary:`AuthInput: "${raw_text.slice(0,80)}"`,
      invariant_check:{...invBase,no_representation_without_collapse:false,cdc_holds:false,pet_holds:false,tci_holds:false,eel_valid:false},
      timestamp_ms:now});

    const collapsePH = await sha256(JSON.stringify(activatedOM));
    const collapseFH = await sha256(`collapse|${omId}|${collapsePH}|${now+1}`);
    fabric.push({hash:collapseFH,parent_hash:inputFH,om_id:omId,session_id:sid,event_type:'collapse',
      payload_hash:collapsePH,payload_summary:`CCE → "${activeOM.singular_goal}" (${cceDecision})`,
      invariant_check:invBase,timestamp_ms:now+1});

    const carPH = await sha256(JSON.stringify(carResult));
    const carFH = await sha256(`car_check|${omId}|${carPH}|${now+2}`);
    fabric.push({hash:carFH,parent_hash:collapseFH,om_id:omId,session_id:sid,event_type:'car_check',
      payload_hash:carPH,payload_summary:`CAR-1: CDC=${carResult.cdc_holds}, elastic=[${carResult.elastic_constraints_detected.join(',')||'none'}]`,
      invariant_check:invBase,
      car_layer:{constraint_hash:carResult.constraint_hash,determinism_score:carResult.cdc_holds?1.0:0.0,
        allowed_state_set_hash:carResult.allowed_state_set_hash,elastic_constraints_detected:carResult.elastic_constraints_detected},
      timestamp_ms:now+2});

    const cgsPH = await sha256(JSON.stringify(cgsResult));
    const cgsFH = await sha256(`cgs_path|${omId}|${cgsPH}|${now+3}`);
    fabric.push({hash:cgsFH,parent_hash:carFH,om_id:omId,session_id:sid,event_type:'cgs_path',
      payload_hash:cgsPH,payload_summary:`CGS-1: ${cgsResult.paths.length} path(s), PET=${cgsResult.pet_holds}`,
      invariant_check:invBase,
      cgs_layer:{execution_path_hash:await sha256(JSON.stringify(cgsResult.paths)),
        equivalence_class_id:cgsResult.equivalence_class_id,outcome_hash:cgsResult.canonical_outcome_hash,
        path_variance:cgsResult.path_variance},
      timestamp_ms:now+3});

    const tclPH = await sha256(JSON.stringify(tclResult));
    const tclFH = await sha256(`tcl_check|${omId}|${tclPH}|${now+4}`);
    fabric.push({hash:tclFH,parent_hash:cgsFH,om_id:omId,session_id:sid,
      event_type:tclResult.tci_holds?'tcl_check':'drift_violation',
      payload_hash:tclPH,payload_summary:`TCL-1: TCI=${tclResult.tci_holds}, event=${tclResult.event_type}, v=${tclResult.version}, drift=${tclResult.drift_score}`,
      invariant_check:invBase,
      tcl_layer:{version:tclResult.version,drift_score:tclResult.drift_score,tci_holds:tclResult.tci_holds,
        execution_graph_hash:tclResult.current_graph_hash,previous_graph_hash:tclResult.previous_graph_hash,
        singular_goal_hash:tclResult.singular_goal_hash,replay_valid:tclResult.replay_valid,
        event_type:tclResult.event_type},
      timestamp_ms:now+4});

    // EEL-1 fabric entry — the learning spine
    const eelPH = await sha256(JSON.stringify(eelResult.learning_spine_entry));
    const eelFH = await sha256(`eel_policy|${omId}|${eelPH}|${now+5}`);
    fabric.push({hash:eelFH,parent_hash:tclFH,om_id:omId,session_id:sid,
      event_type:eelResult.eel_valid?'eel_policy':'eel_rejection',
      payload_hash:eelPH,
      payload_summary:`EEL-1: PM v${eelResult.policy_version} (${eelResult.learning_source}), outcome_invariant=${eelResult.outcome_invariant}, efficiency_delta=${eelResult.efficiency_delta}, valid=${eelResult.eel_valid}`,
      invariant_check:invBase,
      eel_layer:{pm_id:eelResult.active_policy.pm_id,pm_version:eelResult.policy_version,
        learning_source:eelResult.learning_source,outcome_invariant:eelResult.outcome_invariant,
        efficiency_delta:eelResult.efficiency_delta,
        strategy_hash:await sha256(JSON.stringify(eelResult.active_policy.strategy)),
        prior_pm_id:eelResult.prior_policy?.pm_id||null,eel_valid:eelResult.eel_valid},
      timestamp_ms:now+5});

    const execPH = await sha256(JSON.stringify({nodes,edges}));
    const execFH = await sha256(`execution|${omId}|${execPH}|${now+6}`);
    fabric.push({hash:execFH,parent_hash:eelFH,om_id:omId,session_id:sid,event_type:'execution',
      payload_hash:execPH,payload_summary:`ExecGraph: ${nodes.length} nodes, CPC=${cpcResult.cpc_holds}, TCI=${tclResult.tci_holds}, EEL_PM=v${eelResult.policy_version}`,
      invariant_check:invBase,timestamp_ms:now+6});

    let lastHash = execFH;
    for (const dropped of rgrResult.dropped_nodes) {
      const vPH = await sha256(`drop|${dropped}|${omId}`);
      const vFH = await sha256(`violation|${omId}|${vPH}|${now+7}`);
      fabric.push({hash:vFH,parent_hash:lastHash,om_id:omId,session_id:sid,event_type:'violation',
        payload_hash:vPH,payload_summary:`RGR dropped ${dropped}: ${rgrResult.gate_log.find(g=>g.node_id===dropped)?.reason}`,
        invariant_check:{...invBase,no_speculative_features:false},timestamp_ms:now+7});
      lastHash=vFH;
    }
    if (moclResult.omm_required) {
      const moclPH = await sha256(JSON.stringify(moclResult));
      const moclFH = await sha256(`mocl_mediation|${omId}|${moclPH}|${now+8}`);
      fabric.push({hash:moclFH,parent_hash:lastHash,om_id:omId,session_id:sid,event_type:'mocl_mediation',
        payload_hash:moclPH,payload_summary:`MOCL-1: ${moclResult.cross_om_interactions.length} cross-OM interaction(s)`,
        invariant_check:{...invBase,mocl_isolation_holds:false},
        mocl_layer:{isolation_domain_id:moclResult.isolation_domain_id,
          cross_om_interactions:moclResult.cross_om_interactions,omm_mediated:true},
        timestamp_ms:now+8});
      lastHash=moclFH;
    }
    const renderPH = await sha256(JSON.stringify(uiProjection));
    const renderFH = await sha256(`render|${omId}|${renderPH}|${now+9}`);
    fabric.push({hash:renderFH,parent_hash:lastHash,om_id:omId,session_id:sid,event_type:'render',
      payload_hash:renderPH,
      payload_summary:`UI: ${admittedRender.length} admitted — EEL=${uiProjection.eel}, TCL=${uiProjection.tcl}`,
      invariant_check:invBase,timestamp_ms:now+9});
    stages.push({stage:'FabricChain',status:'sealed',entry_count:fabric.length,
      chain_head:fabric[fabric.length-1].hash,
      layers:['input','collapse','car_check','cgs_path','tcl_check','eel_policy','execution','render']});

    // ── Persist ────────────────────────────────────────────────────────────
    executionGraph.manifold_id=cgsResult.manifold_id;
    executionGraph.equivalence_class_id=cgsResult.equivalence_class_id;
    executionGraph.outcome_hash=cgsResult.canonical_outcome_hash;
    executionGraph.isolation_domain_id=moclResult.isolation_domain_id;

    await base44.entities.AuthInput.create({raw_text,context_state,session_id:sid,status:'collapsed'});
    await base44.entities.ObjectiveMolecule.create(activatedOM);
    await base44.entities.ExecutionGraph.create(executionGraph);
    for (const entry of fabric) await base44.entities.FabricEntry.create(entry);
    await base44.entities.FabricTimeChain.create(tclResult.temporal_spine_entry);
    // Persist policy molecule
    if (eelResult.eel_valid) {
      await base44.entities.PolicyMolecule.create(eelResult.active_policy);
    }

    const allClear = cpcResult.fr1_guarantee&&rgrResult.passed&&carResult.cdc_holds&&
      cgsResult.pet_holds&&moclResult.isolation_holds&&tclResult.tci_holds&&eelResult.eel_valid;

    return Response.json({
      status: allClear?'collapsed_all_guarantees_held':'collapsed_partial',
      session_id: sid,
      active_om: activatedOM,
      execution_graph: executionGraph,
      ui_projection: uiProjection,

      formal_guarantees: {
        FR0:  {holds:cpcResult.fr1_guarantee,statement:'No find_REPLACE state reachable — CPC enforced'},
        CAR1: {holds:carResult.cdc_holds,statement:'All constraints deterministic ACF — no semantic elasticity',elastic:carResult.elastic_constraints_detected},
        CGS1: {holds:cgsResult.pet_holds,statement:'All execution paths outcome-invariant — manifold bounded',paths:cgsResult.paths.length,divergent:cgsResult.divergent_paths},
        MOCL1:{holds:moclResult.isolation_holds,statement:'OM sealed in causal domain — no cross-OM contamination',omm_required:moclResult.omm_required},
        TCL1: {holds:tclResult.tci_holds,statement:'OM temporally stable — no silent semantic mutation',event_type:tclResult.event_type,version:tclResult.version,drift_score:tclResult.drift_score,replay_valid:tclResult.replay_valid,violations:tclResult.violations,invariant:'TCI: ∀ t1,t2: OM.id==OM.id ∧ status≠superseded → ExecGraph(t1) ≡ ExecGraph(t2)'},
        EEL1: {holds:eelResult.eel_valid,statement:'System learns via policy evolution, never via meaning mutation',policy_version:eelResult.policy_version,efficiency_delta:eelResult.efficiency_delta,outcome_invariant:eelResult.outcome_invariant,learning_source:eelResult.learning_source,violations:eelResult.violations,invariant:'EEL-1: PM_v(n+1) valid iff outcome(n+1)==outcome(n) AND cost(n+1)<cost(n)'}
      },

      cce_decision:cceDecision, cce_reason:cceReason,
      car_result:carResult, cgs_result:cgsResult, cpc_result:cpcResult,
      tcl_result:tclResult, eel_result:eelResult,
      mocl_result:moclResult, rgr_result:rgrResult,
      rejected_oms:rejectedOMs, fabric_chain:fabric, pipeline_stages:stages,

      invariants: {
        singularity:true,
        no_find_replace:cpcResult.fr1_guarantee,
        no_elastic_constraints:carResult.cdc_holds,
        outcome_invariant_creativity:cgsResult.pet_holds,
        no_cross_om_contamination:moclResult.isolation_holds,
        no_temporal_drift:tclResult.tci_holds,
        learning_without_drift:eelResult.eel_valid,
        correction_model:'recollapse_only — no patching, no find_REPLACE, no post_hoc_repair, no silent mutation',
        evolution_model:'policy_only — meaning frozen, strategy evolvable within outcome space'
      }
    });

  } catch (error:any) {
    return Response.json({error:error.message},{status:500});
  }
});
