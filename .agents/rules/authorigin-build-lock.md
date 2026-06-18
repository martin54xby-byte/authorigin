# AuthOrigin Build Lock — DO NOT DEVIATE

## What this system is

AuthOrigin is a deployed, production backend runtime + plain HTML/JS dashboard.
It is NOT a React app. It is NOT a Next.js app. It is NOT a component library.

## What already exists and MUST NOT be replaced

### Backend (deployed to Base44 functions)
- `runCCE` — Canonical Collapse Engine v5 (TypeScript/Deno)
  Full pipeline: AuthInput → OPL → CCE → CAR-1 → ExecGraph → CGS-1 → FR-0/CPC →
  TCL-1 → EEL-1 → SHCL-1 → RenderGate → MOCL-1 → UIMaterialisation → FabricChain
- `ui` — serves the HTML dashboard from CDN

### Frontend
- `ui/authorigin.html` — single-file dark-theme dashboard (vanilla HTML/CSS/JS)
  Uploaded to CDN, served via the `ui` backend function.
  DO NOT rebuild this as React or any framework.

### Entities (Base44 database — real, populated)
- AuthInput
- ObjectiveMolecule
- ExecutionGraph
- FabricEntry
- FabricTimeChain
- PolicyMolecule

### Live URL
https://base44.app/api/apps/6a32de057455bcc09670b3aa/files/mp/public/6a32de057455bcc09670b3aa/77c66c5c7_authorigin.html

## Formal layers implemented (all live)

| Layer  | Name                        | Status   |
|--------|-----------------------------|----------|
| FR-0   | Anti-find_REPLACE (CPC)     | DEPLOYED |
| CAR-1  | Constraint Determinism      | DEPLOYED |
| CGS-1  | Controlled Creativity       | DEPLOYED |
| MOCL-1 | Multi-OM Isolation          | DEPLOYED |
| TCL-1  | Temporal Coherence          | DEPLOYED |
| EEL-1  | Epistemic Evolution         | DEPLOYED |
| SHCL-1 | Self-Healing Consistency    | DEPLOYED |

## Standing rules (enforced permanently)

1. Never rebuild the frontend as React, Vue, or any framework.
2. Never simulate pipeline stages — the real `runCCE` backend function is live.
3. Never replace deployed entities with new schemas without explicit user instruction.
4. Never generate "demo data" — the system runs real AI collapse.
5. All UI changes must be surgical patches to `ui/authorigin.html` via Python sed/replace.
6. The pipeline order is canonical and immutable unless the user adds a new layer.
7. SHCL-1 is the outermost layer — no new layer may be inserted above it without review.
8. Objective singularity: only one active OM at a time (enforced in CCE runtime).
9. Render Gate Rule: no UI surface renders without a validated active OM.
10. All system events are logged in origin.fabric with immutable hash chaining.

## How to make changes

- Backend changes: edit `functions/runCCE.ts`, then `deploy_backend_function('runCCE', ...)`
- UI changes: surgical Python patch to `ui/authorigin.html`, then `upload_file` + `deploy_backend_function('ui', ...)`
- New layer: discuss architecture first, then follow the existing layer pattern (entity schema → runtime function → UI stage → fabric entry type)
- Never start from scratch. Always patch.

## What "off brief" looks like — reject immediately

- Any mention of React, Next.js, Vite, Tailwind, shadcn, or component libraries
- Any plan to "simulate" the pipeline
- Any new entity schema that duplicates existing ones
- Any rewrite of the full HTML file from scratch
- Any "fresh start" or "clean slate" framing
