# BitEvo Scope Handoff R1 — implementation source boundary

Status: `P1G1_MERGED / P1G2_STAGING_PROVEN / P1G3_MERGED_STAGING_PROVEN / PRODUCTION_RUNTIME_DISABLED / PRODUCTION_STORAGE_UNPROVISIONED`

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

The native function evaluates a shared activation boundary before constructing a limiter or storage adapter. Runtime activation requires all of the following exact conditions:

- Vercel system marker `VERCEL=1`;
- project ID `prj_zQ1Mb8RJA6zCrZbPfC2z3dWFcfZI`;
- `VERCEL_ENV=preview`;
- `VERCEL_TARGET_ENV=preview`;
- `SCOPE_HANDOFF_R1_ACTIVATION_MODE=staging_preview_r1`;
- `SCOPE_HANDOFF_R1_ENABLED=true`.

Any missing, malformed, production, wrong-project or wrong-mode value returns:

- HTTP `503`;
- `status=SERVICE_DISABLED`;
- `provider_io=0`;
- `testing_authorization=false`.

The browser controller remains default-off through `UI_DEFAULT_ENABLED=false`. It can derive an enabled state only from a frozen build-generated activation record that satisfies the same exact staging-project and preview boundary, confirms runtime enablement, and additionally records `SCOPE_HANDOFF_R1_UI_ENABLED=true`. Without that record the source performs no DOM mount and initiates no network request.

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

Both EN and RU intake pages load the generated activation bootstrap before the controller. The default bootstrap is disabled; only an exact frozen staging-preview record can enable the controller, while every absent, partial, wrong-project or production record prevents UI creation and network transmission.

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

## Post-PR50 reconciliation boundary

The provider-limitation section below is historical evidence for pre-reconciliation head `5bb5ed81f78609819d4799eb1d00e36ff9072205` only.

The authorized reconciliation merges protected main `cddcb79a1a041184a9dc5e142ece1b0e2b0cf78e` into the PR49 branch without history rewrite. The resulting source must retain:

- Astro `7.2.10` exact;
- Node `>=22.19.0`;
- esbuild `0.28.1` exact;
- `@vercel/blob` `2.8.0` exact;
- no `@astrojs/vercel` adapter;
- static Astro output and the reviewed CSP/minification bridge;
- runtime and UI disabled by default;
- zero real storage writes and no storage provisioning.

Fresh GitHub, Vercel and Cloudflare evidence for the reconciled head supersedes the historical rate-limit status below. No merge, runtime enablement or storage provisioning is implied by reconciliation.

## Current provider proof limitation

During P1G1R1 preparation the Vercel Hobby project reported:

`Deployment rate limited — retry in 24 hours.`

A GitHub-core-green native function canary therefore did not receive a Vercel provider build. This is neither a source failure nor provider PASS.

Until a normal fresh Vercel preview runs successfully, terminal evidence must state:

`VERCEL_PROVIDER_PROOF=BLOCKED_RATE_LIMIT`

No manual deploy, plan upgrade, spend or bypass is authorized by P1G1R1.

## P1G3 source boundary

P1G1 source is merged and P1G2 staging evidence is closed. P1G3 adds a source-only global admission circuit breaker before intake body parsing and persistence. It does not activate production runtime or storage.

The required runtime configuration is:

- `SCOPE_HANDOFF_R1_RATE_LIMIT_MODE=blob_global_fixed_window_v1`;
- positive safe-integer `SCOPE_HANDOFF_R1_RATE_LIMIT_MAX_REQUESTS`;
- positive safe-integer `SCOPE_HANDOFF_R1_RATE_LIMIT_WINDOW_SECONDS`.

Missing or malformed configuration returns `503 RATE_LIMIT_CONFIG_INVALID` before intake-store I/O. Production traffic values remain unset and require a later evidence-backed owner decision.

The limiter uses one private object at `scope-handoff/r1-rate-limit/global.json` with schema `bitevo.scope-handoff.rate-limit.v1`. It stores only fixed-window timing, count, configuration digest, update time and a random mutation reconciliation marker. It stores no IP, contact data, request payload or `client_submission_id`.

Origin reads use `useCache:false`. First creation is create-if-absent; increments and rollover use ETag `ifMatch` CAS. Known conflicts retry within the fixed code budget. Uncertain writes are never blindly repeated: a fresh read may confirm the exact random mutation marker, otherwise the request fails closed with `503 RATE_LIMIT_UNKNOWN_RECONCILE`. At capacity, the endpoint returns `429 RATE_LIMITED` with authoritative `Retry-After` and performs no intake-store I/O.

Cheap method, origin, content-type and declared-size checks remain ahead of the limiter. Malformed JSON, schema-invalid and secret-pattern bodies consume admission capacity by design because the limiter protects the expensive body and persistence path.

P1G3 source verification remains deterministic and fake-provider-only. Real private-Blob CAS behavior was separately proven in isolated staging; production runtime enablement, production storage connection, production threshold selection and traffic calibration remain separately gated.

## P1G5 preview-only activation boundary

P1G5 introduces a shared source-level activation evaluator for both the Vercel function and the EN/RU browser controller. The evaluator is fail-closed and hard-binds activation to the isolated staging project `prj_zQ1Mb8RJA6zCrZbPfC2z3dWFcfZI` in the Vercel `preview` environment and target only.

A build generator writes a small ignored browser bootstrap before Astro builds. The bootstrap contains only normalized activation metadata and booleans; it does not copy arbitrary environment values, credentials, Blob tokens or request data into the browser. The controller accepts only a frozen record with the exact schema, activation mode, staging project ID, preview environment, runtime-enabled state, UI-enabled state and `testing_authorization=false`.

The server runtime independently evaluates the same system and explicit flags. Client-side activation is not treated as a security boundary: a browser-modified UI cannot bypass the server's exact project/preview/runtime gate, rate limiter, schema checks or storage reconciliation.

Source and deterministic tests may model the enabled path with fake environments and fake network providers. Creating or changing provider environment variables, connecting Blob, making browser POST requests, merging, deploying to production or choosing production traffic thresholds remains separately gated.
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

`P1G1 = MERGED`

`P1G2 = STAGING_PROVEN / DISABLED_EMPTY`

`P1G3 = MERGED / REAL_BLOB_CAS_STAGING_PROVEN / PRODUCTION_RUNTIME_DISABLED`

`P1G4 = MERGED / DEFAULT_OFF_EN_RU_UI_TRANSPORT`

`P1G5_ACTIVATION_BOUNDARY = EXACT_STAGING_PROJECT / PREVIEW_ONLY / EXPLICIT_RUNTIME_AND_UI_FLAGS`

`ASTRO_STATIC_DIST_CONTRACT = PRESERVED`

`CLOUDFLARE_PROVIDER_PATH = UNCHANGED`

`PRODUCTION_RUNTIME_DEFAULT = DISABLED`

`UI_DEFAULT = DISABLED`

`PRODUCTION_STORAGE = UNPROVISIONED`

`SOURCE_VALIDATION_PROVIDER_WRITE_COUNT = 0`

P1G3 provider validation is complete in isolated staging. Production runtime enablement, production UI transport enablement, production Blob connection or writes, and production threshold selection remain separately gated and require exact calibrated values plus rollback conditions.
