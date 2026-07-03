// Persistence Port — the interface the runtime depends on, not a concrete store.
// v2: adds RuntimeContext (execution metadata, pre- and post-identity) and
// RuntimeEvent (pre-identity stage telemetry, no molecule_id — there isn't one yet).
// Post-identity stage telemetry becomes a "Molecule Event": a JournalObservation
// with observation_type="pipeline_stage_completed", tagged with runtime_id.

export interface HashIndexEntry { molecule_id: string; }

export interface PersistencePort {
  getHashIndex(): Promise<Record<string, HashIndexEntry>>;
  getCorpusTexts(): Promise<string[]>;
  ensureContainer(source_name: string, author_id: string, author_domain_id: string, hol_context: string): Promise<string>;
  persistMolecule(unit: any): Promise<void>;
  createRuntimeContext(ctx: any): Promise<void>;
  updateRuntimeContext(runtime_id: string, patch: any): Promise<void>;
  recordRuntimeEvent(runtime_id: string, session_id: string, stage: string, payload_digest: string, next_stage: string): Promise<void>;
  recordMoleculeEvent(unit: any, stageName: string): Promise<void>;
  recordConstitutionalFact(fact: any): Promise<void>;
}

import { createHash } from "node:crypto";
function sha256(s: string): string { return createHash("sha256").update(s).digest("hex"); }
function gid(...p: any[]): string { return sha256(JSON.stringify(p) + Date.now() + Math.random()).substring(0, 24); }
function now(): string { return new Date().toISOString(); }

export class Base44Adapter implements PersistencePort {
  constructor(private base44: any) {}

  async getHashIndex(): Promise<Record<string, HashIndexEntry>> {
    const all = await this.base44.asServiceRole.entities.Molecule.list();
    const idx: Record<string, HashIndexEntry> = {};
    for (const m of all) if (m.canonicalHash) idx[m.canonicalHash] = { molecule_id: m.molecule_id };
    return idx;
  }

  async getCorpusTexts(): Promise<string[]> {
    const all = await this.base44.asServiceRole.entities.Molecule.list();
    return all.filter((m: any) => m.lexical_content && m.molecule_type !== "container").map((m: any) => m.lexical_content);
  }

  async ensureContainer(source_name: string, author_id: string, author_domain_id: string, hol_context: string): Promise<string> {
    const all = await this.base44.asServiceRole.entities.Molecule.list();
    const existing = all.find((m: any) => m.molecule_type === "container" && m.source_name === source_name);
    if (existing) return existing.molecule_id;
    const hash = sha256("container:" + source_name);
    const containerId = "mol-container-" + hash.substring(0, 12);
    await this.base44.asServiceRole.entities.Molecule.create({
      molecule_id: containerId, canonicalHash: hash, lexical_content: source_name, molecule_type: "container",
      current_state: "EXPLORED", constitutional_status: "active", access_tier: "open", weight_class: "operational",
      is_foundational: false, kCv_o: 0, kCv_u: 0, kCv_v_score: 0, kCv_v_quality: "UNVERIFIED",
      kCv_i_score: 0, kCv_i_status: "UNOBSERVED", kCv_r_score: 0, kCv_r_status: "NEW", kCv_rank: 0,
      capture_confidence: "1.0", observation_density: 0, reuse_count: 0,
      parent_molecule_ids: [], lineage_types: [], lineage_certainty: "1.0",
      scope_definition: source_name, section: source_name, source_name, hol_context,
      author_domain_id, vsid: author_id, constitution_version: "v1.0", state_since: now(),
    });
    return containerId;
  }

  async persistMolecule(unit: any): Promise<void> {
    await this.base44.asServiceRole.entities.Molecule.create({
      molecule_id: unit.molecule_id, canonicalHash: unit.canonicalHash, lexical_content: unit.normalised_text,
      molecule_type: unit.molecule_type, current_state: unit.current_state,
      constitutional_status: unit.constitutional_status, access_tier: unit.access_tier, weight_class: unit.weight_class,
      is_foundational: false, kCv_o: unit.kCv_o, kCv_u: unit.kCv_u,
      kCv_v_score: 0, kCv_v_quality: "UNVERIFIED", kCv_i_score: 0, kCv_i_status: "UNOBSERVED",
      kCv_r_score: 0, kCv_r_status: "NEW", kCv_rank: unit.kCv_rank,
      capture_confidence: String(unit.capture_confidence), observation_density: 0, reuse_count: 0,
      parent_molecule_ids: unit.parent_molecule_ids, lineage_types: unit.lineage_types, lineage_certainty: "0.9",
      scope_definition: unit.source_name + "::" + unit.source_name, section: unit.source_name, source_name: unit.source_name,
      hol_context: unit.hol_context, author_domain_id: unit.author_domain_id, vsid: unit.author_id,
      constitution_version: "v1.0", state_since: unit.state_since,
      runtime_id: unit.runtime_id,
    });
  }

  async createRuntimeContext(ctx: any): Promise<void> {
    await this.base44.asServiceRole.entities.RuntimeContext.create(ctx);
  }

  async updateRuntimeContext(runtime_id: string, patch: any): Promise<void> {
    const all = await this.base44.asServiceRole.entities.RuntimeContext.list();
    const rec = all.find((r: any) => r.runtime_id === runtime_id);
    if (rec && rec.id) await this.base44.asServiceRole.entities.RuntimeContext.update(rec.id, patch);
  }

  async recordRuntimeEvent(runtime_id: string, session_id: string, stage: string, payload_digest: string, next_stage: string): Promise<void> {
    await this.base44.asServiceRole.entities.RuntimeEvent.create({
      runtime_id, session_id, stage, timestamp: now(), payload_digest, next_stage,
    });
  }

  async recordMoleculeEvent(unit: any, stageName: string): Promise<void> {
    const allObs = await this.base44.asServiceRole.entities.JournalObservation.list();
    const ls = Math.max(0, ...allObs.map((o: any) => o.journal_sequence || 0));
    const oid = gid("stage", stageName, unit.molecule_id, now());
    await this.base44.asServiceRole.entities.JournalObservation.create({
      observation_id: oid,
      molecule_id: unit.molecule_id,
      canonicalHash: unit.canonicalHash || "",
      observation_type: "pipeline_stage_completed",
      stage_name: stageName,
      runtime_id: unit.runtime_id,
      polarity: 1,
      conflict_flag: false,
      actor_id: unit.author_id || "runtime",
      actor_domain_id: unit.author_domain_id || "runtime",
      actor_trust_score: 1.0,
      evidence_hash: sha256(stageName + (unit.canonicalHash || unit.normalised_text || "")),
      constitution_version: "v1.0",
      journal_sequence: ls + 1,
      observation_hash: sha256(oid + stageName + now()),
      prior_entry_hash: allObs.length > 0 ? (allObs[allObs.length - 1].observation_hash || "genesis") : "genesis",
    });
  }

  async recordConstitutionalFact(fact: any): Promise<void> {
    const allFacts = await this.base44.asServiceRole.entities.JournalFact.list();
    const ls = Math.max(0, ...allFacts.map((f: any) => f.journal_sequence || 0));
    const fid = gid("fact", fact.molecule_id, now());
    await this.base44.asServiceRole.entities.JournalFact.create({
      fact_id: fid, molecule_id: fact.molecule_id, canonicalHash: fact.canonicalHash,
      fact_type: fact.fact_type, weight_class: fact.weight_class, polarity: 1,
      from_state: fact.from_state, to_state: fact.to_state,
      actor_id: fact.actor_id || "runtime", actor_domain_id: fact.actor_domain_id || "runtime", actor_trust_score: 1.0,
      evidence_hash: fact.evidence_hash, constitution_version: "v1.0", journal_sequence: ls + 1,
      fact_hash: sha256(fid + fact.molecule_id + now()),
      prior_entry_hash: allFacts.length > 0 ? (allFacts[allFacts.length - 1].fact_hash || "genesis") : "genesis",
      runtime_id: fact.runtime_id,
    });
  }
}
