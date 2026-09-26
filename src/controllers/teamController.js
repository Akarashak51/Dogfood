const express = require("express");
const { requireRole } = require("../auth/requireRole");
const { layout, escapeHtml } = require("../views/html");
const { handleControllerError } = require("./handleControllerError");

function buildTeamController(services, authProvider) {
  const router = express.Router();
  const teams = services.teamManagement;

  router.get("/teams/new", (_req, res) => {
    res.status(200).send(layout("Create a team", `<p class="eyebrow">Participant registration</p><h1>Start a team</h1><form class="panel" method="post" action="/teams"><label>Team name<input name="name" maxlength="80" required></label><label>Your email<input type="email" name="email" autocomplete="email" required></label><button type="submit">Create team</button></form>`));
  });

  router.post("/teams", express.urlencoded({ extended: true }), (req, res) => {
    try {
      const team = teams.createTeam(req.body.name, req.body.email);
      services.stretch.dispatchWebhooks("team.created", { team: team.id });
      const sessionId = authProvider.issueSession({ roleLabel: "participant", teamId: team.id, email: String(req.body.email).trim().toLowerCase() });
      res.cookie("session", sessionId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.redirect(`/teams/${encodeURIComponent(team.id)}`);
    } catch (err) {
      if (err && err.status) return res.status(err.status).send(layout("Team registration", `<div class="notice">${escapeHtml(err.message)}</div><p><a href="/teams/new">Try again</a></p>`));
      throw err;
    }
  });

  router.post("/api/v1/teams", express.json(), (req, res) => {
    try {
      const team = teams.createTeam(req.body && req.body.name, req.body && req.body.email);
      services.stretch.dispatchWebhooks("team.created", { team: team.id });
      const email = String(req.body.email).trim().toLowerCase();
      const sessionId = authProvider.issueSession({ roleLabel: "participant", teamId: team.id, email });
      res.cookie("session", sessionId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.status(201).json({ team });
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.get("/api/v1/team", requireRole("participant"), (req, res) => {
    const team = teams.teams.get(req.user.teamId);
    if (!team) return res.status(404).json({ error: "team not found" });
    res.status(200).json({ team });
  });

  router.get("/teams/:id", requireRole("participant"), (req, res) => {
    const team = teams.teams.get(req.params.id);
    if (!team) return res.status(404).send(layout("Team not found", "<p>Team not found.</p>"));
    if (team.id !== req.user.teamId) return res.status(403).send(layout("Forbidden", "<p>You cannot manage this team.</p>"));
    const members = team.members.map((email) => `<li>${escapeHtml(email)}</li>`).join("");
    res.status(200).send(layout("Team workspace", `<p class="eyebrow">Participant workspace</p><h1>${escapeHtml(team.name)}</h1><section class="panel"><h2>Members</h2><ul>${members}</ul><form method="post" action="/teams/${escapeHtml(team.id)}/invitations"><label>Invite by email<input type="email" name="email" required></label><button type="submit">Create invite link</button></form><p class="muted">Invite links expire after seven days and can be used once.</p></section>`));
  });

  router.post("/teams/:id/invitations", express.urlencoded({ extended: true }), requireRole("participant"), (req, res) => {
    if (req.user.teamId !== req.params.id) return res.status(403).json({ error: "forbidden" });
    try {
      const invite = teams.createInvite(req.params.id, req.body.email);
      services.stretch.dispatchWebhooks("team.invited", { team: req.params.id, email: req.body.email });
      res.status(201).send(layout("Invite created", `<p class="eyebrow">Share this link</p><h1>Team invite ready</h1><p><a href="/invites/${escapeHtml(invite.token)}">/invites/${escapeHtml(invite.token)}</a></p><p class="muted">Expires ${escapeHtml(invite.expires_at)}</p>`));
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.post("/api/v1/teams/:id/invitations", express.json(), requireRole("participant"), (req, res) => {
    if (req.user.teamId !== req.params.id) return res.status(403).json({ error: "forbidden" });
    try {
      const invitation = teams.createInvite(req.params.id, req.body && req.body.email);
      services.stretch.dispatchWebhooks("team.invited", { team: req.params.id, email: req.body && req.body.email });
      res.status(201).json({ ...invitation, path: `/invites/${invitation.token}` });
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.post("/api/organizer/teams/:id/invitations", express.json(), requireRole("organizer"), (req, res) => {
    try {
      res.status(201).json(teams.createInvite(req.params.id, req.body && req.body.email));
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.get("/invites/:token", (req, res) => {
    const invite = teams.inviteFor(req.params.token);
    if (!invite) return res.status(404).send(layout("Invite unavailable", "<p>This invitation is invalid, expired, or already accepted.</p>"));
    res.status(200).send(layout("Accept team invite", `<p class="eyebrow">Invitation · ${escapeHtml(teams.teams.get(invite.team).name)}</p><h1>Join the team</h1><form class="panel" method="post" action="/invites/${escapeHtml(invite.token)}/accept"><label>Email<input type="email" name="email" value="${escapeHtml(invite.email || "")}" ${invite.email ? "readonly" : ""} required></label><button type="submit">Accept invitation</button></form>`));
  });

  router.post("/invites/:token/accept", express.urlencoded({ extended: true }), (req, res) => {
    try {
      const accepted = teams.acceptInvite(req.params.token, req.body.email);
      services.stretch.dispatchWebhooks("team.joined", { team: accepted.team.id, email: accepted.email });
      const sessionId = authProvider.issueSession({ roleLabel: "participant", teamId: accepted.team.id, email: accepted.email });
      res.cookie("session", sessionId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.redirect(`/teams/${encodeURIComponent(accepted.team.id)}`);
    } catch (err) {
      if (err && err.status) return res.status(err.status).send(layout("Invite not accepted", `<div class="notice">${escapeHtml(err.message)}</div>`));
      throw err;
    }
  });

  router.post("/api/v1/invitations/:token/accept", express.json(), (req, res) => {
    try {
      const accepted = teams.acceptInvite(req.params.token, req.body && req.body.email);
      services.stretch.dispatchWebhooks("team.joined", { team: accepted.team.id, email: accepted.email });
      const sessionId = authProvider.issueSession({ roleLabel: "participant", teamId: accepted.team.id, email: accepted.email });
      res.cookie("session", sessionId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.status(200).json({ team: accepted.team });
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.post("/api/v1/logout", (req, res) => {
    const match = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie || "");
    if (match) authProvider.revokeSession(match[1]);
    res.clearCookie("session", { path: "/" }).status(204).end();
  });

  router.post("/logout", (req, res) => {
    const match = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie || "");
    if (match) authProvider.revokeSession(match[1]);
    res.clearCookie("session", { path: "/" }).redirect("/projects");
  });

  return router;
}

module.exports = { buildTeamController };