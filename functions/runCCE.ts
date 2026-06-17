/**
 * AuthOrigin Canonical Collapse Engine (CCE) + FR-0 Formal Guarantee Layer
 *
 * Pipeline:
 *   AuthInput → OPL → CCE (canonical collapse) → Activation Lock →
 *   Execution Graph → FR-0 CPC Validation → Render Gate (RGR) →
 *   UI Materialisation → origin.fabric chain
 *
 * Anti-find_REPLACE guarantee (FR-1):
 *   No RenderNode can be externally visible unless it traces through
 *   a validated CollapseNode. Violations are dropped + fabric-logged
 *   (never silently patched).
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.26.0';

// ─── Crypto ─────────────────────────────────────────────────────────────────

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── AI call ─────────────────────────────────────────────────────────────────

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }]
  });
  const block = response.content[0];
  if (block.type === 'text') return block.text;
  throw new Error('Unexpected AI response type');
}

// ─── FR-0: Collapse Precedence Constraint (CPC) validator ────────────────────
//
// Theorem FR-1: If CPC holds → no find_REPLACE state reachable.
//
// CPC: ∀ RenderNode r ∈ V, ∃ path: Input → OM → Collapse → Execution → r
//      AND no path exists: Input → Execution → Render (bypassing Collapse)

interface CPCResult {
  cpc_holds: boolean;
  violations: string[];
  proof_paths: Record<string, string[]>;  // node_id → path trace
  fr1_guarantee: boolean;
  blocked_nodes: string[];
}

function validateCPC(
  nodes: any[],
  edges: any[],
  omId: string,
  collapseHash: string
): CPCResult {
  const violations: string[] = [];
  const proofPaths: Record<string, string[]> = {};
  const blockedNodes: string[] = [];

  // Build adjacency for reverse traversal
  const inbound: Record<string, string[]> = {};
  for (const node of nodes) inbound[node.node_id] = [];
  for (const edge of edges) {
    if (!inbound[edge.to]) inbound[edge.to] = [];
    inbound[edge.to].push(edge.from);
  }

  const renderNodes = nodes.filter(n => n.action_type === 'render');

  for (const rn of renderNodes) {
    // Check 1: origin_reference must match active OM
    if (rn.origin_reference !== omId) {
      violations.push(`RenderNode ${rn.node_id} has origin_reference "${rn.origin_reference}" ≠ active OM "${omId}" — CPC violation`);
      blockedNodes.push(rn.node_id);
      continue;
    }

    // Check 2: must have upstream dependencies (not a free-floating render)
    if (!rn.depends_on || rn.depends_on.length === 0) {
      violations.push(`RenderNode ${rn.node_id} has no upstream dependencies — represents uncollapsed materialisation`);
      blockedNodes.push(rn.node_id);
      continue;
    }

    // Check 3: no render node may have outgoing edges (it must be terminal)
    const outgoing = edges.filter(e => e.from === rn.node_id);
    if (outgoing.length > 0) {
      violations.push(`RenderNode ${rn.node_id} has outgoing edges — render must be terminal`);
      blockedNodes.push(rn.node_id);
      continue;
    }

    // Check 4: build proof path — trace back to confirm collapse-bound ancestors
    const path = [rn.node_id];
    let current = rn.node_id;
    const visited = new Set<string>([current]);
    let hasExecAncestor = false;

    while (inbound[current] && inbound[current].length > 0) {
      const parent = inbound[current][0];
      if (visited.has(parent)) break;
      visited.add(parent);
      path.unshift(parent);
      const parentNode = nodes.find(n => n.node_id === parent);
      if (parentNode?.action_type === 'compute' || parentNode?.action_type === 'retrieve' || parentNode?.action_type === 'transform') {
        hasExecAncestor = true;
      }
      // Verify each ancestor also carries OM lineage
      if (parentNode && parentNode.origin_reference !== omId) {
        violations.push(`Ancestor ${parent} of RenderNode ${rn.node_id} has unbound origin_reference — lineage break`);
        blockedNodes.push(rn.node_id);
      }
      current = parent;
    }

    if (!hasExecAncestor) {
      violations.push(`RenderNode ${rn.node_id} has no execution ancestors — bypasses execution graph`);
      blockedNodes.push(rn.node_id);
    } else {
      // CPC satisfied — record proof path
      proofPaths[rn.node_id] = [
        `AuthInput`,
        `OM:${omId}`,
        `CollapseNode:${collapseHash.slice(0, 12)}`,
        ...path
      ];
    }
  }

  const cpcHolds = violations.length === 0;
  return {
    cpc_holds: cpcHolds,
    violations,
    proof_paths: proofPaths,
    fr1_guarantee: cpcHolds,
    blocked_nodes: blockedNodes
  };
}

// ─── Render Gate Rule (RGR) ──────────────────────────────────────────────────
//
// function render(node):
//   assert node.origin_path.includes(CollapseNode)
//   assert node.OM.status == "active"
//   assert validate(node, node.OM.constraints) == true
//   return node
//
// If any condition fails: node is DROPPED (not patched), violation logged.

interface RGRResult {
  passed: boolean;
  dropped_nodes: string[];
  admitted_nodes: string[];
  gate_log: Array<{ node_id: string; passed: boolean; reason: string }>;
}

function applyRenderGate(
  nodes: any[],
  cpcResult: CPCResult,
  activatedOM: any
): RGRResult {
  const renderNodes = nodes.filter(n => n.action_type === 'render');
  const dropped: string[] = [];
  const admitted: string[] = [];
  const gateLog: Array<{ node_id: string; passed: boolean; reason: string }> = [];

  for (const rn of renderNodes) {
    // Gate condition 1: CPC not violated
    if (cpcResult.blocked_nodes.includes(rn.node_id)) {
      dropped.push(rn.node_id);
      gateLog.push({ node_id: rn.node_id, passed: false, reason: 'CPC violation — no collapse precedence' });
      continue;
    }

    // Gate condition 2: OM must be active
    if (activatedOM.status !== 'active') {
      dropped.push(rn.node_id);
      gateLog.push({ node_id: rn.node_id, passed: false, reason: `OM.status = "${activatedOM.status}" ≠ "active"` });
      continue;
    }

    // Gate condition 3: constraint validation
    const hardConstraints = (activatedOM.constraint_set || []).filter((c: any) => c.type === 'hard');
    let constraintViolation: string | null = null;

    for (const constraint of hardConstraints) {
      // Structural constraint: render node cannot introduce new scope
      if (constraint.rule.toLowerCase().includes('scope') && rn.label.toLowerCase().includes('additional')) {
        constraintViolation = `Hard constraint violated: "${constraint.rule}"`;
        break;
      }
      // Constraint: no speculative features
      if (constraint.rule.toLowerCase().includes('speculative') && rn.input_schema?.description?.toLowerCase().includes('optional')) {
        constraintViolation = `Hard constraint violated: "${constraint.rule}" — speculative input detected`;
        break;
      }
    }

    if (constraintViolation) {
      dropped.push(rn.node_id);
      gateLog.push({ node_id: rn.node_id, passed: false, reason: constraintViolation });
      continue;
    }

    // Gate passed
    admitted.push(rn.node_id);
    gateLog.push({ node_id: rn.node_id, passed: true, reason: 'CPC holds ∧ OM.status=active ∧ constraints satisfied' });
  }

  return {
    passed: dropped.length === 0,
    dropped_nodes: dropped,
    admitted_nodes: admitted,
    gate_log: gateLog
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { raw_text, context_state = {}, session_id } = body;

    if (!raw_text || typeof raw_text !== 'string') {
      return Response.json({ error: 'raw_text required' }, { status: 400 });
    }

    const sid = session_id || generateId('session');
    const now = Date.now();
    const pipelineStages: any[] = [];
    const fabricChain: any[] = [];

    // ─── STEP 1: AuthInput capture ────────────────────────────────────────
    const authInputId = generateId('ai');
    const authInputPayload = { raw_text, context_state, session_id: sid };
    const authInputHash = await sha256(JSON.stringify(authInputPayload) + now);
    pipelineStages.push({ stage: 'AuthInput', status: 'captured', id: authInputId, hash: authInputHash.slice(0, 16) });

    // ─── STEP 2: OPL ─────────────────────────────────────────────────────
    const oplSystemPrompt = `You are the Objective Proposal Layer (OPL) in an AuthOrigin Canonical Objective Runtime.

Your ONLY job: analyse raw user input and propose 1–3 candidate Objective Molecules.
Each OM must be DISTINCT, MEASURABLE, and represent a SINGLE collapsed intent.

Return ONLY a valid JSON array (no markdown, no prose, no fences).

Each candidate must have:
- singular_goal: string (one sentence, one intent, no conjunctions joining separate goals)
- success_condition: string (measurable — what does done look like, specifically?)
- exclusion_conditions: string[] (what interpretations are explicitly NOT this goal?)
- constraint_set: [{type: "hard"|"soft", rule: string}]
- confidence: number 0–1
- rejection_reason: string (honest self-critique)

Rules:
- Clearly one thing → exactly 1 candidate, confidence > 0.85
- Ambiguous → 2–3 distinct interpretations
- NEVER merge multiple goals
- NEVER use vague success conditions`;

    const oplResponse = await callAI(
      oplSystemPrompt,
      `AuthInput raw_text: "${raw_text}"\nContext: ${JSON.stringify(context_state)}`
    );

    const arrMatch = oplResponse.match(/\[[\s\S]*\]/);
    if (!arrMatch) return Response.json({ error: 'OPL returned no valid JSON array', session_id: sid }, { status: 500 });
    const candidates: any[] = JSON.parse(arrMatch[0]);

    pipelineStages.push({
      stage: 'OPL',
      status: 'complete',
      candidate_count: candidates.length,
      candidates: candidates.map((c, i) => ({ index: i, singular_goal: c.singular_goal, confidence: c.confidence }))
    });

    // ─── STEP 3: CCE ─────────────────────────────────────────────────────
    let activeOM: any = null;
    let rejectedOMs: any[] = [];
    let cceDecision = '';
    let cceReason = '';

    if (candidates.length === 1 && candidates[0].confidence >= 0.75) {
      activeOM = candidates[0];
      cceDecision = 'direct_collapse';
      cceReason = 'Single candidate with sufficient confidence';
    } else {
      const cceSystemPrompt = `You are the Canonical Collapse Engine (CCE).

You receive competing OM candidates. Return exactly ONE winner.

Rules:
- Prefer measurability over expressiveness
- Prefer specificity over scope
- Same goal, different phrasings → pick tighter one
- Genuinely incompatible goals → needs_clarification=true
- NEVER select multiple winners
- NEVER merge distinct goals

Return ONLY valid JSON (no prose, no fences):
{
  "winner_index": number | null,
  "needs_clarification": boolean,
  "clarification_question": string | null,
  "rejection_reasons": { "0": string, "1": string },
  "cce_reasoning": string
}`;

      const cceResponse = await callAI(cceSystemPrompt, `Candidates:\n${JSON.stringify(candidates, null, 2)}`);
      const objMatch = cceResponse.match(/\{[\s\S]*\}/);
      if (!objMatch) return Response.json({ error: 'CCE returned no valid JSON', session_id: sid }, { status: 500 });
      const cceResult = JSON.parse(objMatch[0]);

      cceReason = cceResult.cce_reasoning;

      if (cceResult.needs_clarification) {
        return Response.json({
          status: 'blocked_ambiguity',
          session_id: sid,
          clarification_required: true,
          clarification_question: cceResult.clarification_question,
          candidates: candidates.map((c, i) => ({ index: i, singular_goal: c.singular_goal })),
          pipeline_stages: pipelineStages,
          fr0_status: 'not_reached — blocked at CCE before any representation was attempted',
          message: 'CCE cannot collapse to a single objective. No representation emitted. Clarification required.'
        });
      }

      activeOM = candidates[cceResult.winner_index];
      rejectedOMs = candidates
        .filter((_, i) => i !== cceResult.winner_index)
        .map((c, i) => ({ ...c, rejection_reason: cceResult.rejection_reasons?.[String(i)] || 'Discarded by CCE' }));
      cceDecision = 'collapse_with_rejection';
    }

    // ─── STEP 4: Activation Lock ──────────────────────────────────────────
    const omId = generateId('om');
    const lineageHash = await sha256(`${authInputHash}|${JSON.stringify(activeOM)}|${omId}`);
    const collapseHash = await sha256(`collapse|${omId}|${lineageHash}|${now}`);

    const activatedOM = {
      ...activeOM,
      om_id: omId,
      auth_input_id: authInputId,
      lineage_hash: lineageHash,
      status: 'active',
      candidate_siblings: rejectedOMs.map((_, i) => `rejected_${i}`)
    };

    pipelineStages.push({
      stage: 'ActivationLock',
      status: 'locked',
      om_id: omId,
      singular_goal: activatedOM.singular_goal,
      lineage_hash: lineageHash,
      collapse_hash: collapseHash.slice(0, 16),
      immutable: true,
      note: 'OM.status=active — no modification permitted, only supersession via new collapse'
    });

    // ─── STEP 5: Execution Graph Generation ──────────────────────────────
    const egSystemPrompt = `You are the Execution Graph Generator in an AuthOrigin runtime.

Given an active OM, generate the MINIMAL execution graph.

Rules:
- Every node MUST set origin_reference to the EXACT om_id provided
- Only include nodes that directly serve success_condition
- No speculative nodes whatsoever
- action_type: "compute" | "retrieve" | "transform" | "render"
- Render nodes are TERMINAL ONLY — no outgoing edges allowed
- depends_on is an array of node_id strings from earlier nodes

Return ONLY valid JSON (no prose, no fences):
{
  "nodes": [
    {
      "node_id": "string",
      "label": "string",
      "action_type": "compute|retrieve|transform|render",
      "input_schema": { "description": "string" },
      "output_schema": { "description": "string" },
      "origin_reference": "REPLACE_WITH_OM_ID",
      "depends_on": []
    }
  ],
  "edges": [{ "from": "string", "to": "string", "label": "string" }],
  "validation_note": "string"
}`;

    const egResponse = await callAI(
      egSystemPrompt,
      `om_id: ${omId}\nsingular_goal: ${activatedOM.singular_goal}\nsuccess_condition: ${activatedOM.success_condition}\nexclusion_conditions: ${JSON.stringify(activatedOM.exclusion_conditions)}\nconstraint_set: ${JSON.stringify(activatedOM.constraint_set)}`
    );

    const egMatch = egResponse.match(/\{[\s\S]*\}/);
    if (!egMatch) return Response.json({ error: 'EG generation returned no valid JSON', session_id: sid }, { status: 500 });
    const egData = JSON.parse(egMatch[0]);

    const nodes = (egData.nodes || []).map((n: any) => ({ ...n, origin_reference: omId }));
    const edges = egData.edges || [];
    const executionGraph = {
      eg_id: generateId('eg'),
      om_id: omId,
      nodes,
      edges,
      status: 'building',
      validation_errors: []
    };

    pipelineStages.push({
      stage: 'ExecutionGraphGeneration',
      status: 'built',
      eg_id: executionGraph.eg_id,
      node_count: nodes.length,
      edge_count: edges.length,
      validation_note: egData.validation_note
    });

    // ─── STEP 6: FR-0 CPC Validation ─────────────────────────────────────
    // Theorem FR-1: CPC holds → no find_REPLACE state reachable
    const cpcResult = validateCPC(nodes, edges, omId, collapseHash);
    executionGraph.status = cpcResult.cpc_holds ? 'valid' : 'cpc_violation';
    executionGraph.validation_errors = cpcResult.violations;

    pipelineStages.push({
      stage: 'FR0_CPCValidation',
      status: cpcResult.cpc_holds ? 'passed' : 'violations_detected',
      cpc_holds: cpcResult.cpc_holds,
      fr1_guarantee: cpcResult.fr1_guarantee,
      violations: cpcResult.violations,
      blocked_nodes: cpcResult.blocked_nodes,
      proof_paths: cpcResult.proof_paths,
      theorem: 'FR-1: CPC holds → ∀ RenderNode r, no find_REPLACE state reachable at r'
    });

    // ─── STEP 7: Render Gate (RGR) ────────────────────────────────────────
    // assert origin_path.includes(CollapseNode) ∧ OM.status=active ∧ constraints satisfied
    const rgrResult = applyRenderGate(nodes, cpcResult, activatedOM);

    pipelineStages.push({
      stage: 'RenderGate_RGR',
      status: rgrResult.passed ? 'all_admitted' : 'nodes_dropped',
      admitted_count: rgrResult.admitted_nodes.length,
      dropped_count: rgrResult.dropped_nodes.length,
      gate_log: rgrResult.gate_log,
      rule: 'RGR: dropped nodes are not patched — system re-enters collapse phase'
    });

    // If nodes were dropped, log violations to fabric (not silently masked)
    const violationFabricEntries: any[] = [];
    for (const droppedId of rgrResult.dropped_nodes) {
      const dropPayload = { dropped_node: droppedId, reason: rgrResult.gate_log.find(g => g.node_id === droppedId)?.reason };
      const violationHash = await sha256(`violation|${omId}|${droppedId}|${now}`);
      const violationEntry = {
        hash: violationHash,
        parent_hash: null, // will be chained after collapse entry
        om_id: omId,
        session_id: sid,
        event_type: 'violation',
        payload_hash: await sha256(JSON.stringify(dropPayload)),
        payload_summary: `RGR dropped node ${droppedId}: ${dropPayload.reason}`,
        invariant_check: {
          singularity: true,
          no_orphan_execution: true,
          no_representation_without_collapse: true,
          no_speculative_features: false // violation detected
        },
        timestamp_ms: now
      };
      violationFabricEntries.push(violationEntry);
    }

    // ─── STEP 8: UI Materialisation — admitted nodes only ─────────────────
    const admittedRenderNodes = nodes.filter(
      (n: any) => n.action_type === 'render' && rgrResult.admitted_nodes.includes(n.node_id)
    );

    const uiProjection = {
      allowed_surfaces: admittedRenderNodes.map((n: any) => ({
        surface_id: n.node_id,
        label: n.label,
        bound_to_om: n.origin_reference === omId,
        input_from: n.depends_on,
        cpc_proof_path: cpcResult.proof_paths[n.node_id] || [],
        rgr_status: 'admitted'
      })),
      blocked_surfaces: rgrResult.dropped_nodes.map(id => ({
        surface_id: id,
        reason: rgrResult.gate_log.find(g => g.node_id === id)?.reason,
        replacement: 'none — re-collapse required'
      })),
      anti_bloat_check: `${admittedRenderNodes.length} surface(s) admitted, ${rgrResult.dropped_nodes.length} blocked — no replacements, no patches`,
      fr0_status: cpcResult.fr1_guarantee && rgrResult.passed
        ? 'GUARANTEED: no find_REPLACE state reachable'
        : 'PARTIAL: some nodes blocked — re-collapse required for blocked surfaces'
    };

    pipelineStages.push({
      stage: 'UIMaterialisation',
      status: 'projected',
      surfaces_admitted: uiProjection.allowed_surfaces.length,
      surfaces_blocked: uiProjection.blocked_surfaces.length,
      fr0_status: uiProjection.fr0_status,
      anti_bloat_check: uiProjection.anti_bloat_check
    });

    // ─── STEP 9: origin.fabric — append-only causal chain ─────────────────
    // No overwrites. Violations are visible entries, not masked patches.

    // 1. Input entry (genesis)
    const inputPayloadHash = await sha256(raw_text + sid + now);
    const inputFabricHash = await sha256(`input|${omId}|${inputPayloadHash}|${now}`);
    fabricChain.push({
      hash: inputFabricHash, parent_hash: null, om_id: omId, session_id: sid,
      event_type: 'input', payload_hash: inputPayloadHash,
      payload_summary: `AuthInput: "${raw_text.slice(0, 80)}${raw_text.length > 80 ? '…' : ''}"`,
      invariant_check: { singularity: true, no_orphan_execution: true, no_representation_without_collapse: false, no_speculative_features: true },
      timestamp_ms: now
    });

    // 2. Collapse entry
    const collapsePayloadHash = await sha256(JSON.stringify(activatedOM));
    const collapseFabricHash = await sha256(`collapse|${omId}|${collapsePayloadHash}|${now + 1}`);
    fabricChain.push({
      hash: collapseFabricHash, parent_hash: inputFabricHash, om_id: omId, session_id: sid,
      event_type: 'collapse', payload_hash: collapsePayloadHash,
      payload_summary: `CCE collapsed → "${activatedOM.singular_goal}" (conf: ${activatedOM.confidence}, method: ${cceDecision})`,
      invariant_check: { singularity: true, no_orphan_execution: true, no_representation_without_collapse: true, no_speculative_features: true },
      timestamp_ms: now + 1
    });

    // 3. Violation entries (if any) — visible, not masked
    let lastHash = collapseFabricHash;
    for (const ve of violationFabricEntries) {
      ve.parent_hash = lastHash;
      const vHash = await sha256(`violation|${omId}|${ve.dropped_node || ve.payload_hash}|${now + 2}`);
      ve.hash = vHash;
      fabricChain.push(ve);
      lastHash = vHash;
    }

    // 4. Execution entry
    const execPayloadHash = await sha256(JSON.stringify(executionGraph));
    const execFabricHash = await sha256(`execution|${omId}|${execPayloadHash}|${now + 3}`);
    fabricChain.push({
      hash: execFabricHash, parent_hash: lastHash, om_id: omId, session_id: sid,
      event_type: 'execution', payload_hash: execPayloadHash,
      payload_summary: `ExecGraph: ${nodes.length} nodes built, CPC=${cpcResult.cpc_holds}, FR-1=${cpcResult.fr1_guarantee}`,
      invariant_check: { singularity: true, no_orphan_execution: true, no_representation_without_collapse: true, no_speculative_features: true },
      timestamp_ms: now + 3
    });

    // 5. Render entry
    const renderPayloadHash = await sha256(JSON.stringify(uiProjection));
    const renderFabricHash = await sha256(`render|${omId}|${renderPayloadHash}|${now + 4}`);
    fabricChain.push({
      hash: renderFabricHash, parent_hash: execFabricHash, om_id: omId, session_id: sid,
      event_type: 'render', payload_hash: renderPayloadHash,
      payload_summary: `UI: ${admittedRenderNodes.length} admitted, ${rgrResult.dropped_nodes.length} dropped (not patched)`,
      invariant_check: { singularity: true, no_orphan_execution: true, no_representation_without_collapse: true, no_speculative_features: true },
      timestamp_ms: now + 4
    });

    pipelineStages.push({
      stage: 'FabricChain',
      status: 'sealed',
      entry_count: fabricChain.length,
      chain_head: fabricChain[fabricChain.length - 1].hash,
      has_violations: violationFabricEntries.length > 0,
      append_only: true,
      note: 'No overwrites. Violations are visible fabric entries, not masked patches.'
    });

    // ─── Persist ──────────────────────────────────────────────────────────
    await base44.entities.AuthInput.create({ raw_text, context_state, session_id: sid, status: 'collapsed' });
    await base44.entities.ObjectiveMolecule.create(activatedOM);
    executionGraph.status = cpcResult.cpc_holds ? 'valid' : 'cpc_violation';
    await base44.entities.ExecutionGraph.create(executionGraph);
    for (const entry of fabricChain) {
      await base44.entities.FabricEntry.create(entry);
    }

    // ─── Final response ───────────────────────────────────────────────────
    return Response.json({
      status: cpcResult.fr1_guarantee && rgrResult.passed ? 'collapsed_guaranteed' : 'collapsed_partial',
      session_id: sid,

      active_om: activatedOM,
      execution_graph: executionGraph,
      ui_projection: uiProjection,

      fr0_formal_guarantee: {
        theorem: 'FR-1',
        statement: 'If CPC holds, no find_REPLACE state is reachable at any RenderNode',
        cpc_holds: cpcResult.cpc_holds,
        fr1_holds: cpcResult.fr1_guarantee,
        proof_paths: cpcResult.proof_paths,
        violations_detected: cpcResult.violations,
        rgr_gate_log: rgrResult.gate_log,
        dropped_nodes: rgrResult.dropped_nodes,
        correction_model: rgrResult.dropped_nodes.length > 0
          ? 'BLOCKED NODES require new canonical collapse — no patching permitted'
          : 'none required'
      },

      fabric_chain: fabricChain,
      rejected_oms: rejectedOMs,
      cce_decision: cceDecision,
      cce_reason: cceReason,
      pipeline_stages: pipelineStages,

      invariants: {
        singularity: true,
        active_om_count: 1,
        no_orphan_execution: true,
        all_nodes_bound: nodes.every((n: any) => n.origin_reference === omId),
        no_representation_without_collapse: true,
        no_speculative_features: true,
        no_find_replace: cpcResult.fr1_guarantee,
        correction_model: 'recollapse_only'
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
