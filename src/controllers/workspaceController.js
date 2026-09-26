const express = require("express");
const { requireRole } = require("../auth/requireRole");
const { layout, escapeHtml } = require("../views/html");

function buildWorkspaceController(services, repositories) {
  const router = express.Router();
  const { judging } = services;

  router.get("/judge/assignments", requireRole("judge"), (req, res) => {
    const scored = new Set(repositories.score.byJudge(req.user.judgeId).map((score) => score.project));
    const rows = judging.assignmentsFor(req.user.judgeId).map((assignment) => {
      const project = repositories.project.get(assignment.project);
      if (!project) return "";
      return `<tr><td><a href="/projects/${escapeHtml(project.id)}">${escapeHtml(project.title)}</a></td><td>${escapeHtml(project.track || "Open track")}</td><td>${scored.has(project.id) ? "Complete" : "Awaiting score"}</td><td>${scored.has(project.id) ? '<span class="status">Submitted</span>' : '<a href="/judge">Open judge desk</a>'}</td></tr>`;
    }).join("");
    res.status(200).send(layout("Assigned projects", `<p class="eyebrow">Private review list</p><h1>Assigned projects</h1><p class="muted">Only projects assigned to your judge identity and tracks appear here.</p><div class="table-wrap"><table><thead><tr><th>Project</th><th>Track</th><th>Progress</th><th>Action</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No projects assigned yet.</td></tr>'}</tbody></table></div>`));
  });

  router.get("/judge/scores", requireRole("judge"), (req, res) => {
    const scores = judging.scoresFor(req.user.judgeId, null);
    const rows = scores.map((score) => {
      const project = repositories.project.get(score.project);
      const criteria = Object.entries(score.criteria || {}).map(([name, value]) => `<span class="track-tag">${escapeHtml(name)} · ${escapeHtml(value)}</span>`).join(" ");
      return `<tr><td>${escapeHtml(project ? project.title : score.project)}</td><td>${criteria}</td><td>${escapeHtml(score.comment || "")}</td><td>${escapeHtml(score.created_at || "")}</td></tr>`;
    }).join("");
    res.status(200).send(layout("My scores", `<p class="eyebrow">Private judge history</p><h1>My scores</h1><div class="table-wrap"><table><thead><tr><th>Project</th><th>Criteria</th><th>Feedback</th><th>Submitted</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No ballots submitted yet.</td></tr>'}</tbody></table></div>`));
  });

  router.get("/organizer/judging/progress", requireRole("organizer"), (_req, res) => {
    const progress = judging.progress();
    const rows = progress.map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.track || "Open track")}</td><td>${item.scored} / ${item.assigned}</td><td><progress value="${item.scored}" max="${Math.max(1, item.assigned)}"></progress></td><td>${escapeHtml(item.status)}</td></tr>`).join("");
    res.status(200).send(layout("Judging progress", `<p class="eyebrow">Organizer view</p><h1>Judging progress</h1><div class="table-wrap"><table><thead><tr><th>Project</th><th>Track</th><th>Reviews</th><th>Completion</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`));
  });

  router.get("/organizer/results", requireRole("organizer"), (_req, res) => {
    const results = judging.normalizedResults();
    const rawRows = results.raw.map((item) => `<tr><td>${item.rank}</td><td>${escapeHtml(item.title)}</td><td>${item.score.toFixed(2)}</td></tr>`).join("");
    const normalizedRows = results.normalized.map((item) => `<tr><td>${item.rank}</td><td>${escapeHtml(item.title)}</td><td>${item.score.toFixed(2)}</td></tr>`).join("");
    const comparison = results.projects.map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${item.reviews}</td><td>${item.raw === null ? "—" : item.raw.toFixed(2)}</td><td>${item.normalized === null ? "—" : item.normalized.toFixed(2)}</td></tr>`).join("");
    res.status(200).send(layout("Results", `<p class="eyebrow">Organizer analysis</p><h1>Score normalization</h1><p class="muted">${escapeHtml(results.method)}</p><div class="split"><section><h2>Raw ranking</h2><div class="table-wrap"><table><thead><tr><th>Rank</th><th>Project</th><th>Score</th></tr></thead><tbody>${rawRows}</tbody></table></div></section><section><h2>Normalized ranking</h2><div class="table-wrap"><table><thead><tr><th>Rank</th><th>Project</th><th>Score</th></tr></thead><tbody>${normalizedRows}</tbody></table></div></section></div><div class="section-head"><h2>Score comparison</h2><span class="meta">Raw and adjusted means</span></div><div class="table-wrap"><table><thead><tr><th>Project</th><th>Reviews</th><th>Raw</th><th>Normalized</th></tr></thead><tbody>${comparison}</tbody></table></div>`));
  });

  router.get("/organizer/audit", requireRole("organizer"), (_req, res) => {
    const entries = repositories.audit.list().slice().reverse();
    const rows = entries.map((entry) => {
      const details = Object.entries(entry.details || {}).map(([key, value]) => `${key.replaceAll("_", " ")}: ${Array.isArray(value) ? value.join(", ") : String(value)}`).join(" · ");
      return `<tr><td>${escapeHtml(entry.action.replaceAll(".", " "))}</td><td>${escapeHtml(details)}</td><td>${escapeHtml(entry.created_at)}</td></tr>`;
    }).join("");
    res.status(200).send(layout("Audit trail", `<p class="eyebrow">Organizer controls</p><h1>Event activity</h1><div class="table-wrap"><table><thead><tr><th>Activity</th><th>Details</th><th>Time</th></tr></thead><tbody>${rows || '<tr><td colspan="3">No activity recorded.</td></tr>'}</tbody></table></div>`));
  });

  router.get("/organizer/webhooks", requireRole("organizer"), (_req, res) => {
    const events = ["*", "project.submitted", "project.updated", "project.imported", "score.recorded", "vote.cast", "comment.created", "team.created", "team.invited", "team.joined", "event.updated", "judge.invited", "judge.joined", "judging.assignments.created", "judging.rubric.updated", "certificate.generated"];
    const options = events.map((event) => `<option value="${escapeHtml(event)}">${escapeHtml(event === "*" ? "All events" : event.replaceAll(".", " "))}</option>`).join("");
    const hooks = repositories.webhook.list().map((hook) => `<tr><td>${escapeHtml(hook.url)}</td><td>${escapeHtml(hook.event.replaceAll(".", " "))}</td><td>${escapeHtml(hook.created_at)}</td></tr>`).join("");
    const deliveries = repositories.webhookDelivery.list().slice().reverse().map((delivery) => `<tr><td>${escapeHtml(delivery.event.replaceAll(".", " "))}</td><td>${escapeHtml(delivery.status)}</td><td>${escapeHtml(delivery.response_status || delivery.error || "Awaiting result")}</td><td>${escapeHtml(delivery.attempted_at || delivery.created_at)}</td></tr>`).join("");
    res.status(200).send(layout("Webhooks", `<p class="eyebrow">Organizer integrations</p><h1>Webhook activity</h1><form id="webhook-form" class="panel"><label>Destination URL<input type="url" name="url" placeholder="https://example.org/webhook" required></label><label>Event<select name="event">${options}</select></label><button type="submit">Register endpoint</button><p id="webhook-status" class="muted" aria-live="polite"></p></form><div class="section-head"><h2>Registered endpoints</h2></div><div class="table-wrap"><table><thead><tr><th>URL</th><th>Event</th><th>Added</th></tr></thead><tbody>${hooks || '<tr><td colspan="3">No endpoints registered.</td></tr>'}</tbody></table></div><div class="section-head"><h2>Delivery attempts</h2></div><div class="table-wrap"><table><thead><tr><th>Event</th><th>Status</th><th>Response</th><th>Attempted</th></tr></thead><tbody>${deliveries || '<tr><td colspan="4">No deliveries yet.</td></tr>'}</tbody></table></div><script>document.getElementById("webhook-form").addEventListener("submit",async event=>{event.preventDefault();const form=new FormData(event.currentTarget);const response=await fetch("/api/v1/webhooks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(form.entries()))});const body=await response.json();document.getElementById("webhook-status").textContent=response.ok?"Endpoint registered. Signing secret: "+body.webhook.secret:"Registration failed: "+(body.error||"request rejected")})</script>`));
  });

  router.post("/organizer/webhooks", express.urlencoded({ extended: true }), requireRole("organizer"), (req, res) => {
    try {
      services.stretch.registerWebhook(req.body.url, req.body.event);
      res.redirect("/organizer/webhooks");
    } catch (error) {
      res.status(error.status || 400).send(layout("Webhook not registered", `<div class="notice">${escapeHtml(error.message)}</div><p><a href="/organizer/webhooks">Return to webhook activity</a></p>`));
    }
  });

  router.get("/api-docs", (_req, res) => {
    const groups = [
      ["Public", "Project gallery and detail · search by title or track · voting and comments"],
      ["Participant", "Team registration and invitations · project create and edit · team project list"],
      ["Judge", "Assigned review queue · private score history · criterion ballots"],
      ["Organizer", "Event setup · judge invitations · assignments · progress · results · exports · audit · webhook activity"],
      ["Integrations", "Bulk import · team and judge records · certificates · embeddable gallery"],
    ];
    const rows = groups.map(([role, capabilities]) => `<tr><td>${escapeHtml(role)}</td><td>${escapeHtml(capabilities)}</td></tr>`).join("");
    res.status(200).send(layout("API reference", `<p class="eyebrow">Integration guide</p><h1>API reference</h1><p>Use the JSON API for integrations; the portal screens provide the same workflows in a human-readable interface.</p><div class="table-wrap"><table><thead><tr><th>Access group</th><th>Capabilities</th></tr></thead><tbody>${rows}</tbody></table></div><div class="section-head"><h2>Published contract</h2></div><p><a class="button" href="/api/openapi.yaml" download>Download OpenAPI definition</a></p><p class="muted">Protected operations still enforce role and ownership checks on the server.</p>`));
  });

  return router;
}

module.exports = { buildWorkspaceController };