const express = require("express");
const { layout, escapeHtml } = require("../views/html");
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
  const { gallery, community } = services;

  // T1 (FR-1.1, FR-1.2): a stranger can browse the gallery — no auth required.
  router.get("/projects", (_req, res) => {
    const projects = gallery.listProjects();
    const projectsHtml = projects
      .map(
        (p) => `<div class="card">
          <h3><a href="/projects/${escapeHtml(p.id)}">${escapeHtml(p.title)}</a></h3>
          <p>${escapeHtml(p.summary || "")}</p>
          <p class="muted">Team: ${escapeHtml(gallery.teamName(p.team))}</p>
        </div>`
      )
      .join("\n");

    res.status(200).send(
      layout("Gallery", `<h1>Gallery</h1>${projectsHtml || "<p>No projects yet.</p>"}`)
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
      .map((c) => `<li><strong>${escapeHtml(c.author)}:</strong> ${escapeHtml(c.text)}</li>`)
      .join("");

    res.status(200).send(
      layout(
        project.title,
        `<h1>${escapeHtml(project.title)}</h1>
         <p>${escapeHtml(project.summary || "")}</p>
         <h3>Results</h3>${resultsHtml}
         <h3>Public votes: ${voteCount}</h3>
         <form method="post" action="/projects/${escapeHtml(project.id)}/vote">
           <button type="submit">Vote for this project</button>
         </form>
         <h3>Comments</h3>
         <ul>${commentsHtml || '<li class="muted">No comments yet.</li>'}</ul>
         <form method="post" action="/projects/${escapeHtml(project.id)}/comments">
           <input name="author" placeholder="Your name" required>
           <textarea name="text" placeholder="Comment" required></textarea>
           <button type="submit">Post comment</button>
         </form>`
      )
    );
  });

  router.post("/projects/:id/vote", express.urlencoded({ extended: true }), express.json(), (req, res) => {
    try {
      const access = community.votingAccess();
      const voter = access === "email" ? String(req.body.email || "").trim().toLowerCase() : req.ip;
      community.castVote(req.params.id, voter, Boolean(req.user));
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
        community.addComment(req.params.id, req.body.author, req.body.text, req.ip);
        res.redirect(`/projects/${req.params.id}`);
      } catch (err) {
        handleControllerError(err, res);
      }
    }
  );

  return router;
}

module.exports = { buildGalleryController };
