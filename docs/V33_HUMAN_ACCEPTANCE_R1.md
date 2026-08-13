# BitEvo V3.3 — human acceptance checkpoint R1

Snapshot: 2026-08-14 02:17 Asia/Bangkok
Branch: `feat/v3-3-ux-ecosystem`
Pre-check head: `33d195ddfe44cc922eb85a1a7a92369846fcecdc`
Production baseline: `72218ed72dd4b8e8251139d01f3e4df49361a9b4`
Task class: HUMAN_PRODUCT_ACCEPTANCE / NO_MERGE / NO_PROMOTION

## Evidence rule

`SOURCE != BUILD != DEPLOYMENT != READBACK != HUMAN_ACCEPTANCE`

This checkpoint does not promote V3.3 to production and does not turn ancestor deployment evidence into exact-head deployment evidence.

## Current source delta that affects public UX

Against production V3.2, V3.3 changes the public user experience only through the build-time locale-switch layer in `scripts/postprocess-public-build.mjs`:

- 16 reciprocal EN/RU route pairs;
- 32 generated switch instances total;
- route-preserving current-page locale target;
- switch injected into shared header chrome before the primary CTA;
- footer receipt locale link also resolves to the paired route where one exists.

The large shared `src/layouts/Layout.astro` was not replaced. Direct mutation of that file was blocked by the OpenAI connector safety interlock, so the accepted implementation remains build-time postprocessing.

All other changes from production in this branch are documentation/evidence records plus the currently unreferenced `src/components/PairedLocaleSwitch.astro` helper.

## Deployment evidence boundary

The current V3.3 branch does not yet have a successful exact-head Vercel deployment because the Vercel Hobby account is build-rate-limited.

The nearest source-equivalent READY preview is `dpl_24q8sVzGtT2BGRMrXCo1URhY3rJA` at commit `3312a8b4b00a8b8789ca7e98b0da95a5e22489ea`.

The commits from `3312a8...` through the first acceptance checkpoint are documentation-only and do not alter public page source, CSS, layout, postprocessor or runtime code. Therefore `3312a8...` is valid as a **source-equivalent UI preview ancestor**, but not as an exact-head deployment receipt for a later head.

## Fresh production readback used for human review

Public production `https://bitevoagentsite.vercel.app/` and `/ru` both returned HTTP 200 during this checkpoint and identify build `72218ed72dd4b8e8251139d01f3e4df49361a9b4`.

### English product path

The English home currently presents a coherent funnel:

`Map one workflow -> See worked proof -> Turn gaps into scope`

It clearly states:

- authority/evidence/effect/recovery doctrine;
- browser-local mapping first;
- staging/test and written Rules of Engagement boundaries;
- synthetic proof is not customer proof;
- Primary Audit = `$4,900 fixed`;
- 5 working days only after complete evidence/access + written scope;
- no safety certification or universal guarantee.

The main human-acceptance problem on EN production is language discoverability: the header has no visible language control. RU currently appears only in the footer receipt. V3.3 directly addresses this.

### Russian product path

The Russian home already has a visible page-level locale bar immediately below the header:

`RU · PUBLIC PRODUCT LAYER ... Universe ... EN ->`

It also has localized header/navigation, Mapper, Workspace, Diagnostic, Intake, Audit, Pricing and the same bounded commercial/evidence doctrine.

## Human UX finding and decision: duplicate locale affordance

V3.3's global header switch is a real improvement because it makes language selection visible and route-preserving across all 16 paired surfaces.

On Russian surfaces the existing `.ru-locale-bar` also contains a legacy page-level `EN ->` link, so V3.3 can create two visible language controls.

Classification:

`HUMAN_UX_DUPLICATE_AFFORDANCE / NON_BLOCKING_FOR_BUILD / CLEANUP_REQUIRED_BEFORE_MERGE`

Human/product decision is now explicit:

`GLOBAL_HEADER_SWITCH = CANONICAL_LOCALE_CONTROL`

`RU_LOCALE_BAR_EN_LINK = REMOVE_WHEN_STANDARD_SOURCE_WRITE_IS_AVAILABLE`

The RU locale bar itself should remain because it also carries useful non-language context (`RU · PUBLIC PRODUCT LAYER` and the Universe shortcut). Only the redundant legacy EN link should be suppressed.

A normal `GitHub.update_file` attempt against `src/layouts/RuLayout.astro` was made after this decision and was blocked by the OpenAI connector safety interlock. No source change occurred and no alternate plumbing workaround was used.

Current status:

`LOCALE_UX_DECISION = CLOSED`

`LOCALE_UX_SOURCE_CLEANUP = BLOCKED_BY_CONNECTOR / NOT_APPLIED`

## Human acceptance matrix

| Dimension | Current finding | R1 disposition |
|---|---|---|
| Product clarity | Strong: one bounded Authority & Evidence Audit, clear doctrine and decision path | ACCEPT |
| EN navigation | Clear product funnel; language control currently too hidden in production | V3.3 IMPROVES |
| RU navigation | Strong localized product path | ACCEPT |
| Locale switching | V3.3 route-preserving architecture is correct; canonical switch decision closed | ACCEPT WITH SOURCE CLEANUP |
| Conversion | Primary CTA and scope boundary are coherent; no claim escalation required | ACCEPT |
| Proof/trust | Synthetic/dogfood/customer boundaries are explicit | ACCEPT |
| Commercial claims | `$4,900` and timing are bounded by complete evidence/access + written scope | ACCEPT |
| Mobile | Machine structure exists, but current exact-head visual inspection is not independently available | VISUAL CHECK REQUIRED |
| Desktop | Source-equivalent ancestor preview exists, but protected body visual readback is unavailable through connector | VISUAL CHECK REQUIRED |
| Build/deployment | GitHub gates green on checked heads; exact-current Vercel remains rate-limited | EXACT-HEAD DEPLOYMENT PENDING |

## R1 decision

`CONDITIONAL_HUMAN_ACCEPTANCE`

The V3.3 product direction is accepted as a merge candidate **only after** these remaining gates:

1. exact-current-head Vercel preview becomes READY when quota permits;
2. desktop visual review of EN and RU home + one nested EN/RU pair;
3. mobile visual review of the same surfaces;
4. standard source cleanup removes the redundant RU legacy EN link without deleting the RU status/Universe bar;
5. fresh exact-head Git/CI/readback reconciliation immediately before merge approval.

## No-action boundary

This checkpoint does not authorize:

- merge of PR #6;
- Vercel production promotion;
- DNS/domain/canonical-origin changes;
- billing/plan upgrade to obtain build capacity;
- deletion of legacy projects;
- outreach/payment changes;
- Arena/Grid runtime or trading effects.

`can_trade=false`
`capital_permission=DENY`
