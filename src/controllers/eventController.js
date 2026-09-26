const express = require("express");
const { requireRole } = require("../auth/requireRole");
const { layout, escapeHtml } = require("../views/html");
const { handleControllerError } = require("./handleControllerError");

function buildEventController(services) {
  const router = express.Router();
  const events = services.eventManagement;

  router.get("/api/event", (_req, res) => {
    res.status(200).json(events.details());
  });

  router.put("/api/organizer/event", express.json(), requireRole("organizer"), (req, res) => {
    try {
      const result = events.configure(req.body);
      services.stretch.dispatchWebhooks("event.updated", { event: result.event.id });
      res.status(200).json(result);
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.get("/organizer/event", requireRole("organizer"), (_req, res) => {
    const { event, tracks } = events.details();
    const current = event || {};
    const localDate = (value) => value ? new Date(value).toISOString().slice(0, 16) : "";
    const trackData = JSON.stringify(tracks.map(({ id, name }) => ({ id, name })), null, 2);
    const prizeData = JSON.stringify(current.prizes || [], null, 2);
    res.status(200).send(layout("Event setup", `<p class="eyebrow">Organizer controls</p><h1>Event setup</h1><form class="panel" method="post" action="/organizer/event"><label>Event name<input name="name" value="${escapeHtml(current.name || "")}" maxlength="120" required></label><div class="form-row"><label>Submission deadline<input type="datetime-local" name="submissions_close" value="${escapeHtml(localDate(current.submissions_close))}"></label><label>Voting opens<input type="datetime-local" name="voting_open" value="${escapeHtml(localDate(current.voting_open))}"></label><label>Voting closes<input type="datetime-local" name="voting_close" value="${escapeHtml(localDate(current.voting_close))}"></label><label>Results publish<input type="datetime-local" name="results_publish_at" value="${escapeHtml(localDate(current.results_publish_at))}"></label></div><label>Voting access<select name="voting_access"><option value="open"${(current.voting_access || "open") === "open" ? " selected" : ""}>Open link</option><option value="email"${current.voting_access === "email" ? " selected" : ""}>Email-gated</option><option value="authenticated"${current.voting_access === "authenticated" ? " selected" : ""}>Signed-in visitors</option></select></label><label>Tracks (JSON)<textarea name="tracks" required>${escapeHtml(trackData)}</textarea></label><label>Prizes (JSON)<textarea name="prizes">${escapeHtml(prizeData)}</textarea></label><button type="submit">Save event configuration</button></form><p class="muted">Dates are interpreted in the server's local timezone when entered here. The REST API accepts ISO 8601 timestamps.</p>`));
  });

  router.post("/organizer/event", express.urlencoded({ extended: true }), requireRole("organizer"), (req, res) => {
    try {
      const tracks = JSON.parse(req.body.tracks);
      const prizes = JSON.parse(req.body.prizes || "[]");
      const result = events.configure({ ...req.body, tracks, prizes });
      services.stretch.dispatchWebhooks("event.updated", { event: result.event.id });
      res.status(200).send(layout("Event saved", `<p class="eyebrow">Configuration updated</p><h1>${escapeHtml(result.event.name)}</h1><p>${result.tracks.length} tracks · ${Array.isArray(result.event.prizes) ? result.event.prizes.length : 0} prizes</p><a class="button" href="/organizer/event">Continue editing</a>`));
    } catch (err) {
      const message = err instanceof SyntaxError ? "Tracks and prizes must be valid JSON." : err.message;
      if (err && (err.status || err instanceof SyntaxError)) return res.status(err.status || 400).send(layout("Event configuration not saved", `<div class="notice">${escapeHtml(message)}</div><p><a href="/organizer/event">Return to event setup</a></p>`));
      throw err;
    }
  });

  return router;
}

module.exports = { buildEventController };