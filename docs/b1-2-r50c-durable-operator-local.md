# R50-C — durable single-use grant adapter and offline operator-browser rehearsal

Status: LOCAL_ONLY candidate. Specification: Draft. Implementation: Local
source and tests, including file-backed SQLite. Production / trial: HOLD.

Git baseline: b34f31a984efa26676c00deae16b904c42fb29c8.
Incremental to the existing uncommitted R50-B patch, not a release.

## Architecture

- api/event.ts optionally obtains a durable claim store only in R50
  operator-only mode. Without matching config, operator identity and grant
  storage, forwarding is denied. Existing legacy behavior is not expanded.
- src/lib/b1-2/r50-durable-grant-transport.ts signs exactly ONE HTTPS
  claim request using the existing server-only event signing secret in a
  distinct HMAC domain. Four-second timeout, no cookies, redirect or retry.
  Only exact consumed receipts are accepted.
- worker/r50-grant-claim.mjs is a separate candidate Worker, NOT the
  existing worker/index.mjs. It verifies signed claims and performs one
  conditional parameterized D1 UPDATE. It cannot issue/refund grants, and
  requires an explicit receiver switch with no enabled defaults.
- schema/bitevo_r50_operator_grants.sql is a separate, UNAPPLIED D1 table
  with claim key, policy digest, window and consumed/revoked timestamps.
  No operator token, contact details, IP or HMAC key is stored in the table.
- wrangler.r50-grant.jsonc is a separate LOCAL config, with candidate
  Worker name not provisioned/verified. No Worker deployment, route, secret
  binding or production D1 schema was changed.
- scripts/r50-operator-browser-local.mjs --offline-smoke runs a Chrome
  loopback-only fixture for Book a free triage. At widths 390/1280 it
  accepts one intent from two clicks. It prevents booking navigation,
  contains no operator token, blocks external fetches and sends no POST.
  This is an offline browser rehearsal, not a live owner-click flow.

## Grant semantics

The pre-provisioned record is keyed by stable (project, trialId). The
policy digest binds SHA, operator-token digest, receiver, exact event,
page, locale and authorization window.

A single SQL UPDATE conditionally sets consumed_at_ms only if the record
exists, its digest matches, it is unspent and unrevoked, and the time
window matches. Success requires D1 success, exactly one changed and
written row, and changed_db=true. There is no SELECT-then-UPDATE race.

The local tests use an actual on-disk SQLite file across two DB
connections; only one concurrent claim succeeds and reopening the DB
does not rearm it. Revocation, wrong digest, lost receipt and replay all
fail closed. A synthetic full chain reaches the unchanged main Worker
with a fake aggregate. This does NOT prove Cloudflare D1 runtime,
provider concurrency, real browser delivery, or distributed exactly-once
accounting. Existing Worker still has no request ID deduplication.

## Future gates — explicitly not executed

Need fresh approved source commit; security/privacy decision; separate
D1 grant schema migration; actual grant Worker deployment, verified
hostname/secret/receiver switch; pre-provisioned approved grant;
Vercel server-only claim URL and R50 env; secure owner browser
integration, independent CI/Preview qualification and express approval.
A later single live event requires a fresh before D1 read, exact one
operator click, independent after read, and STOP without retry on any
ambiguous response. Public browser client must stay OFF until separately
approved and qualified. No real operator token in Git, logs, HTML or
URL; no signing-secret value was read.

## Local commands

node --test tests/b1-2-r50-durable-grant.test.mjs tests/b1-2-r50-operator-admission.test.mjs
node scripts/r50-operator-browser-local.mjs --offline-smoke
npm run typecheck:api
npm run build:core
node scripts/verify-b1-2-event-counter.mjs
node scripts/verify-r47a-privacy.mjs

Retain earlier R50-B receipt and patch unchanged. This extension
requires its own complete local diff/tree/hash qualification.
