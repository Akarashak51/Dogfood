const assert = require("node:assert/strict");
const test = require("node:test");

const fixtures = require("../fixtures.json");
const { createContainer } = require("../src/container");
const { EventRepository } = require("../src/repositories/EventRepository");

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