/**
 * The only place raw HTML strings get built. Kept separate from
 * controllers so a controller's job stays "call a service, pick a
 * status code" — not string-templating markup (Single
 * Responsibility). If this portal grows a real template engine or
 * frontend later, this is the one file that gets replaced.
 *
 * @complexity escapeHtml: O(m) time in the string length m. layout:
 *   O(m) time in the body length m (simple concatenation).
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(title, bodyHtml) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b0e0c"><title>${escapeHtml(title)} · DOGFOOD</title>
<style>
  :root{color-scheme:dark;--ink:#f1f3ed;--muted:#a0a89f;--line:#303730;--panel:#151a16;--panel-2:#1b211c;--acid:#c3ef72;--coral:#ff927c;--cyan:#8fd9c3;--bg:#0b0e0c}
  *{box-sizing:border-box}html{min-height:100%;background:var(--bg)}
  body{margin:0;color:var(--ink);font:15px/1.6 Georgia,"Times New Roman",serif;background:repeating-linear-gradient(0deg,rgba(255,255,255,.012) 0,rgba(255,255,255,.012) 1px,transparent 1px,transparent 5px),linear-gradient(135deg,#101411,var(--bg) 54%);min-height:100vh}
  a{color:var(--acid);text-decoration:none}a:hover{text-decoration:underline;text-underline-offset:4px}
  .shell{width:min(1180px,calc(100% - 44px));margin:0 auto;padding:24px 0 64px}
  .topbar{display:flex;justify-content:space-between;align-items:center;gap:24px;border-bottom:1px solid var(--line);padding:0 0 18px;margin-bottom:36px;font-family:system-ui,sans-serif}
  .brand{display:flex;align-items:center;gap:12px;color:var(--ink);font:700 13px/1 system-ui,sans-serif;letter-spacing:.04em}
  .brand-mark{display:grid;place-items:center;width:34px;height:34px;background:var(--acid);color:#131810;border-radius:4px;font:900 16px/1 system-ui,sans-serif}
  .brand small{display:block;margin-top:5px;color:var(--muted);font:10px/1 system-ui,sans-serif;letter-spacing:.11em;text-transform:uppercase}
  nav{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px 20px;font:11px/1 system-ui,sans-serif;text-transform:uppercase}
  nav a{color:#d3d8d0}nav a:hover{color:var(--acid);text-decoration:none}
  .nav-common{display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px}
  .role-menu{position:relative;font:11px/1 system-ui,sans-serif}
  .role-menu summary{cursor:pointer;list-style:none;border:1px solid #566055;border-radius:3px;padding:10px 12px;color:var(--acid);white-space:nowrap}
  .role-menu summary::-webkit-details-marker{display:none}
  .role-menu summary::after{content:"";display:inline-block;margin:0 0 3px 12px;width:7px;height:7px;border-right:1px solid currentColor;border-bottom:1px solid currentColor;transform:rotate(45deg);transition:transform .16s ease}
  .role-menu[open] summary::after{transform:rotate(225deg);margin-bottom:0}
  .role-menu-items{position:absolute;z-index:10;top:calc(100% + 8px);right:0;display:grid;gap:2px;min-width:190px;padding:6px;border:1px solid var(--line);border-radius:4px;background:#151a16;box-shadow:0 12px 28px #0009}
  .role-menu-items a,.role-menu-items button{width:100%;justify-content:flex-start;border:0;border-radius:2px;background:transparent;color:var(--ink);padding:10px;text-align:left;font:11px/1.3 system-ui,sans-serif;text-transform:uppercase}
  .role-menu-items a:hover,.role-menu-items button:hover{background:#252d25;color:var(--acid);text-decoration:none}
  .role-menu-items .menu-caption{padding:8px 10px;color:var(--muted);font:10px/1.2 system-ui,sans-serif;text-transform:uppercase}
  .repeat-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;align-items:end;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}.repeat-row label{min-width:0}
  main{animation:arrive .42s ease-out both}h1,h2,h3{line-height:1.12}h1{font-size:clamp(30px,4vw,45px);font-weight:400;margin:4px 0 16px}h2{font-size:24px;font-weight:400}h3{font-size:19px;font-weight:400}
  p{margin:10px 0 16px}.eyebrow{font:11px/1.3 system-ui,sans-serif;color:var(--acid);text-transform:uppercase;letter-spacing:.1em}.muted,.meta{color:var(--muted);font:12px/1.5 system-ui,sans-serif}
  .card,.project-card,.panel{background:var(--panel);border:1px solid var(--line);border-radius:5px;padding:20px;margin-bottom:12px;min-width:0}
  .project-grid,.metric-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.project-card{margin:0;min-height:190px;animation:arrive .45s ease-out both;transition:border-color .18s ease,transform .18s ease}.project-card:hover{border-color:#73865b;transform:translateY(-2px)}.project-card:nth-child(3n + 2) .track-tag{color:var(--cyan);border-color:#36594c}.project-card:nth-child(3n) .track-tag{color:var(--coral);border-color:#69473f}
  .project-card h2{margin:16px 0 8px}.project-card p{color:#c0c7be}.track-tag,.status{display:inline-flex;align-items:center;border:1px solid #46513d;border-radius:3px;padding:4px 8px;color:var(--acid);font:10px/1.2 system-ui,sans-serif;text-transform:uppercase}
  .card-top,.row-between{display:flex;justify-content:space-between;align-items:center;gap:14px}.metric{background:var(--panel-2);border-top:2px solid var(--acid);padding:18px}.metric strong{display:block;font:30px/1.1 Georgia,serif}.metric span{font:10px/1.3 system-ui,sans-serif;color:var(--muted);text-transform:uppercase}
  .toolbar,.form-row{display:flex;align-items:end;gap:10px;flex-wrap:wrap;margin:22px 0}.toolbar>label{flex:1 1 220px}.toolbar>label:last-of-type{flex:0 1 230px}
  label{display:block;color:#c9d0c7;font:11px/1.4 system-ui,sans-serif;text-transform:uppercase}input,textarea,select{display:block;width:100%;margin-top:7px;padding:11px 12px;border:1px solid #414940;border-radius:3px;background:#0e120f;color:var(--ink);font:14px/1.4 system-ui,sans-serif}textarea{min-height:100px;resize:vertical}
  button,.button{display:inline-flex;justify-content:center;align-items:center;min-height:40px;padding:9px 15px;border:1px solid var(--acid);border-radius:3px;background:var(--acid);color:#141a10;font:700 11px/1.2 system-ui,sans-serif;text-transform:uppercase;cursor:pointer}button:hover,.button:hover{background:#d7f99d;text-decoration:none}button.secondary,.button.secondary{background:transparent;color:var(--ink);border-color:#566055}
  .table-wrap{width:100%;overflow-x:auto;border:1px solid var(--line);border-radius:4px}table{width:100%;border-collapse:collapse;min-width:620px;background:var(--panel);font:13px/1.4 system-ui,sans-serif}th,td{text-align:left;padding:12px 14px;border-bottom:1px solid var(--line)}th{color:var(--muted);font-size:10px;text-transform:uppercase;font-weight:500}tr:last-child td{border-bottom:0}
  progress{width:100%;height:7px;accent-color:var(--acid)}.section-head{display:flex;justify-content:space-between;align-items:end;gap:18px;margin:34px 0 14px}.section-head h2{margin:0}.notice{padding:14px 16px;border-left:2px solid var(--coral);background:#211714;color:#ead4cf}.split{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(240px,.6fr);gap:16px}.comment{padding:12px 0;border-bottom:1px solid var(--line)}.empty{padding:40px;text-align:center;border:1px dashed #414940;color:var(--muted)}
  footer{border-top:1px solid var(--line);margin-top:54px;padding-top:16px;color:var(--muted);font:10px/1.4 system-ui,sans-serif;text-transform:uppercase;letter-spacing:.07em}
  @keyframes arrive{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;scroll-behavior:auto!important}}
  h1{font-size:42px}@media(max-width:760px){h1{font-size:32px}.shell{width:min(100% - 28px,640px);padding-top:16px}.topbar{align-items:flex-start;flex-direction:column;margin-bottom:28px}.topbar nav{justify-content:flex-start}.project-grid,.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.split{grid-template-columns:1fr}.section-head{align-items:flex-start;flex-direction:column}}
  @media(max-width:480px){.project-grid,.metric-grid{grid-template-columns:1fr}.project-card{min-height:0}.toolbar button{width:100%}.shell{width:calc(100% - 24px)}.repeat-row{grid-template-columns:1fr auto}.repeat-row label:nth-of-type(2){grid-column:1/-1}.repeat-row .remove-row{grid-column:2}}
</style></head>
<body><div class="shell"><header class="topbar"><a class="brand" href="/projects"><span class="brand-mark">D</span><span>DOGFOOD<small>Event operations</small></span></a><nav aria-label="Main navigation"><div class="nav-common"><a href="/projects">Gallery</a><a href="/api-docs">API reference</a><a href="/embed/gallery">Embed</a></div><details class="role-menu"><summary id="role-menu-label">Sections</summary><div class="role-menu-items" id="role-menu-items"><span class="menu-caption">Loading access</span></div></details></nav></header><main>${bodyHtml}</main><footer>DOGFOOD Portal <span>·</span> Self-hosted event infrastructure</footer></div><script>(()=>{const label=document.getElementById("role-menu-label");const menu=document.getElementById("role-menu-items");const roles={organizer:{label:"Organizer sections",items:[["Overview","/organizer"],["Event setup","/organizer/event"],["Score export","/api/export.csv"],["Project export","/api/export/projects.csv"],["Judge progress","/organizer/judging/progress"],["Normalized results","/organizer/results"],["Audit trail","/organizer/audit"],["Webhook activity","/organizer/webhooks"]]},judge:{label:"Judge sections",items:[["Judge desk","/judge"],["Assigned projects","/judge/assignments"],["My scores","/judge/scores"]]},participant:{label:"Participant sections",items:[["My projects","/participant/projects"],["Submit project","/projects/new"]]},guest:{label:"Visitor access",items:[["Sign in","/login"],["Start a team","/teams/new"]]}};function addLink(text,url){const link=document.createElement("a");link.textContent=text;link.href=url;menu.append(link)}fetch("/api/session",{headers:{Accept:"application/json"}}).then(response=>response.ok?response.json():{user:null}).then(({user})=>{const role=user&&roles[user.role]?user.role:"guest";label.textContent=roles[role].label;menu.replaceChildren();roles[role].items.forEach(([text,url])=>addLink(text,url));if(role==="participant"&&user.teamId)addLink("My team","/teams/"+encodeURIComponent(user.teamId));if(user){const form=document.createElement("form");form.method="post";form.action="/logout";const button=document.createElement("button");button.type="submit";button.textContent="Sign out";form.append(button);menu.append(form)}}).catch(()=>{label.textContent=roles.guest.label;menu.replaceChildren();roles.guest.items.forEach(([text,url])=>addLink(text,url))})})()</script></body></html>`;
}

module.exports = { escapeHtml, layout };
