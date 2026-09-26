const fs = require("fs");

/**
 * Reads fixtures.json once and populates the repositories in a
 * container. This is the only module that knows the on-disk fixture
 * file exists — repositories don't know where their data came from,
 * and services don't know it was ever a file (Single Responsibility
 * + Dependency Inversion: everything downstream depends on repository
 * interfaces, not on "there is a JSON file at this path").
 *
 * @param {ReturnType<typeof import('../container').createContainer>['repositories']} repositories
 * @param {string} fixturesPath absolute path to fixtures.json
 * @complexity O(n) time / O(n) space, n = total fixture entries
 *   (tracks + judges + teams + projects + scores) — every entity is
 *   read and inserted exactly once, no re-scans.
 */
function seedFromFixtures(repositories, fixturesPath) {
  if (!fs.existsSync(fixturesPath)) {
    // eslint-disable-next-line no-console
    console.error(
      `[seed] fixtures.json not found at ${fixturesPath}. ` +
        "Download the real file from the DOGFOOD spec page and place it at the repo root " +
        "(or set FIXTURES_PATH) before starting the portal."
    );
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(fixturesPath, "utf-8"));

  repositories.event.set(data.event);
  (data.tracks || []).forEach((track) => repositories.track.add(track));
  (data.judges || []).forEach((judge) => repositories.judge.add(judge));
  (data.teams || []).forEach((team) => repositories.team.add(team));
  (data.projects || []).forEach((project) => repositories.project.add(project));
  (data.scores || []).forEach((score, index) =>
    repositories.score.add({ id: score.id || `sc_${index}`, ...score })
  );

  // eslint-disable-next-line no-console
  console.log(
    `[seed] loaded event "${data.event && data.event.name}" — ` +
      `${repositories.track.size} tracks, ${repositories.judge.size} judges, ` +
      `${repositories.team.size} teams, ${repositories.project.size} projects, ` +
      `${repositories.score.size} scores`
  );
}

module.exports = { seedFromFixtures };
