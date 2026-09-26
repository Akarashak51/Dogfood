const express = require("express");
const { requireRole } = require("../auth/requireRole");
const { handleControllerError } = require("./handleControllerError");

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
      res.status(200).json({ assigned: assignments.length, assignments });
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  return router;
}

module.exports = { buildJudgeController };
