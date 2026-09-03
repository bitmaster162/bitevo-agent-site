# BitEvo Scope Handoff R1 — implementation source boundary

Status: `P1G1R1_SOURCE_ONLY / PR49_DRAFT / RUNTIME_DISABLED / STORAGE_UNPROVISIONED / PRODUCTION_UNCHANGED`

## Purpose

This implementation source realizes the already-merged `bitevo.scope-handoff.r1` request and receipt contract without changing BitEvo's static Astro `dist/` release model.

The endpoint is for **scope review intake only**. It does not authorize testing, create a booking, accept payment, start an engagement, or prove that a human has reviewed the request.

## Architecture correction

An earlier P1G1 canary tested `@astrojs/vercel` plus an Astro `prerender=false` endpoint. That design is rejected for this repository because the adapter moves static output into `.vercel/output/static`, while BitEvo's canonical postprocess and provider-neutral gates consume `dist/`. The canary failed on `ENOENT dist/index.html` after Astro route generation. The canary and adapter were removed and `astro.config.mjs` was restored to the exact static baseline.

P1G1R1 therefore uses a provider-isolated native Vercel Function:

- endpoint source: `api/scope-handoff.ts`;
- shared runtime logic: `src/lib/scope-handoff-r1/core.js`;
- storage adapters: `src/lib/scope-handoff-r1/stores.js`;
- browser controller source: `public/scope-handoff-r1.js`;
- deterministic verification: `scripts/verify-scope-handoff-r1-runtime.mjs`.

No `@astrojs/vercel` adapter is present. `astro.config.mjs` remains static. Existing `dist/` postprocessing remains authoritative.

## Provider asymmetry

Vercel and Cloudflare remain separate provider paths.

### Vercel

The top-level `/api/scope-handoff.ts` source is a Vercel-specific request-time candidate. It is fail-disabled unless `SCOPE_HANDOFF_R1_ENABLED` is exactly `true`.

P1G1R1 does not create or set that environment variable. It does not provision Blob storage and does not perform real or synthetic Blob writes.

### Cloudflare

The existing Cloudflare Worker/assets path is unchanged in P1G1R1. `wrangler.jsonc`, `worker/index.mjs`, the static Astro build and `dist/` contract remain the existing provider path. P1G1R1 does **not** claim `/api/scope-handoff` runtime parity on Cloudflare.

If Cloudflare runtime parity becomes required, it needs a separate architecture and effect gate.

## Runtime kill switch

The native function checks the enable state before constructing a storage adapter. Missing/false enable state returns:

- HTTP `503`;
- `status=SERVICE_DISABLED`;
- `provider_io=0`;
- `testing_authorization=false`.

The browser controller is independently disabled by source constant `UI_ENABLED=false`. Therefore the current source default injects no handoff UI and initiates no network request.

## Request boundary

The merged JSON contract remains authoritative:

- `schema_version=bitevo.scope-handoff.r1`;
- `submission_intent=scope_review_only`;
- `testing_authorization=false`;
- `secret_confirmation=true`;
- `consent_scope_review=true`;
- locale `en|ru`;
- intake depth `entry|primary`;
- bounded field lengths;
- no arbitrary extra properties.

Entry sends only Entry fields. Deferred Primary fields are not transmitted in Entry even if hidden browser fields were previously populated by a mapper handoff.

Primary requires the full evidence, Rules-of-Engagement and data-boundary fields.

## Idempotency and receipt boundary

Canonical request JSON is recursively key-sorted and SHA-256 hashed.

Candidate future private Blob pathname:

`scope-handoff/r1/<client_submission_id>.json`

The runtime models:

- first authoritative create -> HTTP `201` with one opaque server `submission_id`;
- exact replay with same digest -> HTTP `200`, same `submission_id`, `replayed=true`;
- same `client_submission_id` with different digest -> HTTP `409 IDEMPOTENCY_CONFLICT`;
- uncertain read/write/reconciliation -> HTTP `503` with `UNKNOWN_RECONCILE`, never success;
- concurrent first writes reconcile to the authoritative stored record.

A success receipt may mean only:

- `status=RECEIVED_FOR_SCOPE_REVIEW`;
- `delivery_status=INTAKE_RECORD_ACCEPTED`;
- `human_review_status=NOT_CONFIRMED`;
- `testing_authorization=false`.

It must not claim email delivery/read, booking, approval, payment, engagement start, or testing authorization.

## Storage source candidate

`@vercel/blob@2.8.0` is exact-locked as a later staging candidate.

The provider adapter is source-only in P1G1R1:

- private access;
- deterministic pathname;
- random suffix disabled;
- overwrite disabled;
- reads use `useCache:false` for reconciliation freshness.

Only the in-memory/fake store is exercised by deterministic tests. Real provider write count for P1G1R1 is zero.

## Security boundary

The implementation models:

- POST-only submission;
- JSON-only content type;
- bounded body size;
- server-side schema checks;
- obvious secret-pattern blocking before persistence;
- same-origin browser policy;
- inert untrusted submitted text;
- no HTML/Markdown/agent/tool execution from intake data;
- `Cache-Control:no-store` and `X-Robots-Tag:noindex` responses;
- no CRM, webhook or email fan-out.

The secret-pattern filter is a safety layer, not a confidentiality guarantee. Users are still instructed not to enter secrets.

## Client boundary

Both EN and RU intake pages reference the controller source, but `UI_ENABLED=false` prevents UI creation and network transmission.

The controller already models future behavior:

- generated local brief first;
- explicit data boundary;
- explicit consent;
- separate final submit gesture;
- one `client_submission_id` across retries;
- serialized in-flight submission;
- SUCCESS / FAILED / UNKNOWN_RECONCILE separation;
- EN/RU field and enum mapping;
- manual copy/download/contact fallback remains available.

## Current provider proof limitation

During P1G1R1 preparation the Vercel Hobby project reported:

`Deployment rate limited — retry in 24 hours.`

A GitHub-core-green native function canary therefore did not receive a Vercel provider build. This is neither a source failure nor provider PASS.

Until a normal fresh Vercel preview runs successfully, terminal evidence must state:

`VERCEL_PROVIDER_PROOF=BLOCKED_RATE_LIMIT`

No manual deploy, plan upgrade, spend or bypass is authorized by P1G1R1.

## Explicit non-effects

P1G1R1 does not authorize or perform:

- production merge/deploy;
- production/preview runtime enablement;
- Blob/database provisioning;
- provider credential or secret reads/exports;
- provider storage writes, including synthetic writes;
- WAF/firewall publication;
- Cloudflare runtime endpoint implementation;
- real form submission;
- email/CRM/webhook/Slack/Telegram effects;
- testing authorization;
- payment/booking;
- Site Agent activation.

## Terminal source target

`PR49 = DRAFT / UNMERGED`

`ASTRO_STATIC_DIST_CONTRACT = PRESERVED`

`CLOUDFLARE_PROVIDER_PATH = UNCHANGED`

`RUNTIME_DEFAULT = DISABLED`

`UI_DEFAULT = DISABLED`

`REAL_STORAGE = UNPROVISIONED`

`PROVIDER_WRITE_COUNT = 0`

`PRODUCTION = UNCHANGED`

A separate P1G2 staging gate is required before any provider storage provisioning, connected synthetic write, runtime enablement or rate-limit enforcement test.
