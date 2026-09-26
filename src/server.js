const express = require("express");
const path = require("path");

const { createContainer } = require("./container");
const { seedFromFixtures } = require("./services/FixtureLoader");
const { TokenAuthProvider } = require("./auth/TokenAuthProvider");
const { createIdentifyMiddleware } = require("./auth/identify");
const { TOKENS } = require("./config/authTokens");

const { buildGalleryController } = require("./controllers/galleryController");
const { buildSubmissionController } = require("./controllers/submissionController");
const { buildJudgeController } = require("./controllers/judgeController");
const { buildExportController } = require("./controllers/exportController");
const { buildStretchController } = require("./controllers/stretchController");

const PORT = process.env.PORT || 8080;
const FIXTURES_PATH = process.env.FIXTURES_PATH || path.join(__dirname, "..", "fixtures.json");

const { repositories, services } = createContainer();
seedFromFixtures(repositories, FIXTURES_PATH); // exits with a clear error if fixtures.json is missing

const app = express();

const authProvider = new TokenAuthProvider(TOKENS);
app.use(createIdentifyMiddleware(authProvider, repositories.judge));

app.get("/", (_req, res) => res.redirect("/projects"));

app.use(buildGalleryController(services));
app.use(buildSubmissionController(services));
app.use(buildJudgeController(services, repositories));
app.use(buildExportController(services));
app.use(buildStretchController(services, repositories));

app.use((_req, res) => res.status(404).json({ error: "not found" }));

app.listen(PORT, () => {
  console.log(`DOGFOOD portal listening on http://localhost:${PORT}`);
  console.log("");
  console.log("Auth headers for .dogfood.toml / manual testing:");
  Object.entries(TOKENS).forEach(([sessionValue, role]) => {
    console.log(`  ${role.padEnd(12)} Cookie: session=${sessionValue}`);
  });
  console.log("");
});
