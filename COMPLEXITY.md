# Time & Space Complexity

n = total count of the relevant entity (projects, scores, …).
k = size of the specific result being returned (e.g. one judge's
scores) — always ≤ n, usually far smaller.

The original rows map to method annotations; additional workflows added
later are listed below with their current access-path cost.

## Repositories (`src/repositories/`)

| Class | Method | Time | Space | Why |
|-------|--------|------|-------|-----|
| `InMemoryRepository` | `add` | O(1) avg | O(1) | single `Map.set` |
| | `get` / `has` | O(1) avg | O(1) | single `Map.get`/`has` |
| | `list` | O(n) | O(n) | must materialize every item — output-sensitive, not improvable |
| `EventRepository` | `set` / `get` / `isClosed` | O(1) | O(1) | one object, one date comparison |
| `JudgeRepository` | `add` | O(1) avg | O(1) | inherited, plus cache invalidation |
| | `orderedIds` | O(n log n) once, then O(1) until next `add` | O(n) | sorted once and cached; judges are only added at boot, so this is amortized O(1) in practice |
| `ScoreRepository` | `add` | O(1) avg | O(1) | one insert into 3 maps |
| | `get` | O(1) avg | O(1) | |
| | `list` | O(n) | O(n) | |
| | `byJudge` / `byProject` | O(k) | O(k) | index lookup O(1) + materializing k results — this is the hot path for every T2 request, kept output-sensitive on purpose |
| `ProjectIndexedRepository` (Comment, Vote) | `add` | O(1) avg | O(1) | |
| | `byProject` | O(k) | O(k) | same reasoning as `ScoreRepository.byProject` |

## Services (`src/services/`)

| Class | Method | Time | Space | Notes |
|-------|--------|------|-------|-------|
| `FixtureLoader.seedFromFixtures` | — | O(n) | O(n) | every fixture entity read and inserted exactly once |
| `GalleryService` | `listProjects` | O(n) | O(n) | |
| | `teamName` | O(1) | O(1) | |
| | `getProjectDetail` | O(k) | O(k) | k = that project's comments + votes + scores, all index-backed |
| `SubmissionService` | `isOpen` / `submit` | O(1) | O(1) | |
| `JudgingService` | `resolveSeatOrId` | O(1) | O(1) | reads cached `orderedIds()` |
| | `scoresFor` | O(k) | O(k) | k = requested judge's score count |
| | `recordScore` | O(1) | O(1) | |
| | `randomizedQueue` | O(n) | O(n) | Fisher–Yates shuffle — optimal for a uniform random permutation, no sub-linear alternative exists |
| `ExportService` | `toCsv` | O(n) | O(n) | one O(1) project lookup per score row |
| `CommunityService` | `castVote` / `addComment` | O(1) | O(1) | |
| `StretchService` | `registerWebhook` / `bulkImport` | O(1) / O(m) | O(1) / O(m) | m = imported item count |
| | `certificateFor` | O(n) | O(k) | deliberate linear scan — see ARCHITECTURE.md's note on not over-indexing a cold path |

## Added workflows

| Operation | Time | Space | Notes |
|-----------|------|-------|-------|
| `JudgingService.assignProjects` | O(a + p·j log j) | O(a + j) | p projects, j judges, a existing assignments; sorts eligible judges per project |
| `JudgingService.assignJudgeProjects` | O(m·t) | O(m) | m project ids, t track count |
| `JudgingService.progress` | O(p·(a+s)) | O(p+a) | p projects, a assignments, s scores; counts only assigned ballots |
| `JudgingService.normalizedResults` | O(s·p + p log p) | O(s+p) | s ballots and p projects; computes per-judge z-scores and ranks project means |
| `JudgingService` rubric methods | O(r) | O(r) | r criteria; rubric is bounded to three criteria |
| judge invite checks | O(j+i+t) | O(1) | j judges, i invitations, t requested tracks |
| team email membership checks | O(m) | O(1) | m total team-member emails |
| `EventService.configure` | O(t + p·t + j·t) worst case | O(t) | validates track removals against projects and judges |
| `CommunityService.castVote` | O(v+r) | O(r) | v project votes and r active rate-window timestamps |
| `ExportService.projectsToCsv` | O(p) | O(p) | p projects |
| `StretchService.bulkImport` | O(m·u) | O(m) | m records, u bounded field/URL size; entity lookups are Map-backed |
| `StretchService.dispatchWebhooks` | O(w) to enqueue | O(w) | w matching endpoints; network attempts are asynchronous and time-bounded |

## Design rule applied throughout

**Index the hot paths, don't index the cold ones.** Every route the
DOGFOOD checker actually exercises repeatedly (judge scores, CSV
export, project detail with comments/votes) is backed by a Map-based
index, so a lookup costs only what it takes to materialize the actual
result (O(k)), never a full O(n) scan of unrelated data. Routes that
are rare, organizer-only, and not part of the scored checks
(`certificateFor` being the one example) intentionally use a plain
O(n) scan instead — building and maintaining a second index for a
route that runs once in a while would be extra state and extra
invalidation logic for no measurable benefit at hackathon-fixture
scale (tens to low hundreds of records).

**Memoize only what's actually reused.** `JudgeRepository.orderedIds()`
is called on nearly every judge-authenticated request (once by
`identify()`, again by `JudgingService`), so it's cached; nothing else
in this codebase repeats an expensive computation often enough to
justify caching it.
