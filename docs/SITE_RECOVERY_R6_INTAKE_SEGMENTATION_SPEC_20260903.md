# Site Recovery R6 — Intake Segmentation

Date: 2026-09-03 Asia/Bangkok
Baseline: protected `main` exact `875b4ef5345953ff83f5202ab37f750ba4a2340e` (Site Recovery R5 merged/live)
Mode: branch/draft-PR implementation only; no production merge/deploy from this spec.

## Problem

The full Decision Scope Intake is appropriate for Primary Audit depth, but it is too heavy as the universal first contact. Historical cross-agent review converged on progressive disclosure while preserving the existing privacy boundary and manual handoff.

## R6 decision

Both `/audit-intake` and `/ru/audit-intake` expose two explicit local depths:

- **Entry** — default reduced first step. Captures owner decision, company/contact/role, workflow, critical external action, target binding, authority owner, expensive-error consequence, environment and secret confirmation.
- **Primary** — explicit expansion to the existing full Authority Ledger + Evidence Contract + Rules of Engagement + data/secret-boundary fields.

Entry does not delete Primary fields or invent a separate backend. Switching depth only changes browser-local visibility and required-state.

## Privacy and authority boundary

- No form `action` or `method` is added.
- No `fetch`, XHR, sendBeacon, WebSocket or FormData network path is added.
- No automatic email, Telegram or CRM transfer is added.
- Generated scope content is never embedded into the Contact Robert `mailto` body.
- Copy/download remain browser-local.
- Contact Robert remains a manual subject-only handoff.
- Scope review is explicitly not testing authorization.
- Written Rules of Engagement remain required before testing.
- No secrets/credentials/customer data are requested through a public transmission path.

## Output semantics

The existing deterministic brief generator remains the source of the local text artifact. R6 adds an `INTAKE DEPTH: ENTRY|PRIMARY` marker so a reviewer can distinguish a reduced first-step brief from a full Primary-preparation brief. Deferred Primary-only fields remain visibly unfilled rather than silently inferred.

## Regression gate

`verify-intake-segmentation.mjs` fails the build unless both locales retain:

1. Entry and Primary controls;
2. Entry as the default depth;
3. multiple progressive-disclosure blocks;
4. explicit Primary-only required-field activation;
5. the first-party local controller;
6. manual Contact Robert handoff without generated body embedding;
7. explicit no-testing-authorization text;
8. no form action/method;
9. no Telegram transfer;
10. no network primitives in the depth controller.

## Non-goals

R6 does not:

- change Free / $1,500 Entry / $4,900 Primary pricing;
- create a new SKU;
- create server-side intake storage;
- add analytics;
- change test authorization policy;
- auto-send a generated scope;
- modify Mapper/Workspace schemas;
- claim that Entry depth is sufficient for every audit.

## Terminal merge-prep state

R6 may become `GREEN / READY_FOR_EXACT_MERGE_GATE` only when the exact branch head is based on the exact current protected main, GitHub required checks are green, provider preview is READY, all existing R1-R5 gates remain green, the new intake-segmentation gate passes, and live preview readback confirms Entry default + Primary expansion on both locales without any new transmission path.
