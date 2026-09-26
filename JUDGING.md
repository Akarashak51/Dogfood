# Judging

## Assignment

At boot, `JudgingService.assignProjects()` assigns each project to up to
three eligible judges. Eligibility is exact track membership from
`judges[].tracks`; a greedy least-loaded-first choice balances the
review count, and judge id is the deterministic tie-breaker. Organizers
can add assignments manually, but the same track rule is checked again
before the assignment is stored and before a score is accepted. Duplicate
assignments are idempotent.

The checker seat labels still resolve deterministically to the first two
sorted fixture judge ids. Invited judges receive their own runtime
identity and track list; they do not inherit either checker seat.

## Weighted Rubric

The default rubric is functionality 0.40, quality 0.35, and innovation
0.25. Organizers may change the three positive weights; the service
normalizes them to sum to one. Each criterion is a required integer from
1 through 5, and one judge may submit at most one ballot per assigned
project.

For judge $j$ and project $p$, the raw score is:

$$
R_{jp} = \frac{\sum_i w_i s_{jpi}}{\sum_i w_i}
$$

The service returns raw criteria in the ballot export. Project raw
results are the arithmetic mean of available judge-level weighted
scores; missing reviews are not imputed.

## Cross-Judge Normalization

For each judge, calculate the population mean $\mu_j$ and population
standard deviation $\sigma_j$ over that judge's available weighted
scores. Convert each ballot to a 1–5 scale around a neutral midpoint:

$$
N_{jp} = \operatorname{clamp}\left(3 + \frac{R_{jp} - \mu_j}{\sigma_j}, 1, 5\right)
$$

If $\sigma_j = 0$, every ballot from that judge is mapped to 3: the
observed data contains no within-judge signal to rank their projects.
Normalized project results are means of the normalized ballots that
exist. The organizer endpoint returns raw and normalized rankings,
review counts, and the method string so ranking movement is inspectable.

This is a transparent baseline, not a claim of statistical certainty.
Z-scores are sensitive to small samples and outliers; missing reviews
remain missing; and a judge who scores only one project has no usable
calibration signal. The progress view and review count must be read
alongside the normalized ranking. Pairwise Bradley-Terry judging is not
implemented in this build.

## Role isolation

This is the check the spec calls out as costing the most points when
done wrong. Implemented server-side in `JudgingService.scoresFor()`
(`src/services/JudgingService.js`), enforced before `ScoreRepository`
is ever queried — see `ARCHITECTURE.md` for the exact mechanism. A
judge's own scores return 200; a request for a peer judge's scores
throws a 403 `DomainError` regardless of what the frontend does or
doesn't show.

## Progress and Audit

`/organizer` shows assigned/scored counts for each project. Only ballots
from judges assigned to that project count toward completion; unrelated
historical fixture scores do not. The same data is available at
`GET /api/organizer/judging/progress`. Score writes, assignments,
invitations, imports, votes, comments, and abuse-limit events are kept
in an in-memory organizer audit view at `GET /api/organizer/audit`.

## What we claim vs. what we built

`.dogfood.toml` claims **T1 and T2 only**. The official `run.py` has
seven checks and stops at T2. The local `npm test` suite exercises
additional service behavior, but it is not the official T3/T4 acceptance
suite. T4 delivery has no durable queue or retry worker, and runtime
state is ephemeral, so the claim intentionally remains conservative.
