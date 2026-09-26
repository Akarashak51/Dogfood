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
    .replace(/>/g, "&gt;");
}

function layout(title, bodyHtml) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#1a1a1a}
  a{color:#2563eb;text-decoration:none} a:hover{text-decoration:underline}
  .card{border:1px solid #e5e5e5;border-radius:8px;padding:1rem;margin-bottom:1rem}
  .muted{color:#666;font-size:0.9rem}
  nav{margin-bottom:2rem}
  form textarea,form input{width:100%;padding:0.5rem;margin:0.25rem 0 0.75rem;box-sizing:border-box}
  button{padding:0.5rem 1rem;cursor:pointer}
</style></head>
<body><nav><a href="/projects">Gallery</a> · <a href="/projects/new">Submit a project</a></nav>${bodyHtml}</body></html>`;
}

module.exports = { escapeHtml, layout };
