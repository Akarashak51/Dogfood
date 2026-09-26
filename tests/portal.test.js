const assert = require("node:assert/strict");
const express = require("express");
const http = require("node:http");
const test = require("node:test");

const fixtures = require("../fixtures.json");
const { createContainer } = require("../src/container");
const { TokenAuthProvider } = require("../src/auth/TokenAuthProvider");
const { TOKENS } = require("../src/config/authTokens");
const { EventRepository } = require("../src/repositories/EventRepository");
const { buildGalleryController } = require("../src/controllers/galleryController");
const { buildSubmissionController } = require("../src/controllers/submissionController");
const { buildEventController } = require("../src/controllers/eventController");
const { buildWorkspaceController } = require("../src/controllers/workspaceController");

function seededContainer() {
  const container = createContainer();
  container.repositories.event.set(fixtures.event);
  fixtures.tracks.forEach((track) => container.repositories.track.add(track));
  fixtures.judges.forEach((judge) => container.repositories.judge.add(judge));
  fixtures.teams.forEach((team) => container.repositories.team.add(team));
  fixtures.projects.forEach((project) => container.repositories.project.add(project));
  fixtures.scores.forEach((score, index) => container.repositories.score.add({ id: `seed_${index}`, ...score }));
  container.services.judging.assignProjects(
    container.repositories.judge.list(),
    container.repositories.project.list(),
    3
  );
  return container;
}

test("submission closure and public result release are independent", () => {
  const event = new EventRepository();
  event.set({ submissions_close: "2000-01-01T00:00:00Z" });
  assert.equal(event.isClosed(), true);
  assert.equal(event.resultsAreVisible(), false);
  event.set({ submissions_close: "2000-01-01T00:00:00Z", results_publish_at: "2000-01-02T00:00:00Z" });
  assert.equal(event.resultsAreVisible(), true);
});

test("public voting rejects a second vote for the same project and identity", () => {
  const { repositories, services } = seededContainer();
  const projectId = fixtures.projects[0].id;
  services.community.castVote(projectId, "client-1");
  assert.throws(() => services.community.castVote(projectId, "client-1"), (error) => error.status === 409);
  assert.equal(repositories.vote.byProject(projectId).length, 1);
});

test("automatic judging assignments remain inside each judge's tracks", () => {
  const { repositories } = seededContainer();
  const assignments = repositories.assignment.list();
  assert.equal(assignments.length, fixtures.projects.length * 3);
  assert.ok(assignments.every((assignment) =>
    repositories.judge.get(assignment.judge).tracks.includes(assignment.track)
  ));
});

test("judges cannot read peer ballots and cannot score unassigned projects", () => {
  const { repositories, services } = seededContainer();
  const [judgeA, judgeB] = repositories.judge.orderedIds();
  assert.throws(() => services.judging.scoresFor(judgeB, judgeA), (error) => error.status === 403);

  const assignment = repositories.assignment.list().find((item) => item.judge === judgeA);
  const unassigned = fixtures.projects.find((project) => !repositories.assignment.get(`${judgeA}:${project.id}`));
  assert.ok(assignment);
  assert.ok(unassigned);
  assert.throws(() => services.judging.recordScore({
    judgeId: judgeA,
    project: unassigned.id,
    criteria: { functionality: 4, quality: 4, innovation: 4 },
  }), (error) => error.status === 403);
});

test("weighted scores and normalization produce ordered, bounded results", () => {
  const { services } = seededContainer();
  assert.equal(services.judging.weightedScore({ functionality: 4, quality: 3, innovation: 2 }), 3.15);
  const results = services.judging.normalizedResults();
  assert.ok(results.raw.length > 0);
  assert.ok(results.normalized.length > 0);
  assert.ok(results.normalized.every((item) => item.score >= 1 && item.score <= 5));
  assert.deepEqual(results.normalized.map((item) => item.rank), results.normalized.map((_, index) => index + 1));
});

test("participants can create and edit only their own project before the deadline", () => {
  const { repositories, services } = seededContainer();
  repositories.event.set({ ...fixtures.event, submissions_close: "2999-01-01T00:00:00Z" });
  const ownerTeam = fixtures.teams[0].id;
  const otherTeam = fixtures.teams[1].id;
  const project = services.submission.submit({ title: "New work", team: otherTeam, track: fixtures.tracks[0].id }, ownerTeam);
  assert.equal(project.team, ownerTeam);
  assert.throws(() => services.submission.update(project.id, { title: "Hijack" }, otherTeam), (error) => error.status === 403);
  assert.equal(services.submission.update(project.id, { title: "Updated" }, ownerTeam).title, "Updated");
  repositories.event.set({ ...fixtures.event, submissions_close: "2000-01-01T00:00:00Z" });
  assert.throws(() => services.submission.update(project.id, { title: "Late edit" }, ownerTeam), (error) => error.status === 403);
});

test("bulk import validates references and signed judge records detect tampering", () => {
  const { repositories, services } = seededContainer();
  const imported = services.stretch.bulkImport([{
    title: "Imported project",
    team: fixtures.teams[0].id,
    track: fixtures.tracks[0].id,
  }]);
  assert.equal(imported.length, 1);
  assert.throws(() => services.stretch.bulkImport([{ title: "Orphan", team: "missing-team" }]), (error) => error.status === 400);

  const record = services.stretch.signedJudgeRecord(fixtures.judges[0].id);
  assert.equal(services.stretch.verifyJudgeRecord(record).valid, true);
  record.payload.judge_name = "Modified identity";
  assert.equal(services.stretch.verifyJudgeRecord(record).valid, false);
  assert.ok(repositories.audit.list().some((entry) => entry.action === "projects.imported"));
});

test("organizers can configure weights and judges can score eligible open assignments", () => {
  const { repositories, services } = seededContainer();
  const weights = services.judging.configureRubric({ functionality: 2, quality: 1, innovation: 1 });
  assert.deepEqual(weights, { functionality: 0.5, quality: 0.25, innovation: 0.25 });
  const assignment = repositories.assignment.list().find((item) =>
    !repositories.score.byJudge(item.judge).some((score) => score.project === item.project)
  );
  const score = services.judging.recordScore({
    judgeId: assignment.judge,
    project: assignment.project,
    criteria: { functionality: 5, quality: 3, innovation: 1 },
  });
  assert.equal(score.judge, assignment.judge);
  assert.equal(services.judging.weightedScore(score.criteria), 3.5);
});

test("judge invitations are one-time and assignments enforce track eligibility", () => {
  const { repositories, services } = seededContainer();
  const track = fixtures.tracks[0].id;
  const invite = services.judging.createJudgeInvitation({ name: "New Judge", email: "new@example.org", tracks: [track] });
  const judge = services.judging.acceptJudgeInvitation(invite.token);
  assert.deepEqual(judge.tracks, [track]);
  assert.equal(services.judging.judgeInvitation(invite.token), null);
  const project = fixtures.projects.find((item) => item.track === track);
  assert.equal(services.judging.assignJudgeProjects(judge.id, [project.id]).length, 1);
  const otherProject = fixtures.projects.find((item) => item.track !== track);
  assert.throws(() => services.judging.assignJudgeProjects(judge.id, [otherProject.id]), (error) => error.status === 403);
  assert.ok(repositories.audit.list().some((entry) => entry.action === "judge.joined"));
});

test("team invitations are email-bound and single-use", () => {
  const { repositories, services } = seededContainer();
  repositories.event.set({ ...fixtures.event, submissions_close: "2999-01-01T00:00:00Z" });
  const team = services.teamManagement.createTeam("Fresh Team", "owner@example.org");
  const invitation = services.teamManagement.createInvite(team.id, "member@example.org");
  assert.throws(() => services.teamManagement.acceptInvite(invitation.token, "other@example.org"), (error) => error.status === 403);
  assert.equal(services.teamManagement.acceptInvite(invitation.token, "member@example.org").team.id, team.id);
  assert.equal(repositories.team.get(team.id).members.length, 2);
  assert.throws(() => services.teamManagement.acceptInvite(invitation.token, "member@example.org"), (error) => error.status === 404);
});

test("organizer event configuration validates tracks, windows, access, and prizes", () => {
  const { repositories, services } = seededContainer();
  const result = services.eventManagement.configure({
    name: "Configured event",
    submissions_close: "2999-08-01T00:00:00Z",
    voting_open: "2999-08-02T00:00:00Z",
    voting_close: "2999-08-05T00:00:00Z",
    results_publish_at: "2999-08-05T00:00:00Z",
    voting_access: "email",
    tracks: fixtures.tracks,
    prizes: ["Best project"],
  });
  assert.equal(result.event.name, "Configured event");
  assert.equal(repositories.event.votingIsOpen(new Date("2999-08-03T00:00:00Z")), true);
  assert.equal(repositories.event.resultsAreVisible(new Date("2999-08-03T00:00:00Z")), false);
  assert.equal(repositories.event.resultsAreVisible(new Date("2999-08-06T00:00:00Z")), true);
  assert.throws(() => services.eventManagement.configure({ name: "Bad", voting_access: "unlocked" }), (error) => error.status === 400);
});

test("webhook delivery is signed, tracked, and blocks private targets", async () => {
  const { repositories, services } = seededContainer();
  assert.throws(() => services.stretch.registerWebhook("http://127.0.0.1/hook", "*"), (error) => error.status === 400);
  const hook = services.stretch.registerWebhook("https://hooks.example.org/dogfood", "score.recorded");
  const previousFetch = global.fetch;
  let requestOptions;
  services.stretch.resolveWebhookHost = async () => [{ address: "93.184.216.34", family: 4 }];
  global.fetch = async (_url, options) => {
    requestOptions = options;
    return { ok: true, status: 204, body: { cancel: async () => {} } };
  };
  try {
    await services.stretch.dispatchWebhooks("score.recorded", { project: "prj_01" });
  } finally {
    global.fetch = previousFetch;
  }
  assert.equal(requestOptions.method, "POST");
  assert.match(requestOptions.headers["X-Dogfood-Signature"], /^sha256=[a-f0-9]{64}$/);
  assert.equal(repositories.webhookDelivery.list()[0].status, "delivered");
  assert.equal(hook.event, "score.recorded");
});

test("the specific submission page is routed before project detail", async () => {
  const { services } = seededContainer();
  const app = express();
  app.use(buildSubmissionController(services));
  app.use(buildGalleryController(services));
  const server = app.listen(0);
  try {
    const response = await new Promise((resolve, reject) => {
      http.get({ hostname: "127.0.0.1", port: server.address().port, path: "/projects/new" }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => body += chunk);
        res.on("end", () => resolve({ status: res.statusCode, body }));
      }).on("error", reject);
    });
    assert.equal(response.status, 200);
    assert.match(response.body, /Submissions are closed/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("event setup edits tracks and prizes with regular form fields", async () => {
  const { services } = seededContainer();
  const app = express();
  app.use((req, _res, next) => {
    req.user = { role: "organizer" };
    next();
  });
  app.use(buildEventController(services));
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const page = await new Promise((resolve, reject) => {
      http.get({ hostname: "127.0.0.1", port, path: "/organizer/event" }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => body += chunk);
        res.on("end", () => resolve({ status: res.statusCode, body }));
      }).on("error", reject);
    });
    assert.equal(page.status, 200);
    assert.match(page.body, /tracks\[0\]\[name\]/);
    assert.doesNotMatch(page.body, /Tracks \(JSON\)|name="tracks"><textarea/);

    const formData = new URLSearchParams({
      name: "Updated event form",
      submissions_close: "2999-08-01T00:00",
      voting_open: "",
      voting_close: "",
      results_publish_at: "",
      voting_access: "open",
    });
    fixtures.tracks.forEach((track, index) => {
      formData.set(`tracks[${index}][id]`, track.id);
      formData.set(`tracks[${index}][name]`, index === 0 ? "Updated track name" : track.name);
    });
    formData.set("prizes[0][name]", "Community choice");
    formData.set("prizes[0][description]", "Audience selected");
    const form = formData.toString();
    const saved = await new Promise((resolve, reject) => {
      const request = http.request({
        hostname: "127.0.0.1",
        port,
        path: "/organizer/event",
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(form) },
      }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => body += chunk);
        res.on("end", () => resolve({ status: res.statusCode, body }));
      });
      request.on("error", reject);
      request.end(form);
    });
    assert.equal(saved.status, 200);
    assert.equal(services.eventManagement.details().tracks[0].name, "Updated track name");
    assert.equal(services.eventManagement.details().event.prizes[0].name, "Community choice");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("logout revokes runtime sessions without invalidating checker identities", () => {
  const auth = new TokenAuthProvider(TOKENS);
  auth.revokeSession("org_7f2a");
  assert.deepEqual(auth.resolve({ headers: { cookie: "session=org_7f2a" } }), { roleLabel: "organizer" });
  const session = auth.issueSession({ roleLabel: "participant", teamId: "tm_runtime" });
  assert.deepEqual(auth.resolve({ headers: { cookie: `session=${session}` } }), { roleLabel: "participant", teamId: "tm_runtime" });
  auth.revokeSession(session);
  assert.equal(auth.resolve({ headers: { cookie: `session=${session}` } }), null);
});

test("role workspaces render HTML while API reference remains readable", async () => {
  const { repositories, services } = seededContainer();
  const app = express();
  app.use((req, _res, next) => {
    req.user = req.headers["x-test-role"] === "judge"
      ? { role: "judge", judgeId: repositories.judge.orderedIds()[0] }
      : { role: "organizer" };
    next();
  });
  app.use(buildWorkspaceController(services, repositories));
  const server = app.listen(0);
  const request = (path, role = "organizer") => new Promise((resolve, reject) => {
    http.get({ hostname: "127.0.0.1", port: server.address().port, path, headers: { "X-Test-Role": role } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => resolve({ status: res.statusCode, type: res.headers["content-type"], body }));
    }).on("error", reject);
  });
  try {
    for (const path of ["/judge/assignments", "/judge/scores", "/organizer/judging/progress", "/organizer/results", "/organizer/audit", "/organizer/webhooks", "/api-docs"]) {
      const response = await request(path, path.startsWith("/judge/") ? "judge" : "organizer");
      assert.equal(response.status, 200, `${path} status`);
      assert.match(response.type, /text\/html/);
      assert.match(response.body, /<!doctype html>/i);
    }
    const forbidden = await request("/organizer/results", "judge");
    assert.equal(forbidden.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});