# Submission checklist

Run through this once, in order, right before you submit. Everything
in this repo has already been verified against the real `run.py` and
the real `fixtures.json` (see `acceptance-report.txt`) — this list is
about the parts that depend on *your* machine and *your* repo host,
which nobody can verify for you in advance.

## 1. Pick a setup path and prove it boots clean

**Path A — Docker (what the organizers will actually run):**

```bash
docker compose up --build
```

Wait for the seed line in the logs:

```
[seed] loaded event "Sample Hack 2026" — 8 tracks, 30 judges, 40 teams, 41 projects, 126 scores
```

If the numbers don't match (8/30/40/41/126), the real `fixtures.json`
isn't the one being loaded — check it's at the repo root and wasn't
overwritten back to the tiny sample.

**Path B — VS Code terminal, no Docker (fast local loop):**

See `README.md` → "Option A — run without Docker". Same seed line,
same behavior, useful for editing and re-testing quickly before you
do the Docker run above as your final check.

Do at least one full run of **Path A** before submitting — it's the
one closest to how a grader will actually run your project.

## 2. Re-run the real checker one more time, freshly

Don't trust an old `acceptance-report.txt` sitting in the repo — files
get out of sync with code. Regenerate it right before you commit:

```bash
# with the portal from step 1 still running in one terminal:
python3 run.py .dogfood.toml > acceptance-report.txt
cat acceptance-report.txt
```

Confirm the last line reads:

```
claimed T1 T2, verified T1 T2
```

If it doesn't, fix whatever's failing before you commit — don't claim
a tier the checker can't verify (the spec is explicit that overclaiming
is the one thing that actually costs points).

## 3. The five required things (from spec.md)

- [ ] `docker compose up` brings up a working, seeded portal — no
      cloud accounts, no hosted DB, no external API. (Verified above.)
- [ ] An OSI-approved license in the repo — `LICENSE` (MIT) is present.
- [ ] Code written during the event window. (Yours to confirm — this
      repo can't know when you wrote it.)
- [ ] `.dogfood.toml` at the repo root, with honest tier claims —
      present, claims `T1 T2` only, both verified.
- [ ] `acceptance-report.txt` committed, whatever it says — regenerate
      it per step 2, then commit it.

Plus the documents the website lists: `README.md`, `ARCHITECTURE.md`,
`DATA-MODEL.md`, `JUDGING.md` — all present in this repo — **and a
demo video**, which is not something this repo can produce for you.
See `DEMO-VIDEO.md` for a ready-to-read script sized to a few minutes.

## 4. Commit and push

```bash
git init                      # if this isn't already a repo
git add .
git commit -m "DOGFOOD submission: T1+T2, verified"
git remote add origin <your-repo-url>
git push -u origin main
```

Double check after pushing that `fixtures.json` on the remote is the
real ~46KB file (41 projects), not the small sample — GitHub's file
list will show the size next to the filename.

## 5. Submit

Follow whatever the event page / Unstop listing asks for (repo link,
`acceptance-report.txt` contents, demo video link, pitch). If that
listing has any requirement not covered in this repo's `spec.md`
(team size, a specific deadline, a submission form field), that lives
on the event page itself — this checklist only covers the technical
spec that shipped with `run.py` and `fixtures.json`.
