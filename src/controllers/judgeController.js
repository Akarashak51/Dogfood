const express = require("express");
const { requireRole } = require("../auth/requireRole");
const { layout, escapeHtml } = require("../views/html");
const { handleControllerError } = require("./handleControllerError");

function formatAuditDetails(details) {
  return Object.entries(details || {}).map(([key, value]) =>
    `${key.replaceAll("_", " ")}: ${Array.isArray(value) ? value.join(", ") : String(value)}`
  ).join(" · ");
}

/**
 * @param {ReturnType<typeof import('../container').createContainer>['services']} services
 * @param {ReturnType<typeof import('../container').createContainer>['repositories']} repositories
 */
function buildJudgeController(services, repositories) {
  const router = express.Router();
  const { judging } = services;

  // T2 (FR-2.1, FR-2.2): the ?judge= query param names WHOSE scores are
  // being asked for (see .dogfood.toml's peer_scores route); omitted, it
  // defaults to "my own". Isolation is enforced in JudgingService, not here.
  router.get("/api/judge/scores", requireRole("judge"), (req, res) => {
    try {
      const requestedJudgeId = judging.resolveSeatOrId(req.query.judge);
      const scores = judging.scoresFor(req.user.judgeId, requestedJudgeId);
      res.status(200).json({ judge: requestedJudgeId || req.user.judgeId, scores });
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.post("/api/judge/scores", express.json(), requireRole("judge"), (req, res) => {
    try {
      const entry = judging.recordScore({ judgeId: req.user.judgeId, ...req.body });
      services.stretch.dispatchWebhooks("score.recorded", { score: entry.id, judge: entry.judge, project: entry.project });
      res.status(201).json(entry);
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  // T3 (FR-3.4): randomized scoring queue.
  router.get("/api/judge/queue", requireRole("judge"), (req, res) => {
    const projectIds = judging.assignmentsFor(req.user.judgeId).map((assignment) => assignment.project);
    res.status(200).json({ queue: judging.randomizedQueue(projectIds) });
  });

  router.get("/api/judge/assignments", requireRole("judge"), (req, res) => {
    const assignments = judging.assignmentsFor(req.user.judgeId).map((assignment) => ({
      ...assignment,
      project: repositories.project.get(assignment.project),
      scored: repositories.score.byJudge(req.user.judgeId).some((score) => score.project === assignment.project),
    }));
    res.status(200).json({ assignments });
  });

  router.get("/api/organizer/judging/progress", requireRole("organizer"), (_req, res) => {
    res.status(200).json({ progress: judging.progress() });
  });

  router.get("/api/organizer/judging/normalization", requireRole("organizer"), (_req, res) => {
    res.status(200).json(judging.normalizedResults());
  });

  router.get("/api/organizer/audit", requireRole("organizer"), (_req, res) => {
    res.status(200).json({ entries: repositories.audit.list() });
  });

  router.post("/api/organizer/judging/assignments", express.json(), requireRole("organizer"), (req, res) => {
    try {
      const assignments = judging.assignProjects(
        repositories.judge.list(),
        repositories.project.list(),
        req.body && req.body.reviewsPerProject
      );
      services.stretch.dispatchWebhooks("judging.assignments.created", { count: assignments.length });
      res.status(200).json({ assigned: assignments.length, assignments });
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.put("/api/organizer/judging/rubric", express.json(), requireRole("organizer"), (req, res) => {
    try {
      const weights = judging.configureRubric(req.body && req.body.weights);
      services.stretch.dispatchWebhooks("judging.rubric.updated", { weights });
      res.status(200).json({ weights });
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.post("/api/organizer/judges/invitations", express.json(), requireRole("organizer"), (req, res) => {
    try {
      const invitation = judging.createJudgeInvitation(req.body || {});
      services.stretch.dispatchWebhooks("judge.invited", { email: invitation.email, tracks: invitation.tracks });
      res.status(201).json(invitation);
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.post("/api/organizer/judges/:judgeId/assignments", express.json(), requireRole("organizer"), (req, res) => {
    try {
      const assignments = judging.assignJudgeProjects(req.params.judgeId, req.body && req.body.projects);
      services.stretch.dispatchWebhooks("judging.assignments.created", { judge: req.params.judgeId, count: assignments.length });
      res.status(201).json({ assignments });
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.post("/organizer/judges/invitations", express.urlencoded({ extended: true }), requireRole("organizer"), (req, res) => {
    try {
      const invitation = judging.createJudgeInvitation({
        name: req.body.name,
        email: req.body.email,
        tracks: Array.isArray(req.body.tracks) ? req.body.tracks : [req.body.tracks].filter(Boolean),
      });
      services.stretch.dispatchWebhooks("judge.invited", { email: invitation.email, tracks: invitation.tracks });
      res.status(201).send(layout("Judge invitation", `<p class="eyebrow">Share with ${escapeHtml(invitation.email)}</p><h1>Judge invitation ready</h1><p><a href="/judge-invites/${escapeHtml(invitation.token)}">/judge-invites/${escapeHtml(invitation.token)}</a></p><p class="muted">Expires ${escapeHtml(invitation.expires_at)}</p><p><a href="/organizer">Back to organizer overview</a></p>`));
    } catch (err) {
      if (err && err.status) return res.status(err.status).send(layout("Judge invitation", `<div class="notice">${escapeHtml(err.message)}</div>`));
      throw err;
    }
  });

  router.get("/judge", requireRole("judge"), (req, res) => {
    const assignments = judging.randomizedQueue(judging.assignmentsFor(req.user.judgeId).map((item) => item.project))
      .map((id) => repositories.project.get(id))
      .filter(Boolean);
    const scoredProjects = new Set(repositories.score.byJudge(req.user.judgeId).map((score) => score.project));
    const rows = assignments.map((project) => {
      const scored = scoredProjects.has(project.id);
      return `<tr><td><a href="/projects/${escapeHtml(project.id)}">${escapeHtml(project.title)}</a><div class="meta">${escapeHtml(project.track || "Open track")}</div></td><td>${scored ? '<span class="status">Scored</span>' : "Ready"}</td><td>${scored ? '<span class="meta">Ballot submitted</span>' : `<form method="post" action="/judge/scores"><input type="hidden" name="project" value="${escapeHtml(project.id)}"><div class="form-row"><label>Functionality<select name="functionality"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></label><label>Quality<select name="quality"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></label><label>Innovation<select name="innovation"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></label><button type="submit">Submit ballot</button></div><label>Feedback<textarea name="comment" maxlength="4000"></textarea></label></form>`}</td></tr>`;
    }).join("");
    res.status(200).send(layout("Judge desk", `<p class="eyebrow">Assigned review queue · randomized</p><h1>Judge desk</h1><p class="muted">Only projects in your assigned tracks appear here. Ballots are private to you and event organizers.</p><div class="table-wrap"><table><thead><tr><th>Project</th><th>State</th><th>Score & feedback</th></tr></thead><tbody>${rows || '<tr><td colspan="3">No assignments yet.</td></tr>'}</tbody></table></div>`));
  });

  router.post("/judge/scores", express.urlencoded({ extended: true }), requireRole("judge"), (req, res) => {
    try {
      judging.recordScore({
        judgeId: req.user.judgeId,
        project: req.body.project,
        criteria: { functionality: req.body.functionality, quality: req.body.quality, innovation: req.body.innovation },
        comment: req.body.comment,
      });
      services.stretch.dispatchWebhooks("score.recorded", { judge: req.user.judgeId, project: req.body.project });
      res.redirect("/judge");
    } catch (err) {
      if (err && err.status) return res.status(err.status).send(layout("Ballot not saved", `<div class="notice">${escapeHtml(err.message)}</div><p><a href="/judge">Return to your queue</a></p>`));
      throw err;
    }
  });

  router.get("/organizer", requireRole("organizer"), (_req, res) => {
    const progress = judging.progress();
    const complete = progress.filter((project) => project.status === "complete").length;
    const assigned = repositories.assignment.size;
    const scored = progress.reduce((sum, project) => sum + project.scored, 0);
    const normalized = judging.normalizedResults();
    const progressRows = progress.map((project) => `<tr><td>${escapeHtml(project.title)}</td><td>${escapeHtml(project.track || "Open track")}</td><td>${project.scored} / ${project.assigned}</td><td><progress value="${project.scored}" max="${Math.max(1, project.assigned)}"></progress></td><td>${escapeHtml(project.status)}</td></tr>`).join("");
    const rankingRows = normalized.normalized.slice(0, 10).map((item) => `<tr><td>${item.rank}</td><td>${escapeHtml(item.title)}</td><td>${item.score.toFixed(2)}</td><td><progress value="${item.score}" max="5"></progress></td></tr>`).join("");
    const rubric = judging.rubricWeights();
    const weights = Object.entries(rubric).map(([key, value]) => `<label>${escapeHtml(key)}<input type="number" name="${escapeHtml(key)}" value="${Number(value).toFixed(2)}" min="0.01" max="1" step="0.01" required></label>`).join("");
    const judgeTracks = repositories.track.list().map((track) => `<label><input style="display:inline;width:auto" type="checkbox" name="tracks" value="${escapeHtml(track.id)}"> ${escapeHtml(track.name)}</label>`).join("");
    const audit = repositories.audit.list().slice(-8).reverse().map((entry) => `<tr><td>${escapeHtml(entry.action.replaceAll(".", " "))}</td><td>${escapeHtml(formatAuditDetails(entry.details))}</td><td>${escapeHtml(entry.created_at)}</td></tr>`).join("");
    res.status(200).send(layout("Organizer", `<p class="eyebrow">Event control room</p><h1>Organizer overview</h1><div class="metric-grid"><div class="metric"><strong>${complete}<span class="meta"> / ${progress.length}</span></strong><span>Projects fully reviewed</span></div><div class="metric"><strong>${scored}</strong><span>Assigned ballots submitted</span></div><div class="metric"><strong>${assigned}</strong><span>Judge-project assignments</span></div></div><div class="section-head"><h2>Assignments</h2><form method="post" action="/organizer/assignments"><button class="secondary" type="submit">Add review coverage</button></form></div><p class="muted">Assignment targets are balanced across eligible judges within each track.</p><div class="table-wrap"><table><thead><tr><th>Project</th><th>Track</th><th>Reviewed</th><th>Progress</th><th>Status</th></tr></thead><tbody>${progressRows}</tbody></table></div><div class="section-head"><h2>Weighted ranking</h2><a href="/organizer/results">View results</a></div><p class="muted">${escapeHtml(normalized.method)}</p><div class="table-wrap"><table><thead><tr><th>Rank</th><th>Project</th><th>Score</th><th>Scale</th></tr></thead><tbody>${rankingRows}</tbody></table></div><div class="section-head"><h2>Rubric weights</h2><a href="/api/export.csv">Download scores CSV</a></div><form id="rubric-form" class="panel">${weights}<button type="submit">Save rubric</button><p id="rubric-status" class="muted" aria-live="polite"></p></form><div class="section-head"><h2>Invite a judge</h2></div><form class="panel" method="post" action="/organizer/judges/invitations"><label>Name<input name="name" required maxlength="100"></label><label>Email<input type="email" name="email" required></label><fieldset><legend>Eligible tracks</legend>${judgeTracks}</fieldset><button type="submit">Create judge invitation</button></form><div class="section-head"><h2>Audit trail</h2><a href="/organizer/audit">View activity</a></div><div class="table-wrap"><table><thead><tr><th>Action</th><th>Details</th><th>Time</th></tr></thead><tbody>${audit || '<tr><td colspan="3">No recorded activity.</td></tr>'}</tbody></table></div><script>document.getElementById("rubric-form").addEventListener("submit",async(e)=>{e.preventDefault();const f=new FormData(e.currentTarget);const weights=Object.fromEntries([...f.entries()].filter(([k])=>k!==""));const r=await fetch("/api/organizer/judging/rubric",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({weights})});document.getElementById("rubric-status").textContent=r.ok?"Rubric saved.":(await r.json()).error||"Could not save rubric."})</script>`));
  });

  router.post("/organizer/assignments", requireRole("organizer"), (_req, res) => {
    judging.assignProjects(repositories.judge.list(), repositories.project.list(), 3);
    res.redirect("/organizer");
  });

  router.post("/organizer/judges/assignments", express.urlencoded({ extended: true }), requireRole("organizer"), (req, res) => {
    try {
      const projectIds = String(req.body.projects || "").split(/[\s,]+/).filter(Boolean);
      judging.assignJudgeProjects(req.body.judge, projectIds);
      services.stretch.dispatchWebhooks("judging.assignments.created", { judge: req.body.judge, count: projectIds.length });
      res.redirect("/organizer");
    } catch (err) {
      if (err && err.status) return res.status(err.status).send(layout("Assignment failed", `<div class="notice">${escapeHtml(err.message)}</div><p><a href="/organizer">Return to organizer overview</a></p>`));
      throw err;
    }
  });

  return router;
}

module.exports = { buildJudgeController };
