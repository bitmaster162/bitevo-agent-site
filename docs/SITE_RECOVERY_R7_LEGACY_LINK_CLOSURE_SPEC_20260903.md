# Site Recovery R7 — Legacy Link Closure + Concierge Current-Funnel Reconciliation

Date: 2026-09-03 Asia/Bangkok
Baseline: protected `main` exact `021eda7a5bf3787b69eefc05e44212360e9b765d` (Site Recovery R6 merged/live)
Mode: source/draft-PR implementation only; no production merge or deploy from this spec.

## Why R7 exists

R4 established a canonical route registry and correctly classified `/assurance`, `/ai-audit`, `/intake`, `/inner-circle`, and `/crypto-risk-desk` as `LEGACY`. It also classified `/concierge` as `INTERNAL_NO_INDEX` with parent `/start` and explicitly deferred Site Agent restore.

After R6, a source readback found a concrete graph inconsistency: the live source for `/concierge` still links to legacy `/assurance` through its `System Assurance` CTA even though the registry says `/concierge` belongs under `/start` and `/assurance` is no longer canonical.

The existing route-taxonomy gate checks selected known backlinks but does not scan the complete built HTML graph for non-legacy -> legacy links. That gap allowed the stale Concierge link to survive R4-R6 while all current gates remained green.

## R7 decision

1. Add a deterministic build gate that scans every built HTML page for internal `href` targets resolving to routes classified `LEGACY` in the canonical route registry.
2. Fail when any source page whose own category is not `LEGACY` links to a legacy route.
3. Keep legacy pages available according to their R4 transition/archive decisions; R7 does not delete them.
4. Reconcile `/concierge` with the current funnel by replacing the stale `/assurance` CTA with `/start`.
5. Keep `/concierge` `noindex,nofollow`, local-only and human-review-only.
6. Do not connect an intake backend, CRM, email sender, scheduler, analytics or Site Agent runtime in R7.

## Legacy-link closure rule

Canonical invariant:

`NON_LEGACY_SURFACE -> LEGACY_ROUTE = FORBIDDEN`

Legacy/archive pages may preserve historical references when needed for provenance. Current flagship, entry, specialist, tool, proof, research, context and internal-noindex surfaces must not send users into a superseded commercial/alias/archive route.

The gate derives legacy destinations from `src/data/public-route-registry.json`; it must not maintain a second hard-coded legacy list.

## Concierge boundary

R7 does not promote Concierge into the current buyer funnel. It only makes the existing isolated tool internally coherent:

- `robots=noindex,nofollow` retained;
- local browser brief retained;
- no `form action` or network submission path added;
- no CRM write;
- no automatic message;
- no scheduling/payment/deployment authority;
- current CTA hierarchy becomes `/start`, `/agent-authority-audit`, `/audit-intake`.

A future Site Agent / connected concierge remains a separate decision and requires independent evidence and effect authority.

## Regression gate

`verify-legacy-link-closure.mjs` must:

1. read the canonical route registry;
2. derive every `LEGACY` target;
3. recursively scan every built `.html` file;
4. normalize internal href destinations before comparison;
5. fail on every non-legacy -> legacy href;
6. report source route, source category and legacy target;
7. remain independent of sitemap/indexability checks so graph drift cannot hide behind noindex state.

## Non-goals

- no new SKU or repricing;
- no deletion of legacy/archive routes;
- no new redirect beyond existing R4 policy;
- no Concierge indexing/promotion;
- no Site Agent restore;
- no backend intake destination;
- no analytics or metadata lead tracking;
- no email/Telegram/CRM/send effect;
- no production merge/deploy under generic approval.

## Green condition

R7 may become `GREEN / READY_FOR_EXACT_MERGE_GATE` only when:

- exact branch head is based on current protected main;
- the new full-graph legacy-link gate passes with zero non-legacy -> legacy links;
- `/concierge` no longer links to `/assurance` and instead exposes current `/start` routing;
- Concierge local-only/noindex/no-send boundaries remain intact;
- all R1-R6 gates remain green;
- provider preview is READY;
- production effect remains zero until a separate exact merge gate.
