/**
 * AuthOrigin UI Shell — serves the single-page interface
 * at /functions/ui (GET)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AuthOrigin — Canonical Objective Runtime</title>
<style>
  :root {
    --bg:#0a0a0f;--surface:#111118;--surface2:#16161f;--border:#1e1e2e;--border-hi:#2a2a3e;
    --text:#e2e2f0;--text-dim:#6b6b8a;--text-mid:#9999b8;
    --accent:#7c6af7;--accent-dim:#3d3578;--accent-glow:rgba(124,106,247,.15);
    --green:#3dba7e;--green-dim:#1a4a35;--red:#e05252;--red-dim:#4a1a1a;
    --amber:#e0a852;--amber-dim:#4a3a1a;--blue:#52a8e0;--blue-dim:#1a3a4a;
    --mono:'JetBrains Mono','Fira Code','Courier New',monospace;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;font-size:14px;line-height:1.6;min-height:100vh}
  header{border-bottom:1px solid var(--border);padding:20px 32px;display:flex;align-items:center;gap:16px;background:var(--surface);position:sticky;top:0;z-index:100}
  .logo-mark{width:36px;height:36px;background:var(--accent);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:white;flex-shrink:0}
  .header-title h1{font-size:16px;font-weight:700;letter-spacing:-.3px}
  .header-title p{font-size:11px;color:var(--text-dim);letter-spacing:.5px;text-transform:uppercase}
  .header-badges{margin-left:auto;display:flex;gap:8px}
  .badge{padding:3px 10px;border-radius:4px;font-size:10px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;border:1px solid}
  .badge-fr0{color:var(--green);border-color:var(--green);background:var(--green-dim)}
  .badge-car1{color:var(--accent);border-color:var(--accent);background:var(--accent-dim)}
  .badge-cgs1{color:var(--blue);border-color:var(--blue);background:var(--blue-dim)}
  .badge-mocl{color:var(--amber);border-color:var(--amber);background:var(--amber-dim)}
  .shell{display:grid;grid-template-columns:280px 1fr;height:calc(100vh - 73px)}
  .sidebar{border-right:1px solid var(--border);background:var(--surface);overflow-y:auto;padding:24px 0}
  .sidebar-section{padding:0 20px 20px}
  .sidebar-label{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text-dim);margin-bottom:12px}
  .stage-nav{display:flex;flex-direction:column;gap:2px}
  .stage-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;cursor:pointer;transition:background .15s;border:1px solid transparent}
  .stage-item:hover{background:var(--surface2)}
  .stage-item.active{background:var(--accent-glow);border-color:var(--accent-dim)}
  .stage-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;background:var(--border-hi);transition:background .3s}
  .stage-dot.done{background:var(--green)}.stage-dot.running{background:var(--accent);animation:pulse 1s infinite}.stage-dot.error{background:var(--red)}.stage-dot.blocked{background:var(--amber)}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  .stage-name{font-size:12px;font-weight:500;color:var(--text-mid)}
  .stage-item.active .stage-name{color:var(--text)}
  .divider{border:none;border-top:1px solid var(--border);margin:16px 20px}
  .guarantee-grid{display:flex;flex-direction:column;gap:8px}
  .g-row{display:flex;align-items:center;gap:8px}
  .g-label{font-size:10px;font-weight:700;letter-spacing:.5px;width:50px;color:var(--text-dim)}
  .g-bar-track{flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden}
  .g-bar-fill{height:100%;border-radius:2px;width:0%;transition:width .6s ease}
  .g-status{font-size:10px;font-weight:700;width:18px;text-align:right}
  .g-status.ok{color:var(--green)}.g-status.err{color:var(--red)}.g-status.pend{color:var(--text-dim)}
  .main{overflow-y:auto;display:flex;flex-direction:column}
  .input-zone{padding:32px 40px;border-bottom:1px solid var(--border);background:var(--surface)}
  .input-label{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text-dim);margin-bottom:12px}
  .input-row{display:flex;gap:12px;align-items:flex-start}
  textarea{flex:1;background:var(--surface2);border:1px solid var(--border-hi);border-radius:8px;color:var(--text);font-family:inherit;font-size:14px;padding:14px 16px;resize:none;outline:none;transition:border-color .2s;min-height:80px}
  textarea:focus{border-color:var(--accent)}
  textarea::placeholder{color:var(--text-dim)}
  .submit-btn{background:var(--accent);border:none;border-radius:8px;color:white;cursor:pointer;font-size:13px;font-weight:600;padding:14px 24px;white-space:nowrap;transition:opacity .2s,transform .1s;align-self:flex-end}
  .submit-btn:hover{opacity:.85}.submit-btn:active{transform:scale(.98)}.submit-btn:disabled{opacity:.35;cursor:not-allowed}
  .example-inputs{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap}
  .example-chip{background:var(--surface2);border:1px solid var(--border-hi);border-radius:20px;color:var(--text-dim);cursor:pointer;font-size:11px;padding:4px 12px;transition:all .15s}
  .example-chip:hover{border-color:var(--accent-dim);color:var(--text)}
  .pipeline{flex:1;padding:32px 40px;display:flex;flex-direction:column;gap:24px}
  .empty-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:var(--text-dim)}
  .empty-icon{width:56px;height:56px;border:2px solid var(--border-hi);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px}
  .stage-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;animation:fadeUp .3s ease}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .stage-card.running{border-color:var(--accent-dim)}.stage-card.error{border-color:var(--red-dim)}.stage-card.blocked{border-color:var(--amber-dim)}
  .card-header{padding:16px 20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border);background:var(--surface2)}
  .card-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
  .icon-blue{background:var(--blue-dim)}.icon-purple{background:var(--accent-dim)}.icon-green{background:var(--green-dim)}.icon-amber{background:var(--amber-dim)}.icon-red{background:var(--red-dim)}
  .card-title{font-size:14px;font-weight:700}.card-subtitle{font-size:11px;color:var(--text-dim);margin-top:1px}
  .card-status-badge{margin-left:auto;padding:4px 10px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}
  .sb-running{background:var(--accent-dim);color:var(--accent)}.sb-done{background:var(--green-dim);color:var(--green)}.sb-error{background:var(--red-dim);color:var(--red)}.sb-blocked{background:var(--amber-dim);color:var(--amber)}
  .card-body{padding:20px}
  .spinner-row{display:flex;align-items:center;gap:12px;color:var(--text-dim);font-size:13px}
  .spinner{width:16px;height:16px;border:2px solid var(--border-hi);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}
  @keyframes spin{to{transform:rotate(360deg)}}
  .auth-raw{background:var(--surface2);border:1px solid var(--border-hi);border-radius:6px;padding:12px 16px;font-family:var(--mono);font-size:12px;color:var(--text);line-height:1.5}
  .meta-row{display:flex;gap:24px;margin-top:12px}
  .meta-item{display:flex;flex-direction:column;gap:2px}
  .meta-key{font-size:10px;color:var(--text-dim);font-weight:600;letter-spacing:.5px;text-transform:uppercase}
  .meta-val{font-size:12px;font-family:var(--mono);color:var(--text-mid)}
  .candidates-grid{display:flex;flex-direction:column;gap:12px}
  .candidate-card{background:var(--surface2);border:1px solid var(--border-hi);border-radius:8px;padding:14px 16px;transition:border-color .2s}
  .candidate-card.selected{border-color:var(--accent);background:var(--accent-glow)}.candidate-card.rejected{opacity:.45}
  .cand-header{display:flex;align-items:center;gap:10px;margin-bottom:8px}
  .cand-idx{width:20px;height:20px;border-radius:4px;background:var(--border-hi);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;color:var(--text-dim)}
  .cand-goal{font-size:13px;font-weight:600;flex:1}
  .conf-bar-wrap{display:flex;align-items:center;gap:6px}
  .conf-label{font-size:10px;color:var(--text-dim)}
  .conf-track{width:60px;height:4px;background:var(--border);border-radius:2px}
  .conf-fill{height:100%;border-radius:2px;background:var(--green)}
  .collapse-visual{display:flex;align-items:center;gap:0;margin-bottom:20px}
  .collapse-in{display:flex;flex-direction:column;gap:4px}
  .collapse-pill{background:var(--surface2);border:1px solid var(--border-hi);border-radius:4px;font-size:11px;padding:4px 10px;color:var(--text-dim);max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .collapse-pill.winner{border-color:var(--green);color:var(--green);background:var(--green-dim)}.collapse-pill.loser{opacity:.4}
  .collapse-arrow{flex:1;display:flex;align-items:center;justify-content:center;color:var(--accent);font-size:18px;position:relative}
  .collapse-arrow::before{content:'';position:absolute;left:20px;right:40px;height:1px;background:var(--accent-dim)}
  .collapse-out{background:var(--accent-glow);border:1px solid var(--accent);border-radius:8px;padding:12px 16px;flex-shrink:0;max-width:220px}
  .collapse-out-label{font-size:10px;color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
  .collapse-out-goal{font-size:13px;font-weight:600}
  .om-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}
  .om-field{background:var(--surface2);border:1px solid var(--border-hi);border-radius:6px;padding:10px 12px}
  .om-field-key{font-size:10px;color:var(--text-dim);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
  .om-field-val{font-size:12px;color:var(--text-mid);line-height:1.4}
  .hash-val{font-family:var(--mono);font-size:10px;color:var(--accent)}
  .excl-tag{background:var(--red-dim);border:1px solid var(--red-dim);border-radius:3px;color:var(--red);font-size:10px;padding:1px 6px}
  .exclusions{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
  .constraints-list{display:flex;flex-direction:column;gap:8px}
  .constraint-row{background:var(--surface2);border:1px solid var(--border-hi);border-radius:6px;overflow:hidden}
  .constraint-row.valid{border-color:var(--green-dim)}.constraint-row.invalid{border-color:var(--red-dim)}
  .cstr-header{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border)}
  .cstr-type{font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:2px 6px;border-radius:3px}
  .cstr-type.hard{background:var(--red-dim);color:var(--red)}.cstr-type.soft{background:var(--amber-dim);color:var(--amber)}
  .cstr-rule{font-size:12px;font-weight:500;flex:1}
  .cstr-score{font-family:var(--mono);font-size:11px}.cstr-score.ok{color:var(--green)}.cstr-score.err{color:var(--red)}
  .acf-grid{padding:10px 12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px}
  .acf-item{display:flex;flex-direction:column;gap:2px}
  .acf-key{color:var(--text-dim);font-weight:700;font-size:10px;text-transform:uppercase}
  .acf-val{color:var(--text-mid);line-height:1.4}
  .elastic-alert{background:var(--amber-dim);border:1px solid var(--amber);border-radius:6px;padding:10px 12px;font-size:12px;color:var(--amber);display:flex;gap:8px;align-items:flex-start;margin-bottom:12px}
  .graph-wrap{background:var(--surface2);border:1px solid var(--border-hi);border-radius:8px;padding:20px;overflow-x:auto}
  .graph-flow{display:flex;align-items:center;gap:0;min-width:max-content}
  .graph-node{border-radius:8px;padding:10px 14px;font-size:11px;font-weight:600;text-align:center;min-width:110px;max-width:150px;border:1px solid}
  .gn-compute{background:var(--blue-dim);border-color:var(--blue);color:var(--blue)}
  .gn-retrieve{background:var(--accent-dim);border-color:var(--accent);color:var(--accent)}
  .gn-transform{background:var(--amber-dim);border-color:var(--amber);color:var(--amber)}
  .gn-render{background:var(--green-dim);border-color:var(--green);color:var(--green)}
  .gn-label{font-size:10px;font-weight:500;opacity:.7;text-transform:uppercase;letter-spacing:.5px}
  .gn-name{font-size:12px;margin-top:2px}
  .graph-arrow{display:flex;align-items:center;padding:0 8px;color:var(--text-dim);font-size:14px}
  .nodes-list{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
  .node-row{display:flex;align-items:center;gap:10px;background:var(--surface2);border:1px solid var(--border-hi);border-radius:6px;padding:10px 12px}
  .paths-grid{display:flex;flex-direction:column;gap:10px}
  .path-card{background:var(--surface2);border:1px solid var(--border-hi);border-radius:6px;padding:12px 14px}
  .path-header{display:flex;align-items:center;gap:10px;margin-bottom:8px}
  .path-id{font-family:var(--mono);font-size:11px;color:var(--accent)}
  .path-pet{margin-left:auto;font-size:10px;font-weight:700}.path-pet.ok{color:var(--green)}.path-pet.err{color:var(--red)}
  .path-seq{display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-size:11px}
  .path-node-chip{background:var(--border);border-radius:3px;padding:2px 8px;color:var(--text-mid);font-family:var(--mono)}
  .path-sep{color:var(--text-dim)}
  .outcome-box{background:var(--green-dim);border:1px solid var(--green);border-radius:6px;padding:10px 12px;font-size:12px;color:var(--green);margin-top:10px}
  .outcome-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
  .surfaces-list{display:flex;flex-direction:column;gap:8px}
  .surface-card{border-radius:6px;padding:12px 14px;border:1px solid}
  .surface-card.admitted{background:var(--green-dim);border-color:var(--green)}.surface-card.blocked{background:var(--red-dim);border-color:var(--red);opacity:.6}
  .surf-header{display:flex;align-items:center;gap:8px;margin-bottom:6px}
  .surf-status{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
  .surf-status.admitted{color:var(--green)}.surf-status.blocked{color:var(--red)}
  .surf-label{font-size:13px;font-weight:600}
  .surf-proof{font-size:10px;color:var(--text-dim);margin-top:6px;font-family:var(--mono);line-height:1.6}
  .fabric-chain{display:flex;flex-direction:column;gap:0}
  .fabric-entry{display:flex;gap:16px;position:relative}
  .fabric-timeline{display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:24px}
  .fabric-dot{width:10px;height:10px;border-radius:50%;border:2px solid;flex-shrink:0;margin-top:14px;z-index:1;background:var(--bg)}
  .fabric-dot.input{border-color:var(--blue)}.fabric-dot.collapse{border-color:var(--accent)}.fabric-dot.car_check{border-color:var(--accent)}.fabric-dot.cgs_path{border-color:var(--blue)}.fabric-dot.execution{border-color:var(--amber)}.fabric-dot.render{border-color:var(--green)}.fabric-dot.violation{border-color:var(--red)}.fabric-dot.mocl_mediation{border-color:var(--amber)}
  .fabric-line{flex:1;width:2px;background:var(--border)}
  .fabric-content{flex:1;padding:12px 0 20px}
  .fabric-event-header{display:flex;align-items:center;gap:8px;margin-bottom:6px}
  .event-type-tag{font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;padding:2px 8px;border-radius:3px}
  .et-input{background:var(--blue-dim);color:var(--blue)}.et-collapse{background:var(--accent-dim);color:var(--accent)}.et-car_check{background:var(--accent-dim);color:var(--accent)}.et-cgs_path{background:var(--blue-dim);color:var(--blue)}.et-execution{background:var(--amber-dim);color:var(--amber)}.et-render{background:var(--green-dim);color:var(--green)}.et-violation{background:var(--red-dim);color:var(--red)}.et-mocl_mediation{background:var(--amber-dim);color:var(--amber)}
  .fabric-summary{font-size:12px;color:var(--text-mid);line-height:1.5}
  .fabric-hashes{display:flex;gap:16px;margin-top:6px}
  .fh{display:flex;flex-direction:column;gap:1px}
  .fh-key{font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.5px}
  .fh-val{font-family:var(--mono);font-size:10px;color:var(--text-dim)}
  .invariant-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
  .inv-chip{font-size:9px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid}
  .inv-chip.ok{border-color:var(--green-dim);color:var(--green);background:var(--green-dim)}.inv-chip.err{border-color:var(--red-dim);color:var(--red);background:var(--red-dim)}.inv-chip.na{border-color:var(--border);color:var(--text-dim)}
  .block-panel{background:var(--amber-dim);border:1px solid var(--amber);border-radius:8px;padding:20px}
  .block-title{font-size:14px;font-weight:700;color:var(--amber);margin-bottom:8px}
  .block-msg{font-size:13px;color:var(--text-mid);line-height:1.6}
  .block-question{font-size:14px;font-weight:600;color:var(--text);margin-top:12px;background:var(--surface2);border-radius:6px;padding:12px;border-left:3px solid var(--amber)}
  .gs-grid{display:grid;grid-template-columns:1fr 1fr;gap:0}
  .gs-cell{padding:16px 20px;border-right:1px solid var(--border);border-bottom:1px solid var(--border)}
  .gs-cell:nth-child(2n){border-right:none}.gs-cell:nth-last-child(-n+2){border-bottom:none}
  .gs-layer{font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;margin-bottom:4px}
  .gs-holds{font-size:20px;font-weight:900;margin-bottom:4px}.gs-holds.yes{color:var(--green)}.gs-holds.no{color:var(--red)}
  .gs-stmt{font-size:11px;color:var(--text-dim);line-height:1.4}
  .section-title{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--text-dim);margin-bottom:12px}
  .mt8{margin-top:8px}.mt12{margin-top:12px}
  .text-green{color:var(--green)}.text-red{color:var(--red)}.text-amber{color:var(--amber)}.text-accent{color:var(--accent)}.text-dim{color:var(--text-dim)}
  .mono{font-family:var(--mono)}
  ::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--border-hi);border-radius:3px}
</style>
</head>
<body>
<header>
  <div class="logo-mark">⌬</div>
  <div class="header-title"><h1>AuthOrigin</h1><p>Canonical Objective Runtime</p></div>
  <div class="header-badges">
    <span class="badge badge-fr0">FR-0</span>
    <span class="badge badge-car1">CAR-1</span>
    <span class="badge badge-cgs1">CGS-1</span>
    <span class="badge badge-mocl">MOCL-1</span>
  </div>
</header>
<div class="shell">
  <aside class="sidebar">
    <div class="sidebar-section">
      <div class="sidebar-label">Pipeline stages</div>
      <div class="stage-nav" id="stageNav">
        <div class="stage-item" data-stage="authinput"><div class="stage-dot" id="dot-authinput"></div><span class="stage-name">AuthInput</span><span style="margin-left:auto;font-size:9px;color:var(--text-dim);font-family:var(--mono)">01</span></div>
        <div class="stage-item" data-stage="opl"><div class="stage-dot" id="dot-opl"></div><span class="stage-name">OPL Candidates</span><span style="margin-left:auto;font-size:9px;color:var(--text-dim);font-family:var(--mono)">02</span></div>
        <div class="stage-item" data-stage="cce"><div class="stage-dot" id="dot-cce"></div><span class="stage-name">CCE Collapse</span><span style="margin-left:auto;font-size:9px;color:var(--text-dim);font-family:var(--mono)">03</span></div>
        <div class="stage-item" data-stage="car1"><div class="stage-dot" id="dot-car1"></div><span class="stage-name">CAR-1 Constraints</span><span style="margin-left:auto;font-size:9px;color:var(--text-dim);font-family:var(--mono)">04</span></div>
        <div class="stage-item" data-stage="graph"><div class="stage-dot" id="dot-graph"></div><span class="stage-name">Execution Graph</span><span style="margin-left:auto;font-size:9px;color:var(--text-dim);font-family:var(--mono)">05</span></div>
        <div class="stage-item" data-stage="cgs1"><div class="stage-dot" id="dot-cgs1"></div><span class="stage-name">CGS-1 Manifold</span><span style="margin-left:auto;font-size:9px;color:var(--text-dim);font-family:var(--mono)">06</span></div>
        <div class="stage-item" data-stage="ui"><div class="stage-dot" id="dot-ui"></div><span class="stage-name">UI Materialisation</span><span style="margin-left:auto;font-size:9px;color:var(--text-dim);font-family:var(--mono)">07</span></div>
        <div class="stage-item" data-stage="fabric"><div class="stage-dot" id="dot-fabric"></div><span class="stage-name">origin.fabric</span><span style="margin-left:auto;font-size:9px;color:var(--text-dim);font-family:var(--mono)">08</span></div>
        <div class="stage-item" data-stage="guarantees"><div class="stage-dot" id="dot-guarantees"></div><span class="stage-name">Formal Guarantees</span><span style="margin-left:auto;font-size:9px;color:var(--text-dim);font-family:var(--mono)">Σ</span></div>
      </div>
    </div>
    <hr class="divider">
    <div class="sidebar-section">
      <div class="sidebar-label">Guarantees</div>
      <div class="guarantee-grid">
        <div class="g-row"><span class="g-label">FR-0</span><div class="g-bar-track"><div class="g-bar-fill" id="gbar-fr0" style="background:var(--green)"></div></div><span class="g-status pend" id="gstat-fr0">—</span></div>
        <div class="g-row"><span class="g-label">CAR-1</span><div class="g-bar-track"><div class="g-bar-fill" id="gbar-car1" style="background:var(--accent)"></div></div><span class="g-status pend" id="gstat-car1">—</span></div>
        <div class="g-row"><span class="g-label">CGS-1</span><div class="g-bar-track"><div class="g-bar-fill" id="gbar-cgs1" style="background:var(--blue)"></div></div><span class="g-status pend" id="gstat-cgs1">—</span></div>
        <div class="g-row"><span class="g-label">MOCL-1</span><div class="g-bar-track"><div class="g-bar-fill" id="gbar-mocl" style="background:var(--amber)"></div></div><span class="g-status pend" id="gstat-mocl">—</span></div>
      </div>
    </div>
    <hr class="divider">
    <div class="sidebar-section">
      <div class="sidebar-label">Session</div>
      <div style="font-size:11px;color:var(--text-dim)" id="sessionInfo">No active session</div>
    </div>
  </aside>
  <main class="main" id="mainArea">
    <div class="input-zone">
      <div class="input-label">AuthInput — raw intent capture</div>
      <div class="input-row">
        <textarea id="rawInput" placeholder="Enter a raw objective. The system will collapse it into a single canonical intent before any execution is permitted." rows="3"></textarea>
        <button class="submit-btn" id="submitBtn" onclick="runPipeline()">Collapse →</button>
      </div>
      <div class="example-inputs">
        <span class="example-chip" onclick="setExample(this)">Track how long my team takes to close support tickets</span>
        <span class="example-chip" onclick="setExample(this)">Send a weekly summary email of all open issues</span>
        <span class="example-chip" onclick="setExample(this)">I want to improve user engagement and also add analytics</span>
        <span class="example-chip" onclick="setExample(this)">Export all customer data to a spreadsheet every Monday</span>
      </div>
    </div>
    <div class="pipeline" id="pipeline">
      <div class="empty-state" id="emptyState">
        <div class="empty-icon">⌬</div>
        <p>Enter a raw objective above to begin the collapse pipeline.</p>
        <p style="font-size:11px;color:var(--text-dim)">No representation exists until an Objective Molecule is collapsed and validated.</p>
      </div>
    </div>
  </main>
</div>
<script>
const FUNCTION_URL='/functions/runCCE';
function setExample(el){document.getElementById('rawInput').value=el.textContent.trim()}
document.querySelectorAll('.stage-item').forEach(el=>el.addEventListener('click',()=>{const s=document.getElementById('section-'+el.dataset.stage);if(s)s.scrollIntoView({behavior:'smooth',block:'start'})}));
function setDot(s,st){const d=document.getElementById('dot-'+s);if(d)d.className='stage-dot '+st}
function setG(k,holds){const bar=document.getElementById('gbar-'+k),stat=document.getElementById('gstat-'+k);if(!bar||!stat)return;bar.style.width=holds?'100%':'30%';bar.style.background=holds?'var(--green)':'var(--red)';stat.textContent=holds?'✓':'✗';stat.className='g-status '+(holds?'ok':'err')}
function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function appendCard(id,html){const p=document.getElementById('pipeline');const e=document.getElementById('emptyState');if(e)e.remove();const w=document.createElement('div');w.id='section-'+id;w.innerHTML=html;p.appendChild(w)}
function appendSpinner(id,msg){const p=document.getElementById('pipeline');const e=document.getElementById('emptyState');if(e)e.remove();const el=document.createElement('div');el.id='spinner-'+id;el.innerHTML='<div class="stage-card running" style="padding:16px 20px"><div class="spinner-row"><div class="spinner"></div><span>'+msg+'</span></div></div>';p.appendChild(el)}
function removeSpinner(id){const el=document.getElementById('spinner-'+id);if(el)el.remove()}

async function runPipeline(){
  const raw=document.getElementById('rawInput').value.trim();if(!raw)return;
  const btn=document.getElementById('submitBtn');btn.disabled=true;btn.textContent='Collapsing…';
  const pipeline=document.getElementById('pipeline');pipeline.innerHTML='';
  ['authinput','opl','cce','car1','graph','cgs1','ui','fabric','guarantees'].forEach(s=>setDot(s,''));
  ['fr0','car1','cgs1','mocl'].forEach(k=>{const b=document.getElementById('gbar-'+k),st=document.getElementById('gstat-'+k);if(b)b.style.width='0%';if(st){st.textContent='—';st.className='g-status pend'}});
  document.getElementById('sessionInfo').textContent='Running…';
  setDot('authinput','running');appendCard('authinput',renderAuthInput(raw));setDot('authinput','done');
  setDot('opl','running');appendSpinner('opl','OPL proposing candidates…');
  let data;
  try{const r=await fetch(FUNCTION_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({raw_text:raw,context_state:{source:'authorigin_ui'}})});data=await r.json()}
  catch(err){const p=document.getElementById('pipeline');p.innerHTML+='<div class="stage-card error" style="padding:20px"><span class="text-red">⚠ '+esc(err.message)+'</span></div>';btn.disabled=false;btn.textContent='Collapse →';return}
  removeSpinner('opl');
  document.getElementById('sessionInfo').innerHTML='<span style="font-family:var(--mono);font-size:10px;word-break:break-all">'+(data.session_id||'—')+'</span>';
  if(data.status==='blocked_ambiguity'){setDot('opl','done');appendCard('opl',renderOPL(data.candidates||[],null));setDot('cce','blocked');appendCard('cce',renderBlocked(data));btn.disabled=false;btn.textContent='Collapse →';return}
  if(data.status==='blocked_elastic_constraints'){const oplS=data.pipeline_stages?.find(s=>s.stage==='OPL');setDot('opl','done');appendCard('opl',renderOPL(oplS?.candidates||[],data.active_om?.singular_goal));setDot('cce','done');appendCard('cce',renderCCE(data));setDot('car1','error');appendCard('car1',renderCAR1(data.car_result,true));btn.disabled=false;btn.textContent='Collapse →';return}
  const oplS=data.pipeline_stages?.find(s=>s.stage==='OPL');
  setDot('opl','done');appendCard('opl',renderOPL(oplS?.candidates||[],data.active_om?.singular_goal));
  setDot('cce','done');appendCard('cce',renderCCE(data));
  setDot('car1',data.car_result?.cdc_holds?'done':'error');appendCard('car1',renderCAR1(data.car_result,false));if(data.formal_guarantees?.CAR1)setG('car1',data.formal_guarantees.CAR1.holds);
  setDot('graph','done');appendCard('graph',renderGraph(data.execution_graph));
  setDot('cgs1',data.cgs_result?.pet_holds?'done':'error');appendCard('cgs1',renderCGS1(data.cgs_result));if(data.formal_guarantees?.CGS1)setG('cgs1',data.formal_guarantees.CGS1.holds);
  setDot('ui','done');appendCard('ui',renderUI(data.ui_projection));if(data.formal_guarantees?.FR0)setG('fr0',data.formal_guarantees.FR0.holds);if(data.formal_guarantees?.MOCL1)setG('mocl',data.formal_guarantees.MOCL1.holds);
  setDot('fabric','done');appendCard('fabric',renderFabric(data.fabric_chain||[]));
  setDot('guarantees','done');appendCard('guarantees',renderGuarantees(data.formal_guarantees));
  btn.disabled=false;btn.textContent='Collapse →';
}

function renderAuthInput(raw){return'<div class="stage-card done"><div class="card-header"><div class="card-icon icon-blue">📥</div><div><div class="card-title">AuthInput</div><div class="card-subtitle">Raw intent captured — no semantics resolved</div></div><div class="card-status-badge sb-done">Captured</div></div><div class="card-body"><div class="auth-raw">'+esc(raw)+'</div><div class="meta-row"><div class="meta-item"><span class="meta-key">Status</span><span class="meta-val">processing</span></div><div class="meta-item"><span class="meta-key">Interpretation</span><span class="meta-val text-red">none — blocked until collapse</span></div><div class="meta-item"><span class="meta-key">Decisions made</span><span class="meta-val text-red">zero</span></div></div></div></div>'}

function renderOPL(candidates,winnerGoal){const cards=candidates.map((c,i)=>{const isW=winnerGoal&&c.singular_goal===winnerGoal,isR=winnerGoal&&!isW,pct=Math.round((c.confidence||0)*100);return'<div class="candidate-card '+(isW?'selected':isR?'rejected':'')+'"><div class="cand-header"><div class="cand-idx">'+(i+1)+'</div><div class="cand-goal">'+esc(c.singular_goal||'')+'</div><div class="conf-bar-wrap"><span class="conf-label">conf</span><div class="conf-track"><div class="conf-fill" style="width:'+pct+'%"></div></div><span style="font-size:11px;font-family:var(--mono);color:var(--text-mid)">'+pct+'%</span></div></div>'+(isW?'<div style="font-size:10px;color:var(--green);font-weight:700;margin-bottom:6px">✓ SELECTED BY CCE</div>':'')+(isR?'<div style="font-size:10px;color:var(--red);font-weight:700;margin-bottom:6px">✗ REJECTED BY CCE</div>':'')+'</div>'}).join('');return'<div class="stage-card done"><div class="card-header"><div class="card-icon icon-purple">🔬</div><div><div class="card-title">Objective Proposal Layer (OPL)</div><div class="card-subtitle">AI proposes candidate OMs — ambiguity permitted here only</div></div><div class="card-status-badge sb-done">'+candidates.length+' candidate'+(candidates.length!==1?'s':'')+'</div></div><div class="card-body"><div class="section-title">Candidate Objective Molecules</div><div class="candidates-grid">'+cards+'</div><div class="mt12" style="font-size:11px;color:var(--text-dim)">↳ All candidates pass to CCE. Only one survives. Multiplicity ends here.</div></div></div>'}

function renderCCE(data){const om=data.active_om;if(!om)return'';const rejected=data.rejected_oms||[];const inPills=rejected.map(r=>'<div class="collapse-pill loser">'+esc((r.singular_goal||'').slice(0,40))+'…</div>').join('');const excls=(om.exclusion_conditions||[]).map(e=>'<span class="excl-tag">'+esc(e)+'</span>').join('');return'<div class="stage-card done"><div class="card-header"><div class="card-icon icon-purple">⚡</div><div><div class="card-title">Canonical Collapse Engine (CCE)</div><div class="card-subtitle">'+esc(data.cce_decision||'')+' — '+esc(data.cce_reason||'')+'</div></div><div class="card-status-badge sb-done">Collapsed</div></div><div class="card-body"><div class="collapse-visual"><div class="collapse-in">'+(rejected.length?inPills:'<div class="collapse-pill loser" style="opacity:.3">no competitors</div>')+'<div class="collapse-pill winner">✓ '+esc((om.singular_goal||'').slice(0,40))+'</div></div><div class="collapse-arrow">→</div><div class="collapse-out"><div class="collapse-out-label">Active OM</div><div class="collapse-out-goal">'+esc(om.singular_goal||'')+'</div></div></div><div class="om-fields"><div class="om-field" style="grid-column:1/-1"><div class="om-field-key">Success Condition</div><div class="om-field-val">'+esc(om.success_condition||'')+'</div></div><div class="om-field"><div class="om-field-key">Confidence</div><div class="om-field-val mono">'+((om.confidence||0)*100).toFixed(0)+'%</div></div><div class="om-field"><div class="om-field-key">Status</div><div class="om-field-val text-green mono">active — immutable</div></div><div class="om-field" style="grid-column:1/-1"><div class="om-field-key">Exclusion Conditions</div><div class="om-field-val"><div class="exclusions">'+(excls||'<span style="color:var(--text-dim)">none</span>')+'</div></div></div><div class="om-field"><div class="om-field-key">Lineage Hash</div><div class="hash-val">'+(om.lineage_hash||'').slice(0,20)+'…</div></div><div class="om-field"><div class="om-field-key">Isolation Domain</div><div class="hash-val">'+esc(om.isolation_domain_id||'—')+'</div></div></div></div></div>'}

function renderBlocked(data){return'<div class="stage-card blocked"><div class="card-header"><div class="card-icon icon-amber">🚫</div><div><div class="card-title">CCE — Blocked: Ambiguity Not Resolvable</div><div class="card-subtitle">No representation emitted. Clarification required.</div></div><div class="card-status-badge sb-blocked">Blocked</div></div><div class="card-body"><div class="block-panel"><div class="block-title">⚠ CCE cannot collapse to a single objective</div><div class="block-msg">Multiple incompatible interpretations exist. The system cannot proceed to execution without a single canonical OM. No feature, UI, or execution path has been generated.</div>'+(data.clarification_question?'<div class="block-question">💬 '+esc(data.clarification_question)+'</div>':'')+'</div></div></div>'}

function renderCAR1(car,isErr){if(!car)return'';const constraints=(car.processed_constraints||[]).map(c=>{const ok=c.cdc_valid,acf=c.acf||{},forbList=(acf.forbidden_transitions||[]).map(f=>'<li style="color:var(--text-dim)">'+esc(f)+'</li>').join('');return'<div class="constraint-row '+(ok?'valid':'invalid')+'"><div class="cstr-header"><span class="cstr-type '+c.type+'">'+c.type+'</span><span class="cstr-rule">'+esc(c.rule||'')+'</span><span class="cstr-score '+(ok?'ok':'err')+' mono">CDC: '+(ok?'1.0 ✓':'✗')+'</span></div><div class="acf-grid"><div class="acf-item"><span class="acf-key">Observable Condition</span><span class="acf-val">'+esc(acf.observable_condition||'—')+'</span></div><div class="acf-item"><span class="acf-key">Allowed Transition</span><span class="acf-val">'+esc(acf.allowed_transition||'—')+'</span></div><div class="acf-item"><span class="acf-key">Verification</span><span class="acf-val">'+esc(acf.verification_method||'—')+'</span></div><div class="acf-item"><span class="acf-key">Forbidden Transitions</span><span class="acf-val">'+(forbList?'<ul style="padding-left:14px;margin:0">'+forbList+'</ul>':'—')+'</span></div></div>'+(c.elastic_terms?.length?'<div style="padding:8px 12px;background:var(--amber-dim);font-size:10px;color:var(--amber)">⚠ Elastic: '+c.elastic_terms.join(', ')+'</div>':'')+'</div>'}).join('');const elasticAlert=car.elastic_constraints_detected?.length?'<div class="elastic-alert">⚠ Elastic language: <strong>'+car.elastic_constraints_detected.join(', ')+'</strong> — rewrite in ACF required</div>':'';return'<div class="stage-card '+(isErr?'error':'done')+'"><div class="card-header"><div class="card-icon '+(isErr?'icon-red':'icon-purple')+'">🔒</div><div><div class="card-title">CAR-1 — Constraint Adversarial Resistance</div><div class="card-subtitle">Constraint Determinism Condition (CDC)</div></div><div class="card-status-badge '+(isErr?'sb-error':'sb-done')+'">'+(car.cdc_holds?'CDC Holds':'Elastic Detected')+'</div></div><div class="card-body">'+elasticAlert+'<div class="section-title">Constraints → Atomic Constraint Form</div><div class="constraints-list">'+constraints+'</div><div class="meta-row mt12"><div class="meta-item"><span class="meta-key">Constraint Hash</span><span class="meta-val mono" style="font-size:10px">'+(car.constraint_hash||'').slice(0,20)+'…</span></div><div class="meta-item"><span class="meta-key">State Set Hash</span><span class="meta-val mono" style="font-size:10px">'+(car.allowed_state_set_hash||'').slice(0,20)+'…</span></div></div></div></div>'}

function renderGraph(eg){if(!eg)return'';const nc={compute:'gn-compute',retrieve:'gn-retrieve',transform:'gn-transform',render:'gn-render'};const ni={compute:'⚙',retrieve:'📡',transform:'⟳',render:'◉'};const nodes=eg.nodes||[],edges=eg.edges||[];const inDeg={};nodes.forEach(n=>inDeg[n.node_id]=0);edges.forEach(e=>{if(inDeg[e.to]!==undefined)inDeg[e.to]++});let q=nodes.filter(n=>inDeg[n.node_id]===0);const ord=[];while(q.length){const n=q.shift();ord.push(n);edges.filter(e=>e.from===n.node_id).forEach(e=>{inDeg[e.to]--;if(inDeg[e.to]===0)q.push(nodes.find(x=>x.node_id===e.to))})}const rem=nodes.filter(n=>!ord.find(o=>o.node_id===n.node_id));const final=[...ord,...rem];const gn=final.map((n,i)=>'<div class="graph-node '+(nc[n.action_type]||'gn-compute')+'"><div class="gn-label">'+(ni[n.action_type]||'·')+' '+n.action_type+'</div><div class="gn-name">'+esc(n.label||n.node_id)+'</div></div>'+(i<final.length-1?'<div class="graph-arrow">→</div>':'')).join('');const bc={compute:'#52a8e0',retrieve:'#7c6af7',transform:'#e0a852',render:'#3dba7e'};const nl=final.map(n=>'<div class="node-row"><span style="font-size:9px;font-weight:700;text-transform:uppercase;padding:2px 6px;border-radius:3px;background:'+(bc[n.action_type]||'#888')+'22;color:'+(bc[n.action_type]||'#888')+';border:1px solid '+(bc[n.action_type]||'#888')+'44">'+n.action_type+'</span><span style="font-size:12px;font-weight:600;flex:1">'+esc(n.label||n.node_id)+'</span><span style="font-family:var(--mono);font-size:9px;color:var(--text-dim)">'+esc(n.node_id)+'</span><span style="font-size:10px;color:var(--green);margin-left:8px" title="OM bound">⊕OM</span></div>').join('');return'<div class="stage-card done"><div class="card-header"><div class="card-icon icon-amber">🕸</div><div><div class="card-title">Execution Graph</div><div class="card-subtitle">'+nodes.length+' nodes · '+edges.length+' edges · all bound to active OM</div></div><div class="card-status-badge sb-done">'+(eg.status||'valid')+'</div></div><div class="card-body"><div class="section-title">Execution Flow</div><div class="graph-wrap"><div class="graph-flow">'+gn+'</div></div><div class="section-title mt12">Node Details</div><div class="nodes-list">'+nl+'</div>'+(eg.validation_errors?.length?'<div style="color:var(--red);font-size:11px;margin-top:8px">⚠ CPC violations: '+esc(eg.validation_errors.join('; '))+'</div>':'')+'</div></div>'}

function renderCGS1(cgs){if(!cgs)return'';const pc=(cgs.paths||[]).map(p=>{const ok=p.outcome_hash===cgs.canonical_outcome_hash;const seq=(p.node_sequence||[]).map(n=>'<span class="path-node-chip">'+esc(n)+'</span>').join('<span class="path-sep"> → </span>');return'<div class="path-card"><div class="path-header"><span class="path-id">'+esc(p.path_id)+'</span><span class="path-pet '+(ok?'ok':'err')+'">'+(ok?'✓ PET holds':'✗ PET fail')+'</span></div><div class="path-seq">'+seq+'</div><div class="outcome-box"><div class="outcome-label">Outcome</div>'+esc(p.outcome_description||'—')+'</div></div>'}).join('');return'<div class="stage-card '+(cgs.pet_holds?'done':'error')+'"><div class="card-header"><div class="card-icon icon-blue">∞</div><div><div class="card-title">CGS-1 — Controlled Generative Space</div><div class="card-subtitle">Execution Manifold + Path Equivalence Test (PET)</div></div><div class="card-status-badge '+(cgs.pet_holds?'sb-done':'sb-error')+'">'+(cgs.pet_holds?'PET holds':'Divergence')+'</div></div><div class="card-body"><div class="meta-row" style="margin-bottom:16px"><div class="meta-item"><span class="meta-key">Manifold ID</span><span class="meta-val mono" style="font-size:10px">'+esc(cgs.manifold_id||'—')+'</span></div><div class="meta-item"><span class="meta-key">Equiv. Class</span><span class="meta-val mono" style="font-size:10px">'+(cgs.equivalence_class_id||'').slice(0,16)+'…</span></div><div class="meta-item"><span class="meta-key">Creative Variance</span><span class="meta-val mono">'+((cgs.creative_variance_score||0)*100).toFixed(0)+'%</span></div><div class="meta-item"><span class="meta-key">Path Variance</span><span class="meta-val mono '+(cgs.path_variance>0?'text-red':'text-green')+'">'+cgs.path_variance+'</span></div></div><div class="section-title">Execution Manifold</div><div class="paths-grid">'+pc+'</div><div class="mt12" style="font-size:11px;color:var(--text-dim)">∀ p1,p2 ∈ EM: outcome(p1) = outcome(p2)</div></div></div>'}

function renderUI(ui){if(!ui)return'';const adm=(ui.allowed_surfaces||[]).map(s=>'<div class="surface-card admitted"><div class="surf-header"><span class="surf-status admitted">✓ admitted</span><span class="surf-label">'+esc(s.label||s.surface_id)+'</span></div><div class="surf-proof">Proof: '+esc((s.cpc_proof_path||s.cpc_proof||[]).join(' → '))||'AuthInput → OM → Collapse → Execution → Render'+'</div></div>').join('');const blk=(ui.blocked_surfaces||[]).map(s=>'<div class="surface-card blocked"><div class="surf-header"><span class="surf-status blocked">✗ blocked</span><span class="surf-label">'+esc(s.surface_id)+'</span></div><div style="font-size:11px;color:var(--text-dim);margin-top:4px">'+esc(s.reason||'—')+'</div></div>').join('');return'<div class="stage-card done"><div class="card-header"><div class="card-icon icon-green">◉</div><div><div class="card-title">UI Materialisation</div><div class="card-subtitle">Projection of ExecutionGraph only — no speculative surfaces</div></div><div class="card-status-badge sb-done">Projected</div></div><div class="card-body"><div class="section-title">Admitted Surfaces ('+(ui.allowed_surfaces||[]).length+')</div><div class="surfaces-list">'+(adm||'<span class="text-dim" style="font-size:12px">No admitted surfaces</span>')+'</div>'+(blk?'<div class="section-title mt12">Blocked Surfaces ('+(ui.blocked_surfaces||[]).length+')</div><div class="surfaces-list">'+blk+'</div>':'')+'<div style="margin-top:12px;font-size:11px;color:var(--text-dim)">FR-0: <span class="'+(ui.fr0==='GUARANTEED'?'text-green':'text-amber')+'">'+esc(ui.fr0||'—')+'</span> · CAR: <span class="'+(ui.car==='DETERMINISTIC'?'text-green':'text-amber')+'">'+esc(ui.car||'—')+'</span> · CGS: <span class="'+(ui.cgs==='OUTCOME_INVARIANT'?'text-green':'text-amber')+'">'+esc(ui.cgs||'—')+'</span> · MOCL: <span class="'+(ui.mocl==='ISOLATED'?'text-green':'text-amber')+'">'+esc(ui.mocl||'—')+'</span></div></div></div>'}

function renderFabric(chain){if(!chain?.length)return'';const ik=[['singularity','SNG'],['no_orphan_execution','NOE'],['no_representation_without_collapse','NRC'],['no_speculative_features','NSF'],['cdc_holds','CDC'],['pet_holds','PET'],['mocl_isolation_holds','MOCL']];const entries=chain.map((e,i)=>{const isL=i===chain.length-1,inv=e.invariant_check||{},chips=ik.map(([k,l])=>{const v=inv[k];const c=v===true?'ok':v===false?'err':'na';return'<span class="inv-chip '+c+'">'+l+'</span>'}).join('');return'<div class="fabric-entry"><div class="fabric-timeline"><div class="fabric-dot '+e.event_type+'"></div>'+(isL?'':'<div class="fabric-line"></div>')+'</div><div class="fabric-content"><div class="fabric-event-header"><span class="event-type-tag et-'+e.event_type+'">'+e.event_type+'</span><span style="font-size:11px;color:var(--text-dim)">#'+(i+1)+'</span></div><div class="fabric-summary">'+esc(e.payload_summary||'—')+'</div><div class="fabric-hashes"><div class="fh"><span class="fh-key">hash</span><span class="fh-val">'+(e.hash||'').slice(0,24)+'…</span></div>'+(e.parent_hash?'<div class="fh"><span class="fh-key">parent</span><span class="fh-val">'+e.parent_hash.slice(0,24)+'…</span></div>':'<div class="fh"><span class="fh-key">parent</span><span class="fh-val text-accent">genesis</span></div>')+'</div><div class="invariant-chips">'+chips+'</div></div></div>'}).join('');return'<div class="stage-card done"><div class="card-header"><div class="card-icon icon-green">⛓</div><div><div class="card-title">origin.fabric</div><div class="card-subtitle">Append-only causal chain — '+chain.length+' entries — no overwrites</div></div><div class="card-status-badge sb-done">Sealed</div></div><div class="card-body"><div class="fabric-chain">'+entries+'</div></div></div>'}

function renderGuarantees(fg){if(!fg)return'';const layers=[{key:'FR0',name:'FR-0',color:'var(--green)',sub:'Anti-find_REPLACE'},{key:'CAR1',name:'CAR-1',color:'var(--accent)',sub:'Constraint Determinism'},{key:'CGS1',name:'CGS-1',color:'var(--blue)',sub:'Outcome Invariance'},{key:'MOCL1',name:'MOCL-1',color:'var(--amber)',sub:'OM Isolation'}];const cells=layers.map(l=>{const g=fg[l.key]||{},h=g.holds;return'<div class="gs-cell"><div class="gs-layer" style="color:'+l.color+'">'+l.name+' — '+l.sub+'</div><div class="gs-holds '+(h?'yes':'no')+'">'+(h?'✓':'✗')+'</div><div class="gs-stmt">'+esc(g.statement||'—')+'</div>'+(g.elastic?.length?'<div style="font-size:10px;color:var(--red);margin-top:4px">Elastic: '+g.elastic.join(', ')+'</div>':'')+(g.omm_required?'<div style="font-size:10px;color:var(--amber);margin-top:4px">OMM mediation required</div>':'')+'</div>'}).join('');const all=layers.every(l=>fg[l.key]?.holds);return'<div class="stage-card '+(all?'done':'error')+'"><div class="card-header"><div class="card-icon '+(all?'icon-green':'icon-red')+'">Σ</div><div><div class="card-title">Formal Guarantees</div><div class="card-subtitle">'+(all?'All layers hold — system is collapse-complete':'One or more layers failed')+'</div></div><div class="card-status-badge '+(all?'sb-done':'sb-error')+'">'+(all?'All guaranteed':'Partial')+'</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:0;background:var(--surface)">'+cells+'</div></div>'}

document.getElementById('rawInput').addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter')runPipeline()});
</script>
</body>
</html>`;

Deno.serve(async (req) => {
  if (req.method === 'GET') {
    return new Response(HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
  return new Response('Method Not Allowed', { status: 405 });
});
