# Data model

## Input: fixtures.json

We load `fixtures.json` exactly as published — it is treated as input,
not as our schema (`src/services/FixtureLoader.js` is the only module
that ever reads the file). Shape (see the DOGFOOD spec for the
authoritative version):

```
event    { id, name, submissions_close }
tracks   [ { id, name } ]
judges   [ { id, name, email, tracks: [id] } ]
teams    [ { id, name, members: [email] } ]
projects [ { id, team, track, title, summary, repo_url, submitted_at } ]
scores   [ { judge, project, criteria: { ... }, comment } ]
```

Every id is a string, every timestamp ISO 8601 UTC, and some score
entries are deliberately missing or duplicated — the fixture is
designed to be awkward on purpose.

## In-memory representation (`src/repositories/`)

Each fixture collection gets its own repository instance, wired
together once in `src/container.js`:

| Repository | Backing structure | Extra indices |
|-------------|--------------------|----------------|
| `EventRepository` | single object (not a collection) | — |
| `track` (`InMemoryRepository`) | `Map<id, track>` | membership checked during assignments and submissions |
| `JudgeRepository` | `Map<id, judge>` | cached sorted id list (`orderedIds()`) |
| `team` (`InMemoryRepository`) | `Map<id, team>` | none |
| `project` (`InMemoryRepository`) | `Map<id, project>` | none — see below |
| `ScoreRepository` | `Map<id, score>` | `Map<judgeId, Set<scoreId>>`, `Map<projectId, Set<scoreId>>` |
| `CommentRepository` | `Map<id, comment>` | `Map<projectId, Set<commentId>>` |
| `VoteRepository` | `Map<id, vote>` | `Map<projectId, Set<voteId>>` |
| `webhook` (`InMemoryRepository`) | `Map<id, webhook>` | none |
| `assignment`, `invite`, `judgeInvite`, `audit` | `Map<id, record>` | runtime assignment, invitation, and audit state |

We only index what's actually queried by a foreign key more than
once — see `COMPLEXITY.md` for the full reasoning. `project` has no
by-team index, for instance, because nothing currently looks projects
up that way; `ScoreRepository` has two, because "this judge's scores"
and "this project's scores" are both real, repeated queries.

## Why we didn't just store the same JSON

The fixture is *input*, shaped for portability (score entries
reference ids, not embedded objects). Internally we want O(1)/O(k)
lookup by id and by foreign key (see `COMPLEXITY.md`), so each
repository indexes what it's handed on load. This is a pure read-side
transformation — nothing mutates or reshapes the underlying fixture
data, we just index it.

## Data added by this portal (not in fixtures.json)

- **Comments** — public, one per submission, tied to a project id.
- **Votes** — one vote per project and requester fingerprint. The stored
  voter value is a process-keyed HMAC-SHA-256 digest, not the raw IP/email. Open-link mode
  still permits Sybil identities and is only a best-effort control.
- **Assignments** — `{ judge, project, track }` records keyed by
  `judgeId:projectId`; writes re-check declared judge tracks.
- **Invitations** — expiring, single-use participant and judge tokens;
  participant invites may be bound to an email address.
- **Audit** — action, timestamp, and privacy-limited details for judging,
  imports, comments, votes, and rate-limit events.
- **Webhooks** — validated organizer registrations with an HMAC secret,
  plus asynchronous delivery records. Attempts are single-shot and
  process-local; no durable retry worker is included.
- New projects submitted through browser or REST routes use generated
  UUID-backed ids and join the same repository as fixture projects.

## Persistence

None. Every repository starts empty and is rebuilt from
`fixtures.json` each time the process starts; anything submitted,
voted, or commented during a run is lost on restart. See README's
honest limitations for what a real deployment would need instead.
