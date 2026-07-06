// Edge Candidate Generator + Verification Gate (ACS-300 §6)
// Turns RawCandidates (from edgeParser) into either:
//   - a registered Edge Molecule (target resolved, verification passed)
//   - an unresolved_reference JournalObservation (target not found — not an edge)
// Never guesses. Never persists an edge without a resolved target.

import { createHash } from "node:crypto";
import { RawCandidate, resolveTarget, ALGORITHM_VERSION } from "./edgeParser.ts";

function sha256(s: string): string { return createHash("sha256").update(s).digest("hex"); }
function gid(...p: any[]): string { return sha256(JSON.stringify(p) + Date.now() + Math.random()).substring(0, 24); }
function now(): string { return new Date().toISOString(); }

export interface EdgeGenerationResult {
  edges_created: any[];
  unresolved: any[];
  duplicates_skipped: any[];
}

// Verification gate — structural checks only, no semantic judgement.
function verify(sourceId: string, targetId: string, candidate: RawCandidate): { ok: boolean; reason?: string } {
  if (sourceId === targetId) return { ok: false, reason: "self_reference" };
  if (!["CITES", "REFERENCES_STANDARD", "DERIVES_FROM", "IMPLEMENTS"].includes(candidate.relationship_type)) return { ok: false, reason: "relationship_type_not_in_phase1_scope" };
  if (candidate.confidence < 0 || candidate.confidence > 1) return { ok: false, reason: "confidence_out_of_range" };
  if (!candidate.evidence_summary || candidate.evidence_summary.length < 3) return { ok: false, reason: "insufficient_evidence" };
  return { ok: true };
}

export async function generateEdgesForMolecule(sourceMoleculeId: string, candidates: RawCandidate[], allMolecules: any[], base44: any, runtime_id: string, actor_id: string): Promise<EdgeGenerationResult> {
  const result: EdgeGenerationResult = { edges_created: [], unresolved: [], duplicates_skipped: [] };
  const existingEdgeHashes = new Set(allMolecules.filter((m) => m.molecule_type === "edge").map((m) => m.canonicalHash));

  const allObs = await base44.asServiceRole.entities.JournalObservation.list();
  let ls = Math.max(0, ...allObs.map((o: any) => o.journal_sequence || 0));
  let priorHash = allObs.length > 0 ? (allObs[allObs.length - 1].observation_hash || "genesis") : "genesis";

  for (const cand of candidates) {
    const targetId = resolveTarget(cand.target_text, allMolecules);

    if (!targetId) {
      ls += 1;
      const oid = gid("obs-unresolved", sourceMoleculeId, cand.target_text, now());
      const obsHash = sha256(oid + cand.target_text + now());
      await base44.asServiceRole.entities.JournalObservation.create({
        observation_id: oid, molecule_id: sourceMoleculeId, observation_type: "evidence_gap_observed",
        gap_type: "lineage", polarity: 0, conflict_flag: false, actor_id, actor_domain_id: "edge-parser",
        actor_trust_score: 1.0, evidence_hash: sha256(cand.target_text), constitution_version: "v1.1",
        journal_sequence: ls, observation_hash: obsHash, prior_entry_hash: priorHash,
        metadata: { unresolved_target_text: cand.target_text, attempted_relationship_type: cand.relationship_type, evidence_summary: cand.evidence_summary },
      });
      priorHash = obsHash;
      result.unresolved.push({ target_text: cand.target_text, relationship_type: cand.relationship_type, reason: "target_not_found_in_corpus" });
      continue;
    }

    const v = verify(sourceMoleculeId, targetId, cand);
    if (!v.ok) {
      result.unresolved.push({ target_text: cand.target_text, relationship_type: cand.relationship_type, reason: v.reason });
      continue;
    }

    const edgeHash = sha256(sourceMoleculeId + targetId + cand.relationship_type + cand.evidence_summary);
    if (existingEdgeHashes.has(edgeHash)) {
      result.duplicates_skipped.push({ target_text: cand.target_text, relationship_type: cand.relationship_type });
      continue;
    }

    const edgeMoleculeId = "mol-edge-" + edgeHash.substring(0, 16);
    await base44.asServiceRole.entities.Molecule.create({
      molecule_id: edgeMoleculeId, canonicalHash: edgeHash, lexical_content: `${cand.relationship_type}: ${cand.evidence_summary}`,
      molecule_type: "edge", current_state: "EXPLORED", constitutional_status: "active", access_tier: "open",
      weight_class: "operational", is_foundational: false,
      kCv_o: 0, kCv_u: 0, kCv_v_score: 0, kCv_v_quality: "UNVERIFIED", kCv_i_score: 0, kCv_i_status: "UNOBSERVED",
      kCv_r_score: 0, kCv_r_status: "NEW", kCv_rank: 0, capture_confidence: String(cand.confidence),
      observation_density: 0, reuse_count: 0, parent_molecule_ids: [sourceMoleculeId], lineage_types: [],
      lineage_certainty: String(cand.confidence), scope_definition: "edge::" + cand.relationship_type,
      constitution_version: "v1.1", state_since: now(), runtime_id,
      edge_source_molecule_id: sourceMoleculeId, edge_target_molecule_id: targetId,
      edge_relationship_type: cand.relationship_type, edge_confidence: cand.confidence,
      edge_evidence_summary: cand.evidence_summary, edge_algorithm_version: ALGORITHM_VERSION,
      edge_created_by: "deterministic_extraction", vsid: actor_id, author_domain_id: "edge-parser",
    });

    const allFacts = await base44.asServiceRole.entities.JournalFact.list();
    const fls = Math.max(0, ...allFacts.map((f: any) => f.journal_sequence || 0));
    await base44.asServiceRole.entities.JournalFact.create({
      fact_id: gid("fact-edge", edgeMoleculeId, now()), molecule_id: edgeMoleculeId, canonicalHash: edgeHash,
      fact_type: "molecule_created", from_state: "CREATED", to_state: "EXPLORED", weight_class: "operational",
      polarity: 1, actor_id, actor_domain_id: "edge-parser", actor_trust_score: 1.0, evidence_hash: edgeHash,
      constitution_version: "v1.1", journal_sequence: fls + 1,
      fact_hash: sha256(edgeMoleculeId + now()), prior_entry_hash: allFacts.length > 0 ? (allFacts[allFacts.length - 1].fact_hash || "genesis") : "genesis",
      runtime_id,
    });

    existingEdgeHashes.add(edgeHash);
    result.edges_created.push({ molecule_id: edgeMoleculeId, source: sourceMoleculeId, target: targetId, relationship_type: cand.relationship_type, confidence: cand.confidence, evidence_summary: cand.evidence_summary });
  }

  return result;
}
