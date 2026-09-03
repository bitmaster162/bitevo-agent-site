# Site Recovery R5 — RU Semantic Parity

Date: 2026-09-03 Asia/Bangkok
Baseline: protected `main` exact `06bc4b007d82c78c24ba874e04d9b06f0ac9c9e6` (Site Recovery R4 merged/live)
Mode: branch/PR implementation only; no production merge/deploy from this spec.

## Problem

R4 established one canonical route registry and exposed 44 indexable English routes, but only 17 indexable Russian routes. The Russian shared chrome also still treated Mapper as the primary header CTA while English production had already moved the commercial front door to `/start`.

A site with 44 EN routes and 17 RU routes is not semantically bilingual. Adding a language switch only on the old subset would preserve a structural false green.

## R5 decision

R5 makes the canonical indexable route set fully paired:

- EN indexable routes: 44
- RU indexable routes: 44
- reciprocal locale pairs: 44
- pre-existing explicit RU pages: 17
- new generated RU semantic-parity pages: 27

The new RU surfaces preserve route purpose, decision boundary and public claim ceiling. They do not attempt sentence-for-sentence visual duplication and do not create new commercial claims.

## Implementation model

### 1. Canonical registry remains the authority

`src/data/public-route-registry.json` now contains a one-to-one RU route for every indexable EN route. Paired categories must match. The route registry remains the authority for sitemap/indexability.

### 2. Missing RU routes use one deterministic content registry

`src/data/ru-semantic-parity.json` contains the 27 missing semantic surfaces. Each record binds:

- paired EN route;
- route category;
- Russian title/description;
- at least three semantic points;
- localized next-decision route;
- explicit claim/authority boundary through the shared generator.

`src/pages/ru/[...slug].astro` statically generates only those 27 routes. It does not shadow the 17 pre-existing explicit RU pages.

### 3. Locale pairing is derived, not hand-maintained

`postprocess-public-build.mjs` derives all EN↔RU pairs directly from the canonical route registry. A missing pair or category mismatch fails the build before locale alternates/switches are emitted.

### 4. RU commercial front door becomes Start

The postprocessed RU shared header/mobile CTA moves from `/ru/mapper` to `/ru/start`, and the RU home primary commercial action becomes `/ru/start`. Mapper remains a visible product/tool path and remains the footer method CTA.

### 5. Research index no longer points RU users back to EN notes

`/ru/guides` now points to the four generated RU semantic-parity research notes while preserving the same reviewed-public-research claim ceiling.

## Claim boundary

R5 does not:

- create a new SKU or change canonical pricing;
- claim that RU copy is independent customer evidence;
- claim certification, legal advice or production-wide security;
- grant testing or production authorization;
- imply provider/runtime state from translated text;
- promote legacy or internal/noindex routes into the canonical pair set.

Generated parity pages explicitly state that localization does not expand authority, claims, pricing or testing authorization.

## Verification

### Existing gates strengthened

- `verify-route-taxonomy.mjs`: RU indexable count must equal EN indexable count.
- `verify-ru-surface.mjs`: all 44 pairs must exist in build output with canonical/alternate links, locale switches, Cyrillic content, build receipts and RU status bars.
- RU shared chrome must use `/ru/start` as the commercial front door.

### New independent gate

`verify-ru-semantic-parity.mjs` checks:

1. EN and RU canonical indexable counts are both 44;
2. every EN route resolves to the exact `/ru` pair;
3. paired categories match;
4. every pair exists in build output;
5. every pair has reciprocal `hreflang`, canonical and global locale switch metadata;
6. the 27 generated pages exactly equal the set of RU routes without explicit source files;
7. generated pages contain Cyrillic semantic content, paired EN link, localized next-decision path and explicit no-authorization claim boundary;
8. `/ru/start` preserves Free / $1,500 / $4,900 decision ladder markers;
9. RU home/shared chrome route to `/ru/start`.

## Terminal merge-prep state

R5 may become `GREEN / READY_FOR_EXACT_MERGE_GATE` only when:

- PR is based on the exact current protected main or is freshly reconciled after main drift;
- GitHub `quality-gate` and `main-history-audit` pass;
- exact-head provider preview is READY;
- provider-bound Vercel gate passes;
- no unexpected route, pricing, claim or legacy/indexability regression appears in diff/readback.

Production merge remains a separate exact authority event.
