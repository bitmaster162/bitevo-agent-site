# Scope Handoff R1 — Production Readiness P24

Status: `P24_SOURCE_MERGED_DEPLOYED / DEFAULT_OFF / NO_RUNTIME_EFFECT`

Base source: `57ffe15e43e578aec611af8486b6bf328dad221b`

This phase prepared the existing bounded Scope Handoff R1 for a future production activation without activating it. The source was later pushed, reviewed in PR #158, merged normally, and deployed automatically with the site. That source deployment did not authorize Vercel environment changes, Blob writes, live browser POSTs, feature activation, promotion, or customer-facing transmission.

## Gap closed

The prior source could accept an intake into private Blob storage only in an isolated staging preview. Production could not activate, and a successful storage receipt did not prove that an operator had a durable review path.

P24 separates four states:
- request stored privately;
- request queued for operator review;
- human review still unconfirmed;
- testing authorization remains false.

## Production activation profile

Future production activation mode:

`production_scope_review_r1`

It is bound to the exact Vercel production project and requires all of:
- Vercel runtime marker;
- exact production project ID;
- `VERCEL_ENV=production`;
- `VERCEL_TARGET_ENV=production`;
- exact production activation mode;
- explicit runtime switch;
- explicit UI switch for browser exposure;
- explicit operator-review switch;
- an operator-review bearer token with no committed value;
- an explicitly named storage owner supplied by operator configuration;
- an explicit positive integer retention-days value.

Missing or malformed prerequisites fail closed before provider I/O.

`PRODUCTION_ENABLE = NOT_AUTHORIZED`

## Operator review delivery

A production-style acceptance is valid only after:
1. the immutable scope record exists in private storage; and
2. a digest-bound entry exists in the private pending-review queue.

The public receipt may state:
- `storage_status=STORED_PRIVATE`;
- `operator_delivery_status=QUEUED_FOR_HUMAN_REVIEW`;
- `human_review_status=NOT_CONFIRMED`.

Queue delivery is not a claim that a person read, accepted, approved, scheduled, paid for, or started the engagement.

`HUMAN_REVIEW = NOT_CONFIRMED`

The operator endpoint is not linked from the public site. It requires an exact bearer token before any provider read.

## Retention and deletion

The production retention/data-owner decision is not provenance-confirmed. In the source conversation on 2026-09-26, the 30-day / Robert-owner values were proposed by the assistant; the retrieved user reply was only `го`. Robert did not independently state `30 days` or name himself as the accountable storage owner in the retrieved conversation evidence.

`RETENTION_DAYS = OPERATOR_CONFIG_REQUIRED`

`STORAGE_OWNER = OPERATOR_CONFIG_REQUIRED`

`PRIVACY_CONTACT = robert@bitevo.work`

`ROBERT_DECISION_PENDING`

The source-level values `30` days and `Robert Dumanyan, Founder, BitEvo` remain implementation proposals for existing fail-closed comparisons; they are not recorded here as an owner-authored decision. Production runtime/UI still require explicit operator configuration for `SCOPE_HANDOFF_R1_STORAGE_OWNER` and `SCOPE_HANDOFF_R1_RETENTION_DAYS`, and any missing or mismatched value fails closed before provider I/O.

The authenticated operator endpoint supports bounded deletion for:
- `retention_expired`;
- `privacy_request`.

A privacy deletion request does not wait for the configured retention horizon. Automatic expiry cleanup remains implemented as a daily Vercel cron source at `/api/scope-handoff-retention`, scheduled for `0 3 * * *`, authenticated by `CRON_SECRET`, and bound to the exact production project plus configured owner/retention values.

`AUTO_PURGE_SOURCE = PRESENT`

This source addition does not enable Scope Handoff runtime or UI. Production activation remains separately gated.

## Manual fallback

Copy, download, and `mailto:robert@bitevo.work` remain available. Generating the local brief never posts automatically. An enabled online handoff still requires a separate consent and an explicit final submit action.

## P24 factual effects and non-effects

Source delivery history:
- Feature branch push: occurred once for the P24 production-readiness candidate at head `781a6f8b7aaa71f1ddf19f2059547b533e037166`.
- Pull request: PR #158.
- Normal merge: `4300657ee025e2cf65912302606c1daf548982a4`.
- Production source deployment: occurred automatically after the merge; Vercel production reached READY on the exact merge SHA.
- Manual deploy: 0.
- Branch deletion: 0.

Runtime / data effects remain absent:
- Production environment mutation: 0.
- Production activation: 0.
- Vercel Blob write/read/delete caused by P24 validation: 0.
- Live browser POST caused by P24 validation: 0.
- Customer email or notification: 0.
- Production provider I/O from the disabled handoff path: 0.

Live verification on 2026-09-26 returned `503 SERVICE_DISABLED` from `/api/scope-handoff` with `provider_io=0` and `testing_authorization=false`. Source presence in production is therefore not evidence of feature activation.

## Terminal

`P24_SOURCE_MERGED_DEPLOYED / DEFAULT_OFF / OPERATOR_QUEUE_BOUND / ROBERT_DECISION_PENDING / AUTO_PURGE_SOURCE_PRESENT / PRODUCTION_ENABLE_NOT_AUTHORIZED`
