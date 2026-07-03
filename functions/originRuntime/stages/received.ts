// Stage 1 — RECEIVED
// Pure function: raw input → draft unit
// No I/O. No persistence. Deterministic given input.

export interface RawInput {
  document_text: string;
  source_name?: string;
  author_id?: string;
  author_domain_id?: string;
  hol_context?: string;
}

export interface DraftUnit {
  stage: "RECEIVED";
  raw_text: string;
  source_name: string;
  author_id: string;
  author_domain_id: string;
  hol_context: string;
}

export function received(raw: RawInput): DraftUnit {
  return {
    stage: "RECEIVED",
    raw_text: raw.document_text,
    source_name: raw.source_name || "document",
    author_id: raw.author_id || "unknown",
    author_domain_id: raw.author_domain_id || "unknown",
    hol_context: raw.hol_context || "",
  };
}
