const express = require("express");
const { requireRole } = require("../auth/requireRole");
const { handleControllerError } = require("./handleControllerError");

/**
 * @param {ReturnType<typeof import('../container').createContainer>['services']} services
 * @param {ReturnType<typeof import('../container').createContainer>['repositories']} repositories
 */
function buildStretchController(services, repositories) {
  const router = express.Router();
  const { stretch } = services;

  router.get("/api/v1/projects", (_req, res) => {
    res.status(200).json({ projects: repositories.project.list() });
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

  router.post("/api/webhooks", express.json(), requireRole("organizer"), (req, res) => {
    try {
      const hook = stretch.registerWebhook(req.body.url, req.body.event);
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

  router.get("/api/certificates/:teamId", (req, res) => {
    try {
      const cert = stretch.certificateFor(req.params.teamId);
      res.status(200).set("Content-Type", "text/plain").send(cert);
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  return router;
}

module.exports = { buildStretchController };
