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
    const trackFields = tracks.map((track, index) => `<div class="repeat-row"><input type="hidden" name="tracks[${index}][id]" value="${escapeHtml(track.id)}"><label>Track ${index + 1}<input name="tracks[${index}][name]" value="${escapeHtml(track.name)}" maxlength="80" required></label><button class="secondary remove-row" type="button" aria-label="Remove track ${index + 1}">Remove</button></div>`).join("");
    const prizes = current.prizes || [];
    const prizeFields = prizes.map((prize, index) => {
      const name = typeof prize === "string" ? prize : prize.name || "";
      const description = typeof prize === "string" ? "" : prize.description || "";
      return `<div class="repeat-row"><label>Prize ${index + 1}<input name="prizes[${index}][name]" value="${escapeHtml(name)}" maxlength="160"></label><label>Description<input name="prizes[${index}][description]" value="${escapeHtml(description)}" maxlength="500"></label><button class="secondary remove-row" type="button" aria-label="Remove prize ${index + 1}">Remove</button></div>`;
    }).join("");
    res.status(200).send(layout("Event setup", `<p class="eyebrow">Organizer controls</p><h1>Event setup</h1><form id="event-form" class="panel" method="post" action="/organizer/event"><label>Event name<input name="name" value="${escapeHtml(current.name || "")}" maxlength="120" required></label><div class="form-row"><label>Submission deadline<input type="datetime-local" name="submissions_close" value="${escapeHtml(localDate(current.submissions_close))}"></label><label>Voting opens<input type="datetime-local" name="voting_open" value="${escapeHtml(localDate(current.voting_open))}"></label><label>Voting closes<input type="datetime-local" name="voting_close" value="${escapeHtml(localDate(current.voting_close))}"></label><label>Results publish<input type="datetime-local" name="results_publish_at" value="${escapeHtml(localDate(current.results_publish_at))}"></label></div><label>Voting access<select name="voting_access"><option value="open"${(current.voting_access || "open") === "open" ? " selected" : ""}>Open link</option><option value="email"${current.voting_access === "email" ? " selected" : ""}>Email-gated</option><option value="authenticated"${current.voting_access === "authenticated" ? " selected" : ""}>Signed-in visitors</option></select></label><div class="section-head"><h2>Tracks</h2><button class="secondary" id="add-track" type="button">Add track</button></div><div id="track-list">${trackFields}</div><div class="section-head"><h2>Prizes</h2><button class="secondary" id="add-prize" type="button">Add prize</button></div><div id="prize-list">${prizeFields}</div><button type="submit">Save event configuration</button></form><p class="muted">The form uses normal fields; the REST API accepts ISO 8601 timestamps.</p><script>(()=>{let trackIndex=${tracks.length};let prizeIndex=${prizes.length};const trackList=document.getElementById("track-list");const prizeList=document.getElementById("prize-list");document.getElementById("add-track").addEventListener("click",()=>{const row=document.createElement("div");row.className="repeat-row";row.innerHTML='<label>New track<input name="tracks['+trackIndex+'][name]" maxlength="80" required></label><button class="secondary remove-row" type="button">Remove</button>';trackList.append(row);trackIndex++});document.getElementById("add-prize").addEventListener("click",()=>{const row=document.createElement("div");row.className="repeat-row";row.innerHTML='<label>New prize<input name="prizes['+prizeIndex+'][name]" maxlength="160"></label><label>Description<input name="prizes['+prizeIndex+'][description]" maxlength="500"></label><button class="secondary remove-row" type="button">Remove</button>';prizeList.append(row);prizeIndex++});document.getElementById("event-form").addEventListener("click",event=>{if(event.target.matches(".remove-row"))event.target.closest(".repeat-row").remove()})})()</script>`));
  });

  router.post("/organizer/event", express.urlencoded({ extended: true }), requireRole("organizer"), (req, res) => {
    try {
      const tracks = Object.values(req.body.tracks || {}).map((track) => ({ id: track.id || undefined, name: track.name }));
      const prizes = Object.values(req.body.prizes || {}).filter((prize) => String(prize.name || "").trim()).map((prize) => ({ name: prize.name, description: prize.description || "" }));
      const result = events.configure({ ...req.body, tracks, prizes });
      services.stretch.dispatchWebhooks("event.updated", { event: result.event.id });
      res.status(200).send(layout("Event saved", `<p class="eyebrow">Configuration updated</p><h1>${escapeHtml(result.event.name)}</h1><p>${result.tracks.length} tracks · ${Array.isArray(result.event.prizes) ? result.event.prizes.length : 0} prizes</p><a class="button" href="/organizer/event">Continue editing</a>`));
    } catch (err) {
      const message = err.message || "Event configuration could not be saved.";
      if (err && err.status) return res.status(err.status).send(layout("Event configuration not saved", `<div class="notice">${escapeHtml(message)}</div><p><a href="/organizer/event">Return to event setup</a></p>`));
      throw err;
    }
  });

  return router;
}

module.exports = { buildEventController };