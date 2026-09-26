const express = require("express");
const { layout, escapeHtml } = require("../views/html");
const { requireRole } = require("../auth/requireRole");
const { handleControllerError } = require("./handleControllerError");

/**
 * @param {ReturnType<typeof import('../container').createContainer>['services']} services
 */
function buildSubmissionController(services) {
  const router = express.Router();
  const { submission } = services;

  router.get("/projects/new", (req, res) => {
    if (!submission.isOpen()) {
      return res
        .status(200)
        .send(layout("Submissions closed", "<h1>Submissions are closed</h1><p>The deadline for this event has passed.</p>"));
    }
    if (!req.user || req.user.role !== "participant") {
      return res.status(200).send(layout("Participant access", `<p class="eyebrow">Project submission</p><h1>Participant sign-in required</h1><p>Sign in with a participant session to submit or edit your team's work.</p><a class="button" href="/login">Demo sign-in</a><a class="button secondary" href="/teams/new">Register a team</a>`));
    }
    const trackOptions = submission.availableTracks().map((track) => `<option value="${escapeHtml(track.id)}">${escapeHtml(track.name)}</option>`).join("");
    res.status(200).send(
      layout(
        "Submit a project",
        `<p class="eyebrow">Participant workspace</p><h1>New submission</h1>
         <form class="panel" method="post" action="/projects/new">
           <label>Project title<input name="title" maxlength="120" placeholder="Give your project a name" required></label>
           <label>Track<select name="track"><option value="">Choose a track</option>${trackOptions}</select></label>
           <label>Project summary<textarea name="summary" maxlength="2000" placeholder="What does it do?" required></textarea></label>
           <label>Repository URL<input name="repo_url" type="url" placeholder="https://github.com/your-team/project"></label>
           <button type="submit">Submit project</button>
         </form>`
      )
    );
  });

  // T1 (FR-1.3, FR-1.4): requires an authenticated caller; the closed-event
  // check itself lives in SubmissionService, not here.
  router.post("/projects/new", express.urlencoded({ extended: true }), express.json(), requireRole("participant"), (req, res) => {
    try {
      const project = submission.submit(req.body, req.user.teamId);
      services.stretch.dispatchWebhooks("project.submitted", { project: project.id, team: project.team });
      res.status(201).json(project);
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.put("/projects/:id", express.json(), requireRole("participant"), (req, res) => {
    try {
      const project = submission.update(req.params.id, req.body, req.user.teamId);
      services.stretch.dispatchWebhooks("project.updated", { project: project.id, team: project.team });
      res.status(200).json(project);
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  return router;
}

module.exports = { buildSubmissionController };
