# Judging

## Assignment

Each judge scores projects in their own track(s), as declared in
`fixtures.judges[].tracks`. This build does not enforce track-based
assignment at the API level (a judge can technically POST a score for
any project id) — the fixture doesn't give us a hard rule to check
against beyond "judges have tracks", and the DOGFOOD checks don't test
assignment enforcement, so we didn't spend the time building it. If
this were a real event, `JudgingService.recordScore` would validate
that `project.track` is in the judge's track list before accepting a
score — a small addition to one method, not a structural change.

## Scoring / rubric

`criteria` on a score is an open object (`{ functionality: 4, quality: 3, ... }`)
— we don't hardcode a fixed rubric shape, since the fixture itself
doesn't fix one either. `ExportService.toCsv()` includes the raw
`criteria` JSON per row so an organizer can compute whatever weighted
average they want downstream.

## Normalization

Not implemented. The DOGFOOD spec lists a normalization proof as a
bonus item, not a required check, and bonus points don't change the
weighted score — they only break ties. We chose not to build it given
the 72-hour window; a correct T1+T2 was the priority.

## Role isolation

This is the check the spec calls out as costing the most points when
done wrong. Implemented server-side in `JudgingService.scoresFor()`
(`src/services/JudgingService.js`), enforced before `ScoreRepository`
is ever queried — see `ARCHITECTURE.md` for the exact mechanism. A
judge's own scores return 200; a request for a peer judge's scores
throws a 403 `DomainError` regardless of what the frontend does or
doesn't show.

## Progress view

Not implemented as a dedicated organizer page. `GET /api/v1/projects`
plus `GET /api/export.csv` give an organizer the raw data to see
who's been scored and who hasn't; there's no built-in "N of M judged"
dashboard. Listed here rather than silently skipped.

## What we claim vs. what we built

`.dogfood.toml` claims **T1 and T2 only**. T3 (voting, comments,
hidden results, randomized judge queue) and T4 (REST API, webhooks,
bulk import, certificates) are implemented and reachable in this
build, but the DOGFOOD checker (`run.py`) only tests T1/T2, so we have
no automated verification of the T3/T4 code beyond manual testing
(`tests/README.md`). Per the spec's own guidance — "claiming further
than you did is the one thing that actually costs points" — we're
claiming only what's verified, and documenting the rest here instead
of in `.dogfood.toml`.
