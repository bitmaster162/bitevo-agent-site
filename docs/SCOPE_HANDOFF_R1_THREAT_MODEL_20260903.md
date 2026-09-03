# BitEvo P1 — Scope Handoff R1 Threat Model

Date: 2026-09-03
Baseline: R7 production `d80faf01d48e957f363fd721a157199902b507f5`
Status: `DESIGN_EVIDENCE_ONLY / NO_ENDPOINT / NO_RUNTIME_EFFECT`

## Security objective

Allow one explicit buyer-initiated scope-review submission without weakening BitEvo's current authority, privacy, false-green or no-secret boundaries.

## Assets

- buyer-entered scope facts;
- business contact identity;
- BitEvo intake integrity;
- server receipt integrity;
- idempotency state;
- production availability;
- authority wording and no-testing boundary.

## Trust boundaries

1. Browser-local intake state.
2. Explicit user submit gesture.
3. Future same-origin public intake endpoint.
4. Future bounded intake storage/queue.
5. Human review by Robert/BitEvo.

Only boundaries 1–2 exist in the current production baseline. Boundaries 3–5 are design targets, not implemented by this branch.

## T1 — Secret submission

Risk: a buyer pastes credentials, tokens, private keys, wallet seeds, production secrets or customer secrets into free-text scope fields.

Required controls:

- preserve current prominent no-secret warning;
- explicit secret confirmation remains required;
- future client/server secret-pattern guard as a blocking safety layer, not as a guarantee;
- reject obvious credential/private-key patterns before persistence;
- do not log rejected payload content;
- no file upload in R1;
- document that buyers must describe access boundaries rather than paste secrets.

Residual risk: arbitrary confidential prose cannot be perfectly classified. Therefore storage/retention must still assume business-confidential scope data may arrive.

## T2 — Duplicate submit / double click

Risk: UI double click, browser retry or user uncertainty creates two lead records.

Required controls:

- one client_submission_id generated before first send;
- disable/serialize active submit UI while request is in flight;
- server idempotency keyed to client_submission_id plus payload digest;
- exact retry returns same submission_id;
- conflicting reuse fails closed;
- no downstream duplicate fan-out in R1.

## T3 — Replay after uncertain response

Risk: server accepts a record but network response is lost; browser retries and UI creates false duplicate or false failure.

Required controls:

- UNKNOWN state distinct from FAILED;
- retry reuses same idempotency key;
- server can reconcile existing accepted record;
- receipt is returned only from authoritative intake state;
- never mint a new id automatically to escape uncertainty.

## T4 — False Green receipt

Risk: UI says sent/delivered/read/approved when only a local request or partial server operation occurred.

Required controls:

- server-generated opaque submission_id;
- `status=RECEIVED_FOR_SCOPE_REVIEW` only after authoritative acceptance;
- `delivery_status=INTAKE_RECORD_ACCEPTED`;
- `human_review_status=NOT_CONFIRMED`;
- `testing_authorization=false`;
- network 2xx alone is insufficient unless response passes exact receipt schema;
- ambiguous/malformed receipt => UNKNOWN / RECONCILE.

## T5 — Authority escalation by text or client tampering

Risk: client changes request to claim testing permission, engagement approval or privileged workflow state.

Required controls:

- schema includes `testing_authorization` with constant false;
- `submission_intent` constant `scope_review_only`;
- server ignores/rejects any unknown fields;
- no client-provided `approved`, `paid`, `booked`, `authorized`, `engagement_status` or similar fields;
- human scope review and written RoE remain separate systems/states.

## T6 — Oversharing / schema creep

Risk: implementation sends generated brief blob, session storage, mapper raw JSON, analytics identifiers or browser fingerprint data because it is convenient.

Required controls:

- additionalProperties=false;
- named allowlist only;
- no `brief`, `raw_brief`, `mapper`, `session`, `local_storage`, `cookie`, fingerprint or analytics payload fields;
- future code review gate checks exact field mapping;
- P2 analytics is separate and content-free.

## T7 — Injection / stored content execution

Risk: submitted free text contains HTML, scripts, Markdown links, prompt injection or control text that later executes in an admin view or agent workflow.

Required controls:

- treat every field as inert untrusted text;
- no HTML rendering of submitted content without escaping;
- no automatic tool execution based on intake text;
- owner copilot, if later implemented, receives the data as untrusted customer input and has no external-effect capability in R1;
- bound field lengths.

## T8 — Spam / resource exhaustion

Risk: anonymous endpoint is abused for spam or large-volume writes.

Required controls before production:

- request body size limit;
- per-origin/IP/edge rate limit appropriate to infrastructure;
- bounded field lengths and count;
- no expensive downstream LLM/API call in the public submit path;
- no email fan-out in R1;
- reject malformed schema early.

## T9 — CSRF / cross-origin abuse

Risk: third-party site triggers submissions from a visitor browser.

Required controls depend on final endpoint architecture and must be proven before merge:

- same-origin request policy where feasible;
- strict CORS allowlist;
- origin/referer validation where appropriate;
- CSRF token or equivalent if cookie-authenticated state is introduced later;
- R1 must not rely on ambient authenticated customer credentials.

## T10 — PII/privacy over-retention

Risk: business contact and detailed scope remain stored indefinitely or leak into broad logs/analytics.

Required controls before production:

- named storage owner;
- documented retention period;
- deletion/reconciliation procedure;
- no payload contents in analytics;
- log minimization/redaction;
- no advertising profile/fingerprint use;
- no hidden third-party processor added without explicit review.

## T11 — Destination compromise / fan-out drift

Risk: endpoint begins writing to multiple mailboxes/CRMs/webhooks without review.

R1 control:

- exactly one bounded BitEvo-controlled intake destination;
- no CRM fan-out;
- no autonomous email;
- no webhook fan-out;
- any new sink is a new effect boundary requiring separate review.

## T12 — EN/RU semantic drift

Risk: one locale implies booking, submission success, testing permission or different privacy behavior.

Required controls:

- identical payload schema;
- identical consent semantics;
- identical receipt state machine;
- identical no-testing boundary;
- locale only changes presentation text and `locale` field.

## T13 — Regression of local fallback

Risk: endpoint outage makes intake unusable or forces users to retry blindly.

Required controls:

- local generation remains first-class;
- copy/download remain available;
- manual business-channel fallback remains available;
- submit failure does not destroy local data/brief;
- endpoint availability is not required to inspect or export the scope locally.

## T14 — Automated downstream commitment

Risk: accepted lead automatically triggers an email, price quote, booking, payment request, CRM status, Site Agent workflow or testing action.

R1 control:

- prohibited;
- intake endpoint terminates at a bounded scope-review record;
- any owner-copilot later is internal draft/proposal only;
- all customer-facing external effects require separate human/effect authority.

## Test matrix required before implementation merge

1. valid Entry request accepted once;
2. valid Primary request accepted once;
3. unexpected field rejected;
4. missing consent rejected;
5. testing_authorization true rejected;
6. oversized field/body rejected;
7. obvious secret pattern rejected without payload logging;
8. double click produces one record;
9. exact retry returns same submission_id;
10. idempotency-key payload conflict rejected;
11. accepted-but-response-lost reconciliation returns same receipt;
12. malformed/partial receipt displays UNKNOWN, not success;
13. endpoint unavailable preserves local fallback;
14. cross-origin disallowed request rejected according to final architecture;
15. EN and RU produce semantically identical request/receipt behavior;
16. no email/CRM/payment/booking/testing side effect occurs on accepted submission.

## Terminal

`P1_SCOPE_HANDOFF_R1_THREAT_MODEL = COMPLETE_FOR_SPEC_PHASE / IMPLEMENTATION_NOT_AUTHORIZED`
