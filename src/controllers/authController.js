const express = require("express");
const { TOKENS } = require("../config/authTokens");
const { layout, escapeHtml } = require("../views/html");

function buildAuthController() {
  const router = express.Router();
  const demoRoles = ["organizer", "judge_a", "judge_b", "participant"];

  router.get("/login", (_req, res) => {
    const options = demoRoles.map((role) => `<option value="${role}">${role.replace("_", " ")}</option>`).join("");
    res.status(200).send(layout("Demo access", `<p class="eyebrow">Local evaluation</p><h1>Choose a demo identity</h1><form class="panel" method="post" action="/login"><label>Role<select name="role">${options}</select></label><button type="submit">Continue</button></form><p class="muted">These shared fixture identities are for local evaluation only. Do not expose this demo sign-in on a public production deployment.</p>`));
  });

  router.post("/login", express.urlencoded({ extended: true }), (req, res) => {
    const role = req.body.role;
    if (!demoRoles.includes(role)) return res.status(400).send(layout("Invalid role", `<div class="notice">${escapeHtml("Select a valid demo identity.")}</div>`));
    const entry = Object.entries(TOKENS).find(([, roleLabel]) => roleLabel === role);
    if (!entry) return res.status(400).send(layout("Invalid role", `<div class="notice">${escapeHtml("This demo identity is unavailable.")}</div>`));
    res.cookie("session", entry[0], { httpOnly: true, sameSite: "lax", path: "/" });
    res.redirect(role === "organizer" ? "/organizer" : role.startsWith("judge") ? "/judge" : "/projects/new");
  });

  return router;
}

module.exports = { buildAuthController };