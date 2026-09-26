# Demo video script

A suggested run of show, timed to roughly 3–4 minutes. Nothing here is
required wording — read it in your own voice, or use it as a checklist
of beats to hit. Screen-record your terminal + browser; no editing
software needed beyond basic trimming.

## Before you hit record

- Have the portal already running (`docker compose up --build`, or
  `npm start`), with the real `fixtures.json` loaded — check the seed
  log line shows real numbers (8 tracks / 30 judges / 40 teams / 41
  projects / 126 scores).
- Have four browser tabs or a way to switch `Cookie` headers quickly
  for organizer / judge_a / judge_b / participant (a REST client like
  Insomnia/Postman, or browser dev tools, makes this easiest).
- Have a second terminal ready with `run.py` and `.dogfood.toml`.

## Beat 1 — What this is (20–30s)

"This is our DOGFOOD submission — a hackathon submission and judging
portal. We're claiming T1 and T2, both verified by the official
checker. I'll show the running app, then the checker output."

## Beat 2 — T1: the public gallery (30–45s)

- Open `http://localhost:8080` with no auth — show it redirects to
  `/projects` and just works, no login wall.
- Point out a couple of real fixture project titles on the page (not
  placeholder text) to show the real data is loaded, not the sample.
- Click into one project's detail page — mention results are hidden
  because the event is closed, but comments/votes are visible.

## Beat 3 — T1: submissions are actually closed (20–30s)

- Go to `/projects/new`. Show the "submissions are closed" message.
- Optionally, in the terminal, `curl -i -X POST .../projects/new` as
  a participant and show the 4xx — "this isn't just a hidden button,
  the server itself refuses it."

## Beat 4 — T2: judge isolation, the important one (45–60s)

This is the check the spec calls out as the one that matters most, so
give it real screen time:

- As judge_a, hit `/api/judge/scores` — show your own scores, 200.
- As judge_b, hit the *same URL that returns judge_a's scores*
  (`/api/judge/scores?judge=judge_a`) — show 403.
- Say out loud: "this is enforced in the service layer, not hidden in
  the template — a judge can't get another judge's numbers by typing
  a different URL."

## Beat 5 — T2: organizer export (15–20s)

- As organizer, hit `/api/export.csv` — show the CSV downloading /
  printing with real rows (project, team, judge, criteria, comment).

## Beat 6 — The checker, run live (30–45s)

- Switch to the second terminal.
- Run `python3 run.py .dogfood.toml` live, on camera.
- Let all seven lines print. Point at the last line:
  `claimed T1 T2, verified T1 T2`.

## Beat 7 — Close (15–20s)

- One sentence on what's built beyond the claimed tiers if you want
  (public voting/comments, a small REST API) — but be clear these
  aren't claimed against the checker, per `.dogfood.toml`.
- One sentence on the honest limitations (in-memory storage, no real
  auth) — from `README.md` → "Honest limitations". Judges tend to
  trust a team more, not less, for saying this out loud.

## Don't

- Don't narrate features that aren't actually claimed as if they were
  scored — the checker only tests what's in `.dogfood.toml`.
- Don't edit out a FAIL if one shows up on the day — re-run the
  checker until it's clean *before* recording, rather than cutting a
  failure out of the footage.
