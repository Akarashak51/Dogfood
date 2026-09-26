# DOGFOOD Portal

A hackathon submission & judging portal, built for the DOGFOOD 72-hour
hackathon (Hackathon Raptors). This is the tool an event like this one
would actually run on: teams submit projects, judges score them with
enforced role isolation, organizers export results, and the public can
browse, vote, and comment.

Built as a layered Node.js/Express app (controllers → services →
repositories) following SOLID principles — see `ARCHITECTURE.md` for
exactly where each principle applies, and `COMPLEXITY.md` for the
time/space complexity of every data-access operation.

## Prerequisites

- **Node.js 20 or newer** (an `.nvmrc` is included; run `nvm use` if
  you use nvm). Check your version with `node -v`.
- The real `fixtures.json` (and, when you're ready to grade, `run.py`)
  downloaded from the DOGFOOD spec page.

## Option A — run without Docker (VS Code terminal)

This is the fastest loop for local development.

1. **Open the project.** In VS Code: `File → Open Folder…` and select
   this repo's folder (or `code .` from a terminal already inside it).

2. **Open the integrated terminal.** `` Ctrl+` `` on Windows/Linux,
   `` Cmd+` `` on macOS — or `Terminal → New Terminal` from the menu.
   Make sure it's rooted at the repo folder (VS Code does this by
   default).

3. **Install dependencies:**

   ```bash
   npm install
   ```

4. **Add the real fixture data.** Download `fixtures.json` from the
   DOGFOOD spec page and place it at the repo root, next to
   `package.json` (overwrite the sample one that ships in this repo):

   ```bash
   cp /path/to/your/downloaded/fixtures.json ./fixtures.json
   ```

5. **Start the server:**

   ```bash
   npm start
   ```

   You should see something like:

   ```
   [seed] loaded event "..." — N tracks, N judges, N teams, N projects, N scores
   DOGFOOD portal listening on http://localhost:8080

   Auth headers for .dogfood.toml / manual testing:
     organizer    Cookie: session=org_7f2a
     judge_a      Cookie: session=jdg_a_91bc
     judge_b      Cookie: session=jdg_b_44de
     participant  Cookie: session=prt_2e88
   ```

   Open `http://localhost:8080` in a browser — it redirects to the
   public gallery.

6. **Iterate with auto-restart (optional).** Instead of `npm start`,
   run:

   ```bash
   npm run dev
   ```

   This uses Node's built-in `--watch` flag, so the server restarts
   automatically whenever you save a file under `src/`. No extra
   dependency (like `nodemon`) is needed for this.

7. **Stop the server:** `Ctrl+C` in the same terminal.

8. **Change the port (optional).** The default is 8080. To use another
   port, set `PORT` before starting:

   ```bash
   # macOS/Linux (bash/zsh)
   PORT=3000 npm start

   # Windows PowerShell
   $env:PORT=3000; npm start
   ```

9. **Point at a fixtures.json in a different location (optional).**
   By default the server looks for `fixtures.json` next to this
   README. To use a different path, set `FIXTURES_PATH`:

   ```bash
   # macOS/Linux (bash/zsh)
   FIXTURES_PATH=/absolute/path/to/fixtures.json npm start

   # Windows PowerShell
   $env:FIXTURES_PATH="C:\path\to\fixtures.json"; npm start
   ```

10. **Run the official checker against it:**

    ```bash
    python3 run.py .dogfood.toml > acceptance-report.txt
    ```

    (Keep the server running from step 5/6 in one terminal tab, and
    run this from a second terminal tab/split — VS Code supports both
    via the `+` and split icons in the terminal panel.)

## Option B — run with Docker

```bash
cp /path/to/real/fixtures.json .
docker compose up --build
```

The portal boots on `http://localhost:8080` exactly as in Option A;
`fixtures.json` is baked into the image at build time (see
`Dockerfile`), so no volume mount is required.

## What's implemented

- **T1 — Core:** event setup, participant registration, one-time team
  invitations, participant sessions, deadline-enforced project create
  and edit, searchable/filterable public gallery, and role guards.
- **T2 — Judging:** expiring judge invitations, track-safe project
  assignments, weighted configurable criteria, private judge ballots,
  organizer progress and normalization views, audit history, and CSV
  exports.
- **T3 — Public:** open/email/authenticated voting modes, per-identity
  duplicate checks, rolling rate limits, organizer-visible audit events,
  comments, results release windows, and randomized assigned queues.
- **T4 — Stretch:** versioned REST routes, published OpenAPI, bulk project
  import/export, certificates, Ed25519 judge records, and an embeddable
  gallery widget, plus signed asynchronous webhook delivery attempts.

`.dogfood.toml` only claims **T1 and T2** — those are the tiers this
build has actually verified with the official `run.py`. That checker
contains seven T1/T2 checks and does not verify T3/T4. Do not interpret
the additional local tests as official T3/T4 certification. See
`JUDGING.md` and `THREAT-MODEL.md` for methods and residual risks.

## Honest limitations

- No persistent database — accounts, runtime sessions, invitations,
  audit entries, votes, comments, and submissions reset on restart.
- Bootstrap checker tokens are public demo credentials, not production
  authentication. Participant email addresses are not independently
  verified; invite URLs are bearer credentials.
- Webhook attempts are best-effort, single-shot, and in-memory; there is
  no durable queue or retry worker. Network-off actions still complete,
  but delivery status will be failed.
- Open-link vote identity is based on requester IP (keyed digest at rest);
  it is a useful duplicate/rate-limit signal, not Sybil resistance.
- Judge records detect payload changes, but their included public key is
  not anchored to a long-lived trusted event identity.
- `npm test` runs the local Node test suite. The official checker remains
  the only acceptance report used for the declared T1/T2 claim.

## Repo layout

```
.dogfood.toml          — where things are, and what we claim
.nvmrc                  — pinned Node version
acceptance-report.txt  — output of run.py, committed as-is
docker-compose.yml      — one command to a working seeded portal
Dockerfile
README.md              — this file
SRS.md                  — software requirements specification
ER-DIAGRAM.md           — entity-relationship diagram (Mermaid) + notes
ARCHITECTURE.md         — layers, SOLID mapping, and design rationale
COMPLEXITY.md           — time/space complexity of every operation
DATA-MODEL.md           — schema, and the way data comes in and out
JUDGING.md              — assignment, scoring, normalization
THREAT-MODEL.md          — abuse cases, controls, residual risks
openapi.yaml             — published REST contract (`/api/openapi.yaml`)
SUBMISSION-CHECKLIST.md — final steps before you submit (both setup paths)
DEMO-VIDEO.md           — a ready-to-read script for the required demo video
LICENSE                 — MIT
.dockerignore           — keeps the Docker build context small
.gitignore              — keeps node_modules etc. out of git
src/
  server.js             — entrypoint: wires everything, starts listening
  container.js           — composition root (dependency injection)
  config/                — fixed, non-secret constants (auth tokens)
  errors/                — DomainError (business errors, HTTP-status-aware)
  auth/                   — identify + requireRole middleware, TokenAuthProvider
  repositories/           — data access only (InMemoryRepository + specializations)
  services/               — business rules, no HTTP awareness
  controllers/            — thin HTTP layer, one file per route group
  views/                  — server-rendered HTML helpers
public/                 — (reserved; UI is server-rendered for now)
tests/                  — automated behavior tests and smoke-test notes
```
