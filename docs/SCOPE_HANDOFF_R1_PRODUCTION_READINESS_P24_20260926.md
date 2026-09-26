# Scope Handoff R1 — Production Readiness P24

Status: `P24_SOURCE_CANDIDATE / DEFAULT_OFF / NO_PRODUCTION_EFFECT`

Base source: `57ffe15e43e578aec611af8486b6bf328dad221b`

This phase prepares the existing bounded Scope Handoff R1 for a future production activation without activating it. It does not authorize Vercel environment changes, Blob writes, live browser POSTs, deployment, promotion, or customer-facing transmission.

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

P24 deliberately does not choose a universal retention threshold.

`RETENTION_DAYS = OPERATOR_CONFIG_REQUIRED`

`STORAGE_OWNER = OPERATOR_CONFIG_REQUIRED`

A future production environment must provide `SCOPE_HANDOFF_R1_STORAGE_OWNER` as a named accountable owner and `SCOPE_HANDOFF_R1_RETENTION_DAYS` as an explicit positive integer before runtime or UI can enable. The accepted record and review queue carry the resulting retention horizon.

The authenticated operator endpoint supports bounded deletion only for:
- `retention_expired`;
- `privacy_request`.

No automatic deletion scheduler is claimed in P24. No deletion occurs in this phase.

## Manual fallback

Copy, download, and `mailto:robert@bitevo.work` remain available. Generating the local brief never posts automatically. An enabled online handoff still requires a separate consent and an explicit final submit action.

## P24 non-effects

- Production source deployment: 0
- Production environment mutation: 0
- Production activation: 0
- Vercel Blob write/read/delete caused by P24 validation: 0
- Live browser POST: 0
- Customer email or notification: 0
- Feature push: 0
- Pull request: 0
- Merge: 0
- Manual deploy: 0
- Branch deletion: 0

## Terminal

`P24_SOURCE_CANDIDATE / DEFAULT_OFF / OPERATOR_QUEUE_BOUND / RETENTION_CONFIG_REQUIRED / PRODUCTION_ENABLE_NOT_AUTHORIZED`
