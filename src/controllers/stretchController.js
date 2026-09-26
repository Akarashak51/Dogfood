const express = require("express");
const path = require("node:path");
const { requireRole } = require("../auth/requireRole");
const { handleControllerError } = require("./handleControllerError");

/**
 * @param {ReturnType<typeof import('../container').createContainer>['services']} services
 * @param {ReturnType<typeof import('../container').createContainer>['repositories']} repositories
 */
function buildStretchController(services, repositories) {
  const router = express.Router();
  const { stretch } = services;

  router.get("/api/openapi.yaml", (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "..", "openapi.yaml"));
  });

  router.get("/api/v1/projects", (req, res) => {
    const query = String(req.query.q || "").trim().toLowerCase();
    const track = req.query.track;
    const projects = repositories.project.list().filter((project) =>
      (!track || project.track === track) &&
      (!query || `${project.title} ${project.summary || ""}`.toLowerCase().includes(query))
    );
    res.status(200).json({ projects });
  });

  router.get("/api/v1/projects/:id", (req, res) => {
    const project = repositories.project.get(req.params.id);
    if (!project) return res.status(404).json({ error: "not found" });
    res.status(200).json({
      project,
      comments: repositories.comment.byProject(project.id),
      vote_count: repositories.vote.byProject(project.id).length,
    });
  });

  router.post("/api/v1/projects/:id/votes", express.json(), (req, res) => {
    try {
      const access = services.community.votingAccess();
      const voter = access === "email" ? String((req.body || {}).email || "").trim().toLowerCase() : req.ip;
      const vote = services.community.castVote(req.params.id, voter, Boolean(req.user));
      stretch.dispatchWebhooks("vote.cast", { project: req.params.id });
      res.status(201).json({ vote: { id: vote.id, project: vote.project, created_at: vote.created_at } });
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.post("/api/v1/projects/:id/comments", express.json(), (req, res) => {
    try {
      const body = req.body || {};
      const comment = services.community.addComment(req.params.id, body.author, body.text, req.ip);
      stretch.dispatchWebhooks("comment.created", { project: req.params.id, comment: comment.id });
      res.status(201).json({ comment });
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.post("/api/v1/projects", express.json(), requireRole("participant"), (req, res) => {
    try {
      const project = services.submission.submit(req.body, req.user.teamId);
      stretch.dispatchWebhooks("project.submitted", { project: project.id, team: project.team });
      res.status(201).json({ project });
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.put("/api/v1/projects/:id", express.json(), requireRole("participant"), (req, res) => {
    try {
      const project = services.submission.update(req.params.id, req.body, req.user.teamId);
      stretch.dispatchWebhooks("project.updated", { project: project.id, team: project.team });
      res.status(200).json({ project });
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.post("/api/v1/judge/scores", express.json(), requireRole("judge"), (req, res) => {
    try {
      const score = services.judging.recordScore({ judgeId: req.user.judgeId, ...req.body });
      stretch.dispatchWebhooks("score.recorded", { score: score.id, judge: score.judge, project: score.project });
      res.status(201).json({ score });
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.get("/api/v1/judges/:judgeId/record", (req, res) => {
    try {
      res.status(200).json(stretch.signedJudgeRecord(req.params.judgeId));
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.post("/api/v1/judges/records/verify", express.json(), (req, res) => {
    res.status(200).json(stretch.verifyJudgeRecord(req.body));
  });

  router.get("/api/v1/export/projects.csv", requireRole("organizer"), (_req, res) => {
    res.status(200).set("Content-Type", "text/csv").send(services.export.projectsToCsv());
  });

  router.post("/api/webhooks", express.json(), requireRole("organizer"), (req, res) => {
    try {
      const body = req.body || {};
      const hook = stretch.registerWebhook(body.url, body.event);
      res.status(201).json(hook);
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.post("/api/import", express.json(), requireRole("organizer"), (req, res) => {
    try {
      const items = Array.isArray(req.body) ? req.body : req.body && req.body.projects;
      const created = stretch.bulkImport(items);
      res.status(201).json({ imported: created.length, projects: created });
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.post("/api/v1/import", express.json(), requireRole("organizer"), (req, res) => {
    try {
      const items = Array.isArray(req.body) ? req.body : req.body && req.body.projects;
      const created = stretch.bulkImport(items);
      res.status(201).json({ imported: created.length, projects: created });
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.post("/api/v1/webhooks", express.json(), requireRole("organizer"), (req, res) => {
    try {
      const body = req.body || {};
      const hook = stretch.registerWebhook(body.url, body.event);
      res.status(201).json({ webhook: hook });
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.get("/api/organizer/webhooks/deliveries", requireRole("organizer"), (_req, res) => {
    res.status(200).json({ deliveries: repositories.webhookDelivery.list() });
  });

  router.get("/api/certificates/:teamId", (req, res) => {
    try {
      const cert = stretch.certificateFor(req.params.teamId);
      stretch.dispatchWebhooks("certificate.generated", { team: req.params.teamId });
      res.status(200).set("Content-Type", "text/plain").send(cert);
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.get("/embed.js", (_req, res) => {
    res.type("application/javascript").send(`(()=>{const s=document.currentScript;if(!s)return;const f=document.createElement("iframe");f.src=new URL("/embed/gallery",s.src).href;f.title="DOGFOOD project gallery";f.loading="lazy";f.style.cssText="width:100%;min-height:640px;border:0;background:#0b0e0c";s.insertAdjacentElement("afterend",f)})()`);
  });

  router.get("/embed/gallery", (_req, res) => {
    const projects = repositories.project.list().map((project) =>
      `<article><span>${escapeHtml(project.track || "Open track")}</span><h2>${escapeHtml(project.title)}</h2><p>${escapeHtml(project.summary || "")}</p><a href="/projects/${encodeURIComponent(project.id)}" target="_blank" rel="noreferrer">View project</a></article>`
    ).join("");
    res.status(200).type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:24px;background:#0b0e0c;color:#f2f4ef;font:15px/1.5 Georgia,serif}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #303730;padding-bottom:12px;margin-bottom:18px}small,article span{color:#b7e36a;text-transform:uppercase;font:11px/1.2 system-ui;letter-spacing:.08em}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}article{background:#151a16;border:1px solid #303730;border-radius:5px;padding:18px;animation:rise .5s both}article:nth-child(2){animation-delay:.06s}article:nth-child(3){animation-delay:.12s}h1{font-size:23px;margin:0}h2{font-size:19px}p{color:#bdc4bb}a{color:#b7e36a}@keyframes rise{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}</style></head><body><header><h1>DOGFOOD projects</h1><small>${repositories.project.size} submissions</small></header><section>${projects}</section></body></html>`);
  });

  return router;
}

const { escapeHtml } = require("../views/html");

module.exports = { buildStretchController };
