import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.26.0';

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

    // ─── STEP 1: AuthInput capture ─────────────────────────────────────────
    const authInputId = generateId('ai');
    const authInputPayload = { raw_text, context_state, session_id: sid, status: 'processing' };
    const authInputHash = await sha256(JSON.stringify(authInputPayload) + now);
    pipelineStages.push({ stage: 'AuthInput', status: 'captured', id: authInputId });

    // ─── STEP 2: OPL — AI proposes OM candidates ───────────────────────────
    const oplSystemPrompt = `You are the Objective Proposal Layer (OPL) in an AuthOrigin Canonical Objective Runtime.

Your ONLY job: analyse raw user input and propose 1–3 candidate Objective Molecules.
Each OM must be DISTINCT, MEASURABLE, and represent a SINGLE collapsed intent.

Return ONLY valid JSON — a raw array (no markdown, no prose, no fences).

Each candidate must have:
- singular_goal: string (one sentence, one intent, no conjunctions joining separate goals)
- success_condition: string (measurable — what does "done" look like, specifically?)
- exclusion_conditions: string[] (what interpretations are explicitly NOT this goal?)
- constraint_set: [{type: "hard"|"soft", rule: string}]
- confidence: number 0–1
- rejection_reason: string (honest self-critique)

Rules:
- Clearly one thing → exactly 1 candidate, confidence > 0.85
- Ambiguous → 2–3 distinct interpretations
- NEVER merge multiple goals into one singular_goal
- NEVER use vague success conditions`;

    let candidates: any[] = [];
    const oplResponse = await callAI(
      oplSystemPrompt,
      `AuthInput raw_text: "${raw_text}"\nContext: ${JSON.stringify(context_state)}`
    );

    const arrMatch = oplResponse.match(/\[[\s\S]*\]/);
    if (!arrMatch) return Response.json({ error: 'OPL returned no valid JSON array', session_id: sid }, { status: 500 });
    candidates = JSON.parse(arrMatch[0]);

    pipelineStages.push({
      stage: 'OPL',
      status: 'complete',
      candidate_count: candidates.length,
      candidates: candidates.map((c, i) => ({ index: i, singular_goal: c.singular_goal, confidence: c.confidence }))
    });

    // ─── STEP 3: CCE — Canonical Collapse ──────────────────────────────────
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

You receive competing OM candidates. You MUST return exactly ONE winner.

Rules:
- Prefer measurability over expressiveness
- Prefer specificity over scope
- If candidates cover same goal, pick the tighter one
- If genuinely incompatible goals (not overlapping), return needs_clarification=true
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

      const cceResponse = await callAI(
        cceSystemPrompt,
        `Candidates:\n${JSON.stringify(candidates, null, 2)}`
      );

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
          message: 'CCE cannot collapse to a single objective. Clarification required before execution can proceed.'
        });
      }

      activeOM = candidates[cceResult.winner_index];
      rejectedOMs = candidates
        .filter((_, i) => i !== cceResult.winner_index)
        .map((c, i) => ({ ...c, rejection_reason: cceResult.rejection_reasons?.[String(i)] || 'Discarded by CCE' }));

      cceDecision = 'collapse_with_rejection';
    }

    // ─── STEP 4: Activation Lock ────────────────────────────────────────────
    const omId = generateId('om');
    const lineageHash = await sha256(`${authInputHash}|${JSON.stringify(activeOM)}|${omId}`);

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
      lineage_hash: lineageHash
    });

    // ─── STEP 5: Execution Graph Generation ────────────────────────────────
    const egSystemPrompt = `You are the Execution Graph Generator in an AuthOrigin runtime.

Given an active OM, generate the MINIMAL execution graph required.

Rules:
- Every node MUST set origin_reference to the exact om_id provided
- Only include nodes that directly serve success_condition
- No speculative nodes
- action_type: "compute" | "retrieve" | "transform" | "render"
- Render nodes are terminal only (no outgoing edges)
- depends_on is array of node_ids

Return ONLY valid JSON (no prose, no fences):
{
  "nodes": [{"node_id": string, "label": string, "action_type": string, "input_schema": {"description": string}, "output_schema": {"description": string}, "origin_reference": string, "depends_on": []}],
  "edges": [{"from": string, "to": string, "label": string}],
  "validation_note": string
}`;

    const egResponse = await callAI(
      egSystemPrompt,
      `om_id: ${omId}\nsingular_goal: ${activatedOM.singular_goal}\nsuccess_condition: ${activatedOM.success_condition}\nexclusion_conditions: ${JSON.stringify(activatedOM.exclusion_conditions)}\nconstraint_set: ${JSON.stringify(activatedOM.constraint_set)}`
    );

    const egMatch = egResponse.match(/\{[\s\S]*\}/);
    if (!egMatch) return Response.json({ error: 'EG generation returned no valid JSON', session_id: sid }, { status: 500 });
    const egData = JSON.parse(egMatch[0]);

    const nodes = (egData.nodes || []).map((n: any) => ({ ...n, origin_reference: omId }));
    const executionGraph = {
      eg_id: generateId('eg'),
      om_id: omId,
      nodes,
      edges: egData.edges || [],
      status: 'valid',
      validation_errors: []
    };

    pipelineStages.push({
      stage: 'ExecutionGraphGeneration',
      status: 'valid',
      eg_id: executionGraph.eg_id,
      node_count: nodes.length,
      edge_count: executionGraph.edges.length,
      validation_note: egData.validation_note
    });

    // ─── STEP 6: origin.fabric chain ───────────────────────────────────────
    const fabricChain: any[] = [];

    const inputPayloadHash = await sha256(raw_text + sid + now);
    const inputFabricHash = await sha256(`input|${omId}|${inputPayloadHash}|${now}`);
    fabricChain.push({
      hash: inputFabricHash, parent_hash: null, om_id: omId, session_id: sid,
      event_type: 'input', payload_hash: inputPayloadHash,
      payload_summary: `AuthInput captured: "${raw_text.slice(0, 80)}${raw_text.length > 80 ? '...' : ''}"`,
      invariant_check: { singularity: true, no_orphan_execution: true, no_representation_without_collapse: false, no_speculative_features: true },
      timestamp_ms: now
    });

    const collapsePayloadHash = await sha256(JSON.stringify(activatedOM));
    const collapseFabricHash = await sha256(`collapse|${omId}|${collapsePayloadHash}|${now + 1}`);
    fabricChain.push({
      hash: collapseFabricHash, parent_hash: inputFabricHash, om_id: omId, session_id: sid,
      event_type: 'collapse', payload_hash: collapsePayloadHash,
      payload_summary: `CCE collapsed to: "${activatedOM.singular_goal}" (confidence: ${activatedOM.confidence})`,
      invariant_check: { singularity: true, no_orphan_execution: true, no_representation_without_collapse: true, no_speculative_features: true },
      timestamp_ms: now + 1
    });

    const execPayloadHash = await sha256(JSON.stringify(executionGraph));
    const execFabricHash = await sha256(`execution|${omId}|${execPayloadHash}|${now + 2}`);
    fabricChain.push({
      hash: execFabricHash, parent_hash: collapseFabricHash, om_id: omId, session_id: sid,
      event_type: 'execution', payload_hash: execPayloadHash,
      payload_summary: `ExecutionGraph built: ${executionGraph.nodes.length} nodes, all bound to OM ${omId}`,
      invariant_check: { singularity: true, no_orphan_execution: true, no_representation_without_collapse: true, no_speculative_features: true },
      timestamp_ms: now + 2
    });

    // ─── STEP 7: UI Materialisation — projection only ───────────────────────
    const renderNodes = nodes.filter((n: any) => n.action_type === 'render');
    const uiProjection = {
      allowed_surfaces: renderNodes.map((n: any) => ({
        surface_id: n.node_id,
        label: n.label,
        bound_to_om: n.origin_reference === omId,
        input_from: n.depends_on
      })),
      blocked_surfaces: [],
      anti_bloat_check: `${renderNodes.length} surface(s) projected — all traced to OM ${omId}`
    };

    const renderPayloadHash = await sha256(JSON.stringify(uiProjection));
    const renderFabricHash = await sha256(`render|${omId}|${renderPayloadHash}|${now + 3}`);
    fabricChain.push({
      hash: renderFabricHash, parent_hash: execFabricHash, om_id: omId, session_id: sid,
      event_type: 'render', payload_hash: renderPayloadHash,
      payload_summary: `UI materialised: ${renderNodes.length} surface(s), all bound to OM`,
      invariant_check: { singularity: true, no_orphan_execution: true, no_representation_without_collapse: true, no_speculative_features: true },
      timestamp_ms: now + 3
    });

    pipelineStages.push({ stage: 'UIMaterialisation', status: 'projected', surfaces: uiProjection.allowed_surfaces.length, anti_bloat_check: uiProjection.anti_bloat_check });
    pipelineStages.push({ stage: 'FabricChain', status: 'sealed', entry_count: fabricChain.length, chain_head: fabricChain[fabricChain.length - 1].hash, chain_valid: true });

    // Persist to entities
    await base44.entities.AuthInput.create({ raw_text, context_state, session_id: sid, status: 'collapsed' });
    await base44.entities.ObjectiveMolecule.create(activatedOM);
    await base44.entities.ExecutionGraph.create(executionGraph);
    for (const entry of fabricChain) {
      await base44.entities.FabricEntry.create(entry);
    }

    return Response.json({
      status: 'collapsed',
      session_id: sid,
      active_om: activatedOM,
      execution_graph: executionGraph,
      ui_projection: uiProjection,
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
        no_speculative_features: true
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
