# Tests

There is no automated test suite beyond the DOGFOOD checker itself
(`run.py`, run against `.dogfood.toml`) — that already exercises every
behaviour that's actually scored (T1 gallery/submission/deadline, T2
judging/isolation/export).

## Manual smoke test for the T3/T4 extras (not covered by run.py)

```bash
# Public voting + comments
curl -i -X POST http://localhost:8080/projects/<a-real-project-id>/vote
curl -i -X POST http://localhost:8080/projects/<a-real-project-id>/comments \
  -d "author=Ada&text=Nice+project"

# Randomized judge queue
curl -i http://localhost:8080/api/judge/queue -H 'Cookie: session=jdg_a_91bc'

# REST API
curl -i http://localhost:8080/api/v1/projects

# Webhook registration (organizer only)
curl -i -X POST http://localhost:8080/api/webhooks \
  -H 'Cookie: session=org_7f2a' -H 'Content-Type: application/json' \
  -d '{"url":"https://example.org/hook","event":"project.submitted"}'

# Bulk import (organizer only)
curl -i -X POST http://localhost:8080/api/import \
  -H 'Cookie: session=org_7f2a' -H 'Content-Type: application/json' \
  -d '{"projects":[{"team":"tm_01","title":"Imported project"}]}'

# Certificate
curl -i http://localhost:8080/api/certificates/<a-real-team-id>
```

Expect 200/201 for the happy paths above, and 403 if you drop the
organizer cookie from the organizer-only ones.
