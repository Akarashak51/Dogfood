# Threat Model

## Assets

- Private judge ballots, judge feedback, participant email addresses, and organizer event configuration.
- Integrity of project submissions, published results, public votes, and judge participation records.
- Availability of the single-process portal and its in-memory audit trail.

## Trust boundary

- Public HTTP requests reach unauthenticated gallery, vote, comment, invite-acceptance, and read-only API routes.
- Participant, judge, and organizer requests are separated by server-side role middleware.
- Judge score access is additionally constrained by judge identity, track, and explicit project assignment in `JudgingService`.
- Organizer-supplied webhook URLs receive outbound requests only after explicit registration; startup and ordinary offline operation do not depend on network access.

## Attacks and current controls

| Attack | Control | Residual risk |
|---|---|---|
| Judge reads a peer ballot | Route role check plus service identity comparison; score writes and assignments are separate | Organizer credentials can read exports by design |
| Judge scores another track | Assignment generation and score submission both verify the project's track against the judge | Fixture ballots are historical input and may not reflect current assignments |
| Participant edits another team's project | Participant session carries a team id; service checks ownership on every update | Demo bootstrap participant token is deliberately mapped to the first fixture team |
| Late project submission or edit | Service compares the event's configured submission deadline on each write | In-memory event changes disappear after restart |
| Duplicate vote | One vote per hashed requester identity and project | IP-based open voting is vulnerable to proxies, VPNs, shared networks, and Sybil identities |
| Vote/comment floods | Per-identity rolling one-minute limits and an organizer-readable audit log | Limits and audit data are process-local and can be bypassed by rotating identities or restarting |
| Malicious project/comment HTML | Dynamic HTML is escaped; repository links are validated as HTTP(S) on writes | Imported fixture data is trusted input; operational deployments should validate imports too |
| Invite reuse or email mismatch | Random one-time token, seven-day expiry, optional email binding | Email is not independently verified; an invite URL is a bearer credential |
| Session theft | Runtime sessions use HttpOnly, SameSite=Lax cookies and random identifiers | HTTP local deployments do not use Secure cookies; use TLS behind a trusted reverse proxy in production |
| CSRF | SameSite=Lax cookie policy; role and ownership checks | No per-form CSRF token is implemented; production deployment should add one |
| Malicious webhook target or forged delivery | HTTP(S)-only URLs, direct private/reserved address rejection, DNS preflight, redirects disabled, short timeout, and HMAC-signed payloads | DNS rebinding remains possible between preflight and fetch; attempts are single-shot and in-memory |
| Data loss or audit tampering | None beyond process isolation; state is in memory | Restart loses all non-fixture data; audit records are not tamper-evident |
| False judge record | Ed25519 signature detects payload modification | The public key is self-contained, not chained to a trusted long-lived event key; it proves integrity, not identity by itself |

## Deployment boundary

The fixed `.dogfood.toml` cookies are checker/demo credentials, printed on startup, and are not a production identity system. The app uses no persistent database, durable session store, external identity provider, or durable webhook retry worker. Do not expose this demo configuration to a public event without replacing the bootstrap tokens, adding durable storage, TLS, CSRF protection, email verification, DNS-pinned webhook transport, and operational monitoring.