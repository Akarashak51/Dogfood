# Tests

Run the local behavior suite with:

```bash
npm test
```

The built-in Node test runner covers deadline/result-window separation,
participant ownership, duplicate voting, track-safe assignments and
scoring, weighted normalization, event configuration, team/judge
invitations, bulk import validation, and signed-record tamper detection.
It has no third-party test dependency.

The official `run.py` remains the submission acceptance checker. It
verifies T1 and T2 only; it does not certify T3 or T4.

## Manual route smoke test

```bash
# Public voting + comments
curl -i -X POST http://localhost:8080/projects/<a-real-project-id>/vote
curl -i -X POST http://localhost:8080/projects/<a-real-project-id>/comments \
  -d "author=Ada&text=Nice+project"

# Randomized judge queue
curl -i http://localhost:8080/api/judge/queue -H 'Cookie: session=jdg_a_91bc'

# REST API, search, widget, and OpenAPI document
curl -i http://localhost:8080/api/v1/projects
curl -i "http://localhost:8080/api/v1/projects?track=trk_01"
curl -i http://localhost:8080/embed.js
curl -i http://localhost:8080/api/openapi.yaml

# Webhook registration (organizer only; delivery status is recorded)
curl -i -X POST http://localhost:8080/api/webhooks \
  -H 'Cookie: session=org_7f2a' -H 'Content-Type: application/json' \
  -d '{"url":"https://example.org/hook","event":"project.submitted"}'

# Bulk import (organizer only)
curl -i -X POST http://localhost:8080/api/import \
  -H 'Cookie: session=org_7f2a' -H 'Content-Type: application/json' \
  -d '{"projects":[{"team":"tm_01","title":"Imported project"}]}'

# Certificate and signed judge record
curl -i http://localhost:8080/api/certificates/<a-real-team-id>
curl -i http://localhost:8080/api/v1/judges/jdg_01/record
```

Expect 200/201 for the happy paths above, and 403 if you drop the
organizer cookie from the organizer-only ones.
