# Software Requirements Specification (SRS)
## DOGFOOD Portal — Hackathon Submission & Judging Platform

Version 1.0 · DOGFOOD 72-hour Hackathon (Hackathon Raptors)

---

## 1. Introduction

### 1.1 Purpose

This document specifies the functional and non-functional requirements
for the DOGFOOD Portal: a self-hosted web application that lets a
hackathon run its own submission, judging, and results workflow. It is
written against the DOGFOOD 2026 spec (https://dogfoodhack.com/spec/)
and is the authoritative reference for what the system is supposed to
do, independent of how `src/` currently implements it.

### 1.2 Scope

The system covers four capability tiers, each building on the last:

| Tier | Name    | Covers |
|------|---------|--------|
| T1   | Core    | Login/roles, events, teams, submissions, public gallery, deadline enforcement |
| T2   | Judging | Score assignment, weighted rubric, role isolation, progress view, normalization, CSV export |
| T3   | Public  | Voting, comments, hidden results, randomized ballot order, anti-cheat |
| T4   | Stretch | REST API, webhooks, certificates, verifiable judge records, embeddable widget, bulk import |

T1 is mandatory — a build that doesn't clear it is not scored at all.
T2–T4 are additive; a correct T2 outscores a broken T4 (correctness is
weighted above breadth).

### 1.3 Definitions

| Term | Meaning |
|------|---------|
| Fixture | The shared, pre-seeded sample data (`fixtures.json`) every team's portal loads on boot |
| Checker | `run.py`, the script that sends the 7 scored HTTP requests against a portal |
| Role isolation | The rule that one judge's scores must never be readable by another judge |
| Claimed tier | The tier(s) a team declares in `.dogfood.toml`; scored against what the checker actually verifies |

### 1.4 Intended audience

Hackathon judges evaluating this submission; the team members building
and extending it; anyone reusing this portal for a future event.

### 1.5 References

- DOGFOOD spec: https://dogfoodhack.com/spec/
- `fixtures.json` shape, as published in the spec
- `run.py`, the official checker (not redistributed in this document —
  download it from the spec page)

---

## 2. Overall description

### 2.1 Product perspective

A standalone web application. No dependency on an external SaaS,
identity provider, or hosted database — it must boot with
`docker compose up` and the network off. It is the system the
hackathon it was built for could plausibly use to run itself
(hence "dogfood").

### 2.2 Actors (user classes)

| Actor | Description | Authenticates via |
|-------|-------------|--------------------|
| Stranger / public visitor | Anyone with a browser, no login | none |
| Participant | A hackathon competitor, member of a team | session cookie |
| Judge | Scores projects in their assigned track(s) | session cookie |
| Organizer | Runs the event; sees everything, exports data | session cookie |

The checker itself is a fifth "actor" in practice: it plays each of
the above roles in turn by attaching the matching header, and never
performs an interactive login.

### 2.3 Operating environment

- Node.js 22 runtime (or any stack a team chooses — the spec does not
  mandate one; this implementation uses Node/Express)
- Runs inside a single Docker container via `docker compose up`
- No outbound network access required at runtime
- Reachable over plain HTTP on a configurable port (default 8080)

### 2.4 Constraints

- **No fixed API routes.** Each team defines its own; `.dogfood.toml`
  tells the checker where they are.
- **No required framework, language, or database.**
- **No login format is checked.** The checker never logs in — it
  attaches a pre-shared header.
- **Fixtures are input, not a schema.** A team may reshape the data
  internally however it likes.
- **72-hour build window.** Kickoff Fri 25 Sep 18:00 UTC → code freeze
  Mon 28 Sep 18:00 UTC.

### 2.5 Assumptions and dependencies

- The real `fixtures.json` and `run.py`, downloaded from the spec page,
  are present at the repo root before the checker is run.
- The fixture's `event.submissions_close` is already in the past at
  seed time (the portal does not manipulate a clock — it is simply
  "closed" because the fixture says so).
- Docker (or an equivalent OCI runtime) is available on the judge's
  machine to run `docker compose up`.

---

## 3. Functional requirements

Each requirement is tagged with the tier it belongs to and, where
applicable, the exact checker behaviour it must satisfy.

### 3.1 T1 — Core

**FR-1.1 Public gallery.**
The system shall expose a route that returns HTTP 200 to an
unauthenticated request and lists submitted projects.
*Verified by: `GET {routes.gallery}`, no auth header, expect 200.*

**FR-1.2 Fixture visibility.**
The gallery response body shall contain the title of at least one
project loaded from `fixtures.json`.
*Verified by: `GET {routes.gallery}`, expect a known fixture title in the body.*

**FR-1.3 Submission endpoint.**
The system shall expose browser and REST routes for authenticated
participants to create and edit their team's project before the deadline.

**FR-1.4 Deadline enforcement.**
Once `fixtures.event.submissions_close` has passed, a submission
attempt shall be refused with an HTTP 4xx status, checked entirely on
the backend.
*Verified by: `POST {routes.submit}` as participant, expect 4xx.*

**FR-1.5 Team & event model.**
The system shall represent events, tracks, teams, and members loaded
from fixtures; support event configuration and one-time team invites;
and associate every project with exactly one team.

### 3.2 T2 — Judging

**FR-2.1 Judge reads own scores.**
An authenticated judge shall be able to retrieve the scores they
themselves have given.
*Verified by: `GET {routes.judge_scores}` as judge_a, expect 200.*

**FR-2.2 Role isolation (judge ↔ judge).**
A judge shall be refused access to another judge's scores, with the
refusal enforced server-side — never only hidden in the UI.
*Verified by: `GET {routes.peer_scores}` as judge_b, expect 401 or 403.*

**FR-2.3 Role isolation (participant ↔ judge).**
A participant shall be refused access to any judge-only route.
*Verified by: `GET {routes.judge_scores}` as participant, expect 401 or 403.*

**FR-2.4 Organizer export.**
An organizer shall be able to export all recorded scores as a CSV
document.
*Verified by: `GET {routes.csv_export}` as organizer, expect 200 and a CSV body.*

**FR-2.5 Weighted rubric.**
The system shall record, per score, a set of named criteria (e.g.
functionality, quality) sufficient to compute a weighted average
downstream.

**FR-2.6 Progress visibility.**
The system shall provide an organizer dashboard and API that report
assigned, submitted, and outstanding ballots per project. Ballots from
unassigned judges do not count toward completion.

### 3.3 T3 — Public (implemented, not verified by the checker)

**FR-3.1 Public voting.** Visitors may vote according to the event's
open-link, email-gated, or authenticated access policy; duplicate and
rate-limited requests are rejected and audited.

**FR-3.2 Public comments.** Any visitor may leave a comment on a project.

**FR-3.3 Hidden results.** A project's scores shall not be shown on
its public page until `results_publish_at` (or `voting_close` when no
separate publication time is configured).

**FR-3.4 Randomized ballot order.** A judge's scoring queue shall be
presented in a randomized (not fixed submission) order.

### 3.4 T4 — Stretch (implemented, not verified by the checker)

**FR-4.1 REST API** for public, participant, judge, and organizer actions;
the OpenAPI document is served at `/api/openapi.yaml`.

**FR-4.2 Webhooks.** Organizers may register event subscriptions; matching
mutations issue signed asynchronous HTTP POST attempts. Delivery is
best-effort and does not block the action.

**FR-4.3 Bulk import and export** of project records by an organizer.

**FR-4.4 Certificates** — a plain-text certificate of participation,
generated per team.

**FR-4.5 Verifiable judge records.** Judge participation records are
signed with Ed25519 and can be checked through the public verification API.

**FR-4.6 Embeddable gallery.** A script loader embeds the public project
gallery in another page.

---

## 4. Non-functional requirements

**NFR-1 Portability.** `docker compose up` shall bring up a fully
seeded, working portal with no cloud account, hosted database, or
external API call required.

**NFR-2 Statelessness of test runs.** Because the checker's grading is
behavioural, not data-durability-based, the system may hold all state
in memory; a restart may legitimately reset submitted/voted/commented
data (documented, not hidden — see README's "Honest limitations").

**NFR-3 Backend-enforced authorization.** Every authorization decision
(role isolation, deadline enforcement, organizer-only routes) must be
enforced in server-side request handling, never solely in a template
or client-side script.

**NFR-4 Honesty of claims.** `.dogfood.toml`'s `claimed` list must only
name tiers actually verified by the checker; overclaiming is
explicitly penalized by the spec more heavily than underclaiming.

**NFR-5 License.** The repository shall carry an OSI-approved license
(MIT, as committed in `LICENSE`).

**NFR-6 No secrets in the auth model.** Because the checker's auth
headers are fixed, non-secret constants by design (see
`src/auth/TokenAuthProvider.js`), the system must not be mistaken for a real
production authentication scheme — this is documented explicitly in
`ARCHITECTURE.md`.

---

## 5. External interface requirements

### 5.1 `.dogfood.toml` (system configuration interface)

Declares: portal base URL; claimed tiers and a one-line pitch; one
auth header per role (organizer, judge_a, judge_b, participant); and
the five routes the checker calls (`gallery`, `submit`,
`judge_scores`, `peer_scores`, `csv_export`).

### 5.2 `fixtures.json` (data interface)

Consumed once, at boot, per the shape documented in `DATA-MODEL.md`.
Never mutated on disk by the running portal.

### 5.3 HTTP interface

All seven checker requests are plain HTTP/1.1 requests with an
optional `Cookie` header; responses are HTML (gallery, project pages)
or JSON/CSV (judge, export, API routes). No WebSocket or streaming
interface is required by any check.

---

## 6. Use cases (summary)

| ID | Actor | Goal | Primary flow |
|----|-------|------|---------------|
| UC-1 | Stranger | Browse submitted projects | `GET /projects` → 200, list rendered |
| UC-2 | Participant | Submit a project before the deadline | `GET /projects/new` (form) → `POST /projects/new` → 201 or 403 if closed |
| UC-3 | Judge | Review and score an assigned project | `GET /api/judge/queue` → `POST /api/judge/scores` |
| UC-4 | Judge | Check their own scoring history | `GET /api/judge/scores` → 200, own scores only |
| UC-5 | Organizer | Export final results | `GET /api/export.csv` → 200, CSV |
| UC-6 | Visitor | Vote/comment on a project after browsing | `POST /projects/:id/vote`, `POST /projects/:id/comments` |
| UC-7 | Organizer | Register a results webhook | `POST /api/webhooks` → 201 |

---

## 7. Traceability: requirement → implementation

| Requirement | Implemented in |
|-------------|-----------------|
| FR-1.1, FR-1.2 | `src/controllers/galleryController.js` → `src/services/GalleryService.js` (`GET /projects`) |
| FR-1.3, FR-1.4 | `src/controllers/submissionController.js` → `src/services/SubmissionService.js` |
| FR-2.1–FR-2.3 | `src/controllers/judgeController.js` → `src/services/JudgingService.js`, `src/auth/requireRole.js` |
| FR-2.4 | `src/controllers/exportController.js` → `src/services/ExportService.js` |
| FR-3.1–FR-3.4 | `src/controllers/galleryController.js` (votes/comments) → `src/services/CommunityService.js`; `src/controllers/judgeController.js` (`/api/judge/queue`) → `src/services/JudgingService.js` |
| FR-4.1–FR-4.4 | `src/controllers/stretchController.js` → `src/services/StretchService.js` |
| NFR-1, NFR-2 | `src/repositories/*` (in-memory, Map-backed), `docker-compose.yml` |
| NFR-3 | `src/auth/requireRole.js`, `src/errors/DomainError.js` |
| NFR-4 | `.dogfood.toml` (`claimed = ["T1","T2"]`) |
| NFR-5 | `LICENSE` |
| NFR-6 | `src/auth/TokenAuthProvider.js` |

Every repository/service method carries a `@complexity` annotation at
its definition; `COMPLEXITY.md` consolidates them. `ARCHITECTURE.md`
maps each SOLID principle to the specific class that embodies it.

See `ER-DIAGRAM.md` for the corresponding data model diagram.
