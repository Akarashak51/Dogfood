const express = require("express");
const { layout } = require("../views/html");
const { requireRole } = require("../auth/requireRole");
const { handleControllerError } = require("./handleControllerError");

/**
 * @param {ReturnType<typeof import('../container').createContainer>['services']} services
 */
function buildSubmissionController(services) {
  const router = express.Router();
  const { submission } = services;

  router.get("/projects/new", (_req, res) => {
    if (!submission.isOpen()) {
      return res
        .status(200)
        .send(layout("Submissions closed", "<h1>Submissions are closed</h1><p>The deadline for this event has passed.</p>"));
    }
    res.status(200).send(
      layout(
        "Submit a project",
        `<h1>Submit a project</h1>
         <form method="post" action="/projects/new">
           <input name="title" placeholder="Project title" required>
           <input name="track" placeholder="Track id">
           <input name="repo_url" placeholder="Repo URL">
           <textarea name="summary" placeholder="One line summary"></textarea>
           <button type="submit">Submit</button>
         </form>`
      )
    );
  });

  // T1 (FR-1.3, FR-1.4): requires an authenticated caller; the closed-event
  // check itself lives in SubmissionService, not here.
  router.post("/projects/new", express.urlencoded({ extended: true }), express.json(), requireRole("participant"), (req, res) => {
    try {
      const project = submission.submit(req.body, req.user.teamId);
      res.status(201).json(project);
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  router.put("/projects/:id", express.json(), requireRole("participant"), (req, res) => {
    try {
      const project = submission.update(req.params.id, req.body, req.user.teamId);
      res.status(200).json(project);
    } catch (err) {
      handleControllerError(err, res);
    }
  });

  return router;
}

module.exports = { buildSubmissionController };
