const express = require("express");
const { layout, escapeHtml } = require("../views/html");
const { requireRole } = require("../auth/requireRole");
const { handleControllerError } = require("./handleControllerError");

/**
 * Every handler here does exactly one thing: read the request, call
 * one service method, write a response. No rule about "who can
 * submit" or "when are results visible" lives in this file — that
 * belongs to GalleryService/CommunityService. This split is what
 * makes it possible to unit-test the business rules without spinning
 * up Express at all.
 *
 * @param {ReturnType<typeof import('../container').createContainer>['services']} services
 */
function buildGalleryController(services) {
  const router = express.Router();
  const { gallery, community, submission } = services;

  // T1 (FR-1.1, FR-1.2): a stranger can browse the gallery — no auth required.
  router.get("/projects", (req, res) => {
    const query = String(req.query.q || "").trim().toLowerCase();
    const selectedTrack = String(req.query.track || "");
    const tracks = gallery.listTracks();
    const projects = gallery.listProjects().filter((project) =>
      (!selectedTrack || project.track === selectedTrack) &&
      (!query || `${project.title} ${project.summary || ""} ${gallery.teamName(project.team)}`.toLowerCase().includes(query))
    );
    const projectsHtml = projects
      .map((project, index) => `<article class="project-card" style="animation-delay:${Math.min(index, 12) * 35}ms">
          <div class="card-top"><span class="track-tag">${escapeHtml(gallery.trackName(project.track))}</span><span class="meta">${gallery.voteCount(project.id)} votes</span></div>
          <h2><a href="/projects/${escapeHtml(project.id)}">${escapeHtml(project.title)}</a></h2>
          <p>${escapeHtml(project.summary || "No summary provided.")}</p>
          <p class="meta">${escapeHtml(gallery.teamName(project.team))}</p>
        </article>`
      )
      .join("\n");
    const options = tracks.map((track) => `<option value="${escapeHtml(track.id)}"${track.id === selectedTrack ? " selected" : ""}>${escapeHtml(track.name)}</option>`).join("");
    const filter = `<form class="toolbar" method="get" action="/projects"><label>Search projects<input name="q" value="${escapeHtml(req.query.q || "")}" placeholder="Name, team or description"></label><label>Track<select name="track"><option value="">All tracks</option>${options}</select></label><button type="submit">Filter gallery</button></form>`;
    res.status(200).send(
      layout("Project gallery", `<p class="eyebrow">${projects.length} projects · ${tracks.length} tracks</p><div class="row-between"><h1>Project gallery</h1><a class="button secondary" href="/api/v1/projects">API</a></div>${filter}<div class="project-grid">${projectsHtml || '<div class="empty">No projects match these filters.</div>'}</div>`)
    );
  });

  // T3 (FR-3.3): results hidden until the event closes; comments/votes are public.
  router.get("/projects/:id", (req, res) => {
    const detail = gallery.getProjectDetail(req.params.id);
    if (!detail) return res.status(404).send(layout("Not found", "<p>No such project.</p>"));

    const { project, comments, voteCount, resultsVisible, scores } = detail;

    const resultsHtml = resultsVisible
      ? scores.length
        ? `<ul>${scores.map((s) => `<li>${escapeHtml(JSON.stringify(s.criteria))}</li>`).join("")}</ul>`
        : `<p class="muted">No scores recorded.</p>`
      : `<p class="muted">Results are hidden until the event closes.</p>`;

    const commentsHtml = comments
      .map((comment) => `<div class="comment"><strong>${escapeHtml(comment.author)}</strong><p>${escapeHtml(comment.text)}</p><time class="meta">${escapeHtml(comment.created_at)}</time></div>`)
      .join("");
    const repoLink = project.repo_url ? `<a class="button secondary" href="${escapeHtml(project.repo_url)}" target="_blank" rel="noreferrer">Repository</a>` : "";
    const emailField = community.votingAccess() === "email" ? '<label>Email for voting<input type="email" name="email" required autocomplete="email"></label>' : "";
    const editForm = req.user && req.user.role === "participant" && req.user.teamId === project.team && submission.isOpen()
      ? `<section class="panel"><p class="eyebrow">Team workspace</p><h2>Edit submission</h2><form method="post" action="/projects/${escapeHtml(project.id)}/edit"><label>Title<input name="title" value="${escapeHtml(project.title)}" required maxlength="120"></label><label>Summary<textarea name="summary" maxlength="2000">${escapeHtml(project.summary || "")}</textarea></label><label>Repository URL<input name="repo_url" type="url" value="${escapeHtml(project.repo_url || "")}"></label><label>Track<input name="track" value="${escapeHtml(project.track || "")}"></label><button type="submit">Save changes</button></form></section>`
      : "";

    res.status(200).send(
      layout(
        project.title,
        `<p class="eyebrow">${escapeHtml(gallery.trackName(project.track))} · ${escapeHtml(gallery.teamName(project.team))}</p><div class="row-between"><h1>${escapeHtml(project.title)}</h1>${repoLink}</div>
         <p>${escapeHtml(project.summary || "")}</p>
         <div class="split"><section class="panel"><div class="section-head"><h2>Results</h2><span class="status">${resultsVisible ? "Published" : "Sealed"}</span></div>${resultsHtml}</section><section class="panel"><p class="eyebrow">Community signal</p><h2>${voteCount} votes</h2><form method="post" action="/projects/${escapeHtml(project.id)}/vote">${emailField}<button type="submit">Cast vote</button></form></section></div>
         <div class="section-head"><h2>Community notes</h2><span class="meta">${comments.length} comments</span></div><section>${commentsHtml || '<p class="muted">No comments yet.</p>'}</section>
         <section class="panel"><form method="post" action="/projects/${escapeHtml(project.id)}/comments"><label>Your name<input name="author" placeholder="Name" maxlength="80" required></label><label>Comment<textarea name="text" placeholder="Leave useful feedback" maxlength="2000" required></textarea></label><button type="submit">Post comment</button></form></section>${editForm}`
      )
    );
  });

  router.post("/projects/:id/vote", express.urlencoded({ extended: true }), express.json(), (req, res) => {
    try {
      const access = community.votingAccess();
      const voter = access === "email" ? String(req.body.email || "").trim().toLowerCase() : req.ip;
      community.castVote(req.params.id, voter, Boolean(req.user));
      services.stretch.dispatchWebhooks("vote.cast", { project: req.params.id });
      res.redirect(`/projects/${req.params.id}`);
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.post(
    "/projects/:id/comments",
    express.urlencoded({ extended: true }),
    (req, res) => {
      try {
        const comment = community.addComment(req.params.id, req.body.author, req.body.text, req.ip);
        services.stretch.dispatchWebhooks("comment.created", { project: req.params.id, comment: comment.id });
        res.redirect(`/projects/${req.params.id}`);
      } catch (err) {
        handleControllerError(err, res);
      }
    }
  );

  router.post("/projects/:id/edit", express.urlencoded({ extended: true }), requireRole("participant"), (req, res) => {
    try {
      submission.update(req.params.id, req.body, req.user.teamId);
      res.redirect(`/projects/${req.params.id}`);
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  return router;
}

module.exports = { buildGalleryController };
