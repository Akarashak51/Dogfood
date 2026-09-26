const express = require("express");
const { layout, escapeHtml } = require("../views/html");

function buildJudgeInvitationController(services, authProvider) {
  const router = express.Router();
  const judging = services.judging;

  router.get("/judge-invites/:token", (req, res) => {
    const invitation = judging.judgeInvitation(req.params.token);
    if (!invitation) return res.status(404).send(layout("Invitation unavailable", "<p>This invitation is invalid, expired, or already accepted.</p>"));
    res.status(200).send(layout("Join the judging panel", `<p class="eyebrow">Judge invitation</p><h1>Welcome, ${escapeHtml(invitation.name)}</h1><p>${escapeHtml(invitation.email)} · ${invitation.tracks.length} assigned tracks</p><form class="panel" method="post" action="/judge-invites/${escapeHtml(invitation.token)}/accept"><button type="submit">Accept invitation</button></form>`));
  });

  router.post("/judge-invites/:token/accept", (req, res) => {
    try {
      const judge = judging.acceptJudgeInvitation(req.params.token);
      services.stretch.dispatchWebhooks("judge.joined", { judge: judge.id, tracks: judge.tracks });
      const sessionId = authProvider.issueSession({ roleLabel: "judge", judgeId: judge.id, email: judge.email });
      res.cookie("session", sessionId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.redirect("/judge");
    } catch (err) {
      if (err && err.status) return res.status(err.status).send(layout("Invitation unavailable", `<div class="notice">${escapeHtml(err.message)}</div>`));
      throw err;
    }
  });

  router.post("/api/v1/judge-invitations/:token/accept", (req, res) => {
    try {
      const judge = judging.acceptJudgeInvitation(req.params.token);
      services.stretch.dispatchWebhooks("judge.joined", { judge: judge.id, tracks: judge.tracks });
      const sessionId = authProvider.issueSession({ roleLabel: "judge", judgeId: judge.id, email: judge.email });
      res.cookie("session", sessionId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.status(200).json({ judge });
    } catch (err) {
      if (err && err.status) return res.status(err.status).json({ error: err.message });
      throw err;
    }
  });

  return router;
}

module.exports = { buildJudgeInvitationController };