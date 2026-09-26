# Architecture

## Layers

```
HTTP request
   │
   ▼
identify()            — src/auth/identify.js         (who is asking?)
   │
   ▼
Controller             — src/controllers/*            (HTTP only: parse request,
   │                                                    call one service method,
   │                                                    pick a status code)
   ▼
requireRole()? / Service  — src/auth/requireRole.js,   (business rules: deadlines,
   │                        src/services/*              role isolation, CSV shape)
   ▼
Repository              — src/repositories/*           (data access only, no
                                                          HTTP or business logic)
```

Each arrow only goes one way: a repository never imports a service, a
service never imports Express, and a controller never touches a Map
directly. That's what makes the SOLID section below more than a
label — it's enforced by which files are even allowed to `require()`
which other files.

## SOLID, concretely

| Principle | Where it shows up |
|-----------|--------------------|
| **S**ingle Responsibility | `GalleryService` decides what's visible; `SubmissionService` decides who may submit; `JudgingService` decides who may read which scores; `ExportService` only formats CSV. Each has exactly one reason to change. Controllers don't format CSV; services don't know about HTTP status codes (they throw `DomainError`, see below). |
| **O**pen/Closed | `InMemoryRepository` is closed for modification — nothing in the app reaches into its private `#itemsById` Map. It's open for extension: `JudgeRepository` and `ScoreRepository` add behaviour (`orderedIds()`, `byJudge()`) without touching the base class's code. |
| **L**iskov Substitution | Any class matching a repository's public shape (`add`, `get`, `list`, …) can replace `InMemoryRepository` in `container.js` — a future Postgres-backed repository just needs the same methods, same contracts, and every service keeps working unmodified. |
| **I**nterface Segregation | Services only receive the repositories they actually use (see each service's constructor destructuring) — `ExportService` doesn't get handed a `CommentRepository` it has no use for. |
| **D**ependency Inversion | Controllers depend on `services` (an object of already-built instances), never on `require("../repositories/...")` directly. `container.js` is the one file that wires concrete classes together — everything else depends on the shape those classes expose, not their implementation. |

## Why in-memory, not a real database

The DOGFOOD checks are about behaviour (who can see what), not data
durability, and a 72-hour build shouldn't add a moving part with no
payoff. Because repositories sit behind the same narrow interface
everywhere (Liskov/DIP above), swapping `InMemoryRepository` for a
Postgres-backed class later is a `container.js`-only change.

## Auth model

The checker never logs in — it attaches a header. `TokenAuthProvider`
(`src/auth/TokenAuthProvider.js`) is the *only* file that knows a
session value maps to a role; `identify()` middleware calls it and
sets `req.user`. A different login scheme later — JWT, OAuth, whatever
— means writing a new class with the same `resolve(req)` method and
handing it to `createIdentifyMiddleware` in `server.js`; nothing else
changes.

Route-level `requireRole(...)` (`src/auth/requireRole.js`) then
decides who's let in. Identification and authorization are
deliberately two different middlewares (Single Responsibility): one
labels the caller, the other enforces a rule about that label.

## Role isolation — where the check actually lives

The DOGFOOD spec calls this out as the single most common way a
good-looking project loses points: hiding a peer judge's scores in
the template while the API still returns them. `JudgingService.scoresFor()`
(`src/services/JudgingService.js`) resolves *which* judge's scores are
being asked for, compares that to the authenticated judge's own id,
and throws a 403 `DomainError` on any mismatch — before any data is
read from `ScoreRepository`. `curl` with judge B's cookie against
judge A's scores is refused by the exact same code path a browser
would hit.

## judge_a / judge_b → real fixture judges

`.dogfood.toml` speaks in seat labels; the real `fixtures.json` has
its own judge ids. `JudgeRepository.orderedIds()` sorts the fixture's
judge ids once (cached until the next `add`, which only happens at
boot) and both `identify()` (at login time) and `JudgingService`
(at query-resolution time) call the exact same method — so the two
always agree regardless of what ids the real fixture uses.

## Error handling

Business-rule failures (closed event, wrong judge, missing team)
throw a `DomainError` (`src/errors/DomainError.js`) carrying its own
HTTP status. Controllers catch it via the shared
`handleControllerError` helper (`src/controllers/handleControllerError.js`)
and respond accordingly; anything that *isn't* a `DomainError` is
re-thrown rather than swallowed, because an unexpected exception is a
bug, not a 400.

## T3/T4 additions

Voting, comments, and the randomized judge queue reuse the same
repositories and the same `identify`/`requireRole` machinery — public
routes simply skip `requireRole`. Webhooks are recorded
(`WebhookRepository`, via `InMemoryRepository`) rather than delivered,
since delivering them would require outbound network access, which
conflicts with the "network off" requirement for `docker compose up`.
`StretchService.certificateFor()` deliberately does a linear O(n) scan
over all projects rather than maintaining a permanent by-team index —
it's an infrequent, uncontested T4 route, and adding a second index
purely to speed up a cold path would be complexity with no real
payoff (see `COMPLEXITY.md`).

## Time & space complexity

Every repository and service method carries its own `@complexity`
JSDoc comment at the point it's defined. `COMPLEXITY.md` collects them
into one reference table.
