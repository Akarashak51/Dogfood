// Fixed session values so the committed .dogfood.toml never goes stale
// across restarts. These are NOT secrets — this is a seeded demo portal
// for a hackathon checker, not a production auth system. Swapping in a
// real login flow later only means writing a new AuthProvider
// (see src/auth/TokenAuthProvider.js) — nothing else in the app
// depends on how a session value was issued.
const TOKENS = Object.freeze({
  org_7f2a: "organizer",
  jdg_a_91bc: "judge_a",
  jdg_b_44de: "judge_b",
  prt_2e88: "participant",
});

module.exports = { TOKENS };
