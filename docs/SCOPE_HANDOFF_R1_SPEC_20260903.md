# BitEvo P1 — Scope Handoff R1 Specification

Date: 2026-09-03
Baseline: protected production `main` at `d80faf01d48e957f363fd721a157199902b507f5` (Site Recovery R7)
Status: `SPEC_ONLY / NO_ENDPOINT / NO_PRODUCTION_EFFECT`

## 1. Product objective

Reduce the highest-friction step between a buyer generating a local BitEvo scope brief and explicitly asking BitEvo to review that scope.

Current safe flow remains:

`/start -> /audit-intake or /ru/audit-intake -> generate local brief -> copy/download -> manual business-channel handoff`

P1 R1 proposes a future additional path:

`generate local brief -> explicit user click Submit scope for review -> bounded first-party intake endpoint -> explicit server receipt`

This specification does **not** implement that endpoint, does not alter the public intake pages, and does not transmit any data.

## 2. Authority boundary

A scope submission is a request for **scope review only**.

It MUST NOT:

- authorize testing;
- authorize production access;
- authorize account access;
- authorize deployment, mutation, send, payment or booking;
- create Rules of Engagement;
- create a customer commitment;
- start autonomous follow-up;
- imply that an email was delivered;
- imply that Robert or another human has read or accepted the scope.

The client payload MUST carry:

- `submission_intent = scope_review_only`;
- `testing_authorization = false`;
- `secret_confirmation = true`;
- `consent_scope_review = true`.

The server receipt MUST restate that testing authorization is not granted.

## 3. Explicit user action

Transmission is allowed only after all of the following are true:

1. the local brief has been generated successfully;
2. the user sees a separate final handoff control;
3. the user sees the exact data boundary and scope-review-only statement;
4. the user explicitly checks/affirms consent to submit the scope for review;
5. the user explicitly clicks the final `Submit scope for review` action.

The future implementation MUST NOT transmit on:

- page load;
- field input/change;
- Entry/Primary mode selection;
- mapper handoff load;
- brief generation;
- copy;
- download;
- opening the manual `mailto:` fallback.

## 4. Data-minimization contract

Canonical request schema: `src/data/scope-handoff-r1.schema.json`.

The request is structured fields only. `additionalProperties` MUST remain false.

The future client MUST NOT submit:

- the rendered/generated brief as a second raw text blob;
- sessionStorage/localStorage contents;
- mapper raw JSON;
- cookies;
- browser fingerprint attributes;
- referrer history beyond ordinary HTTP metadata handled by infrastructure;
- credentials;
- passwords;
- API keys;
- OAuth tokens;
- private keys;
- wallet seeds;
- production secrets;
- customer secrets;
- uploaded files in R1.

The purpose of the request is to transfer only the scope facts the buyer intentionally entered into the current BitEvo intake.

## 5. Entry payload

Entry mode requires the common envelope plus these scope fields:

- company;
- business contact;
- role;
- owner decision;
- workflow description;
- critical external action;
- target object / binding;
- authority owner;
- most expensive plausible error;
- environment.

No Primary-only fields are required for Entry.

## 6. Primary payload

Primary mode includes all Entry fields plus the current deeper scope fields:

- access approver;
- external systems/tools;
- forbidden effects;
- pre-action evidence;
- freshness/validity rule;
- object-binding evidence;
- external confirmation;
- missing-evidence behavior;
- staging/test availability;
- safe replay availability;
- allowed tests;
- prohibited audit actions;
- data classification;
- minimum necessary data;
- secret-handling boundary.

Primary depth still does not authorize testing.

## 7. Idempotency and duplicate submission

The client MUST generate one `client_submission_id` before the explicit submit request.

The future endpoint MUST implement idempotency keyed by that identifier plus a bounded request digest.

Required semantics:

- exact retry of the same accepted submission returns the same server `submission_id` and does not create a second intake record;
- same `client_submission_id` with materially different payload fails closed as an idempotency conflict;
- an uncertain client response must not cause automatic blind re-submit loops;
- user-initiated retry must preserve the same idempotency key until the final state is reconciled.

## 8. Receipt semantics / False Green boundary

A successful response may state only that the bounded first-party intake endpoint accepted the scope record.

Proposed receipt fields:

- `submission_id` — opaque server-generated identifier;
- `client_submission_id` — echoed idempotency identifier;
- `schema_version` — exact accepted schema version;
- `accepted_at` — server timestamp;
- `status = RECEIVED_FOR_SCOPE_REVIEW`;
- `testing_authorization = false`;
- `human_review_status = NOT_CONFIRMED`;
- `delivery_status = INTAKE_RECORD_ACCEPTED`.

The UI MUST NOT translate this into `sent`, `delivered`, `read`, `booked`, `approved`, `engagement started` or equivalent claims.

Any ambiguous server/network state is `UNKNOWN / RECONCILE`, not success.

## 9. Failure behavior

Future implementation must fail closed for:

- invalid schema;
- unexpected field;
- missing explicit consent;
- `testing_authorization != false`;
- failed secret-content guard;
- oversized payload;
- invalid locale/depth;
- idempotency conflict;
- destination unavailable;
- storage/receipt uncertainty;
- rate-limit/abuse rejection.

On failure, local copy/download/manual contact fallback remains available.

## 10. Abuse and privacy boundary

R1 is intended for a public anonymous business intake, so the later endpoint requires:

- bounded request size;
- rate limiting;
- same-origin/CORS policy review;
- CSRF/origin strategy appropriate to the final architecture;
- no executable rendering of submitted text;
- output escaping;
- log minimization;
- explicit retention policy before production;
- no advertising/fingerprinting use;
- no hidden CRM fan-out;
- no automated sales email.

## 11. EN/RU parity

The future public handoff must exist with semantically equivalent authority/privacy boundaries on both:

- `/audit-intake`;
- `/ru/audit-intake`.

User-facing language can be localized, but payload semantics, consent, receipt meaning, failure meaning and no-testing boundary must be identical.

## 12. Manual fallback preservation

Current browser-local behavior remains a required fallback:

- local brief generation;
- copy;
- download;
- manual business-channel handoff.

P1 must not make the site unusable when the endpoint is unavailable.

## 13. R1 non-goals

Not in P1 R1:

- CRM integration/fan-out;
- automatic email sending;
- automatic reply drafting;
- Site Agent / Concierge activation;
- scheduling;
- payments;
- file uploads;
- customer portal/account creation;
- testing workflow execution;
- Rules-of-Engagement approval;
- analytics beyond a separately approved P2 event schema.

## 14. Merge/deployment gate for a later implementation

Before any endpoint implementation may be merged, evidence must show:

- exact request schema and field mapping;
- exact destination/storage owner;
- explicit consent UI;
- no-secret handling;
- idempotency behavior;
- duplicate/replay tests;
- unknown-state / false-green tests;
- abuse/rate-limit handling;
- EN/RU semantic parity;
- privacy and retention decision;
- CSP/security review;
- production receipt semantics;
- deterministic local fallback.

A separate explicit merge/deployment authorization is required.

## Terminal

`P1_SCOPE_HANDOFF_R1 = SPEC_ONLY / ENDPOINT_NOT_IMPLEMENTED / PRODUCTION_UNCHANGED / ZERO_EXTERNAL_EFFECT`
