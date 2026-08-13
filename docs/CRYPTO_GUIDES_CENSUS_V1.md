# Crypto Guides — canonical source/content census V1

Snapshot: 2026-08-13 16:26 UTC / 23:26 Asia-Bangkok
Parent program: BitEvo V3.3 ecosystem inventory
Task class: READ_ONLY_SOURCE + BUILD + PUBLIC_READBACK_AUDIT

## Invariant

`SOURCE != BUILD != PAGE_200 != CONTENT_TRUTH != CURRENTNESS`

This census does not change Crypto Guides source, production, aliases, DNS, public content, payment state, trading state, or external messaging.

## Canonical production identity

Repository: `bitmaster162/crypto-guides-site`

Current Git main:

`2b19db447318a3ddf0c856889d91d0e566deafa7`

Commit purpose: restore the July 7 generation with 162 guides before later taxonomy/category changes.

Canonical Vercel project:

`prj_COnJDL3H3VF6bQQolYXWMbR2UsiH` / `crypto_guides_site`

Current production deployment:

`dpl_8xyMj7faMfo67pVXXXs3RVRhjhC4`

Deployment state is `READY`, target=`production`, source=`git`, exact Git SHA=`2b19db447318a3ddf0c856889d91d0e566deafa7`.

Unlike Sovereign Arena, Crypto Guides has a clean source→production Git identity at the deployment level. The principal problem is therefore not source custody; it is content architecture, truth boundaries, taxonomy, currentness and discoverability.

## Build reality

The production build generated **164 pages**. The build includes the large dynamic guide corpus, the root page and the Sovereign Arena research dataset.

The build also reports a source collision for `llms.txt`:

- `src/pages/llms.txt.ts` exists;
- `public/llms.txt` exists;
- Astro warns that the page route is skipped because a public file with the same name wins.

Classification: `DUPLICATE_MACHINE_READABLE_SOURCE_OF_TRUTH`.

## Current source architecture

### Monolithic guide source

`src/pages/guides/[slug].astro` is approximately **3.5 MB** (`3,535,140` bytes) and contains the public guide corpus in one route source file.

The same guide universe is also represented in other source surfaces:

- `src/pages/index.astro` — embedded guide index/list;
- `src/pages/api/guides.ts` — approximately 133 KB of machine-readable guide/protocol data;
- `src/pages/guides/[slug].astro` — approximately 3.5 MB page/content source;
- `public/llms.txt` — a separate static crawler index;
- `src/pages/llms.txt.ts` — a second, currently shadowed crawler index implementation.

Classification: `MULTIPLE_CONTENT_AUTHORITIES / DRIFT_PRONE`.

This should be replaced by one canonical content model from which HTML, API, sitemap and llms outputs are generated.

### Restored pre-taxonomy state

The production commit explicitly restores the site to a pre-taxonomy/category generation. The root source already demonstrates taxonomy leakage: AI-agent, model-market, memory and forensics material is assigned to the generic `Trading` category.

Classification: `TAXONOMY_NOT_TRUSTWORTHY_AS_PRODUCT_IA`.

## Machine-readable truth-boundary findings

### `/api/guides`

Current public `/api/guides` returns HTTP 200 and exposes a very large machine-readable array.

The endpoint does not cleanly distinguish ordinary editorial guides from protocol/specification records, synthetic examples, execution parameters, trading-system fragments and safety/control objects. It includes internal-looking RPC paths, contract-like identifiers, numerical safety constants and action semantics in a form that can look operational/executable to downstream agents.

Some identifiers are visibly placeholder/synthetic in form and some contract-like strings are not valid hexadecimal Ethereum-style addresses. Those artifacts must not be presented as verified live infrastructure.

Classification:

`MACHINE_READABLE_TRUTH_BOUNDARY_FAILURE`

Required future record types:

- `GUIDE`
- `RESEARCH`
- `PROTOCOL_SPEC`
- `SYNTHETIC_EXAMPLE`
- `HISTORICAL_ARTIFACT`
- `DATASET`
- `PRODUCT_REFERENCE`

Every machine-readable record should expose provenance, reviewed date, evidence class and operational status. `SYNTHETIC_EXAMPLE` must never be silently consumable as a live endpoint/contract/config.

### `llms.txt`

The currently served `/llms.txt` comes from `public/llms.txt` and says there are **143 GEO-optimized guides**.

That conflicts with the exact production generation restored as a 162-guide site and with the production build that generated 164 pages.

The same file sends crawlers to:

`/guides`

but current public `/guides` returns **404 NOT_FOUND**.

Classification:

`CRAWLER_INDEX_DRIFT + BROKEN_DISCOVERY_LINK`.

The shadowed `src/pages/llms.txt.ts` is a second divergent machine-readable index and contains synthetic/placeholder-looking execution identifiers. It should not become live merely by deleting `public/llms.txt`; the content model must be normalized first.

## SEO / discovery census

Current public behavior:

- `/` → 200
- `/api/guides` → 200
- `/llms.txt` → 200
- `/robots.txt` → 200
- `/favicon.svg` → 200
- `/guides` → **404**
- `/sitemap-index.xml` → **404**
- `/sitemap.xml` → **404**

`robots.txt` explicitly advertises `/sitemap-index.xml`, which is currently missing.

The shared layout does not establish a systematic canonical URL, EN/RU hreflang pairing, Open Graph/Twitter metadata contract or exact public-build revision receipt.

Classification: `SEO_DISCOVERY_PARTIALLY_BROKEN`.

## i18n / language product state

The shared root layout declares `lang="ru"`, and the current corpus is predominantly Russian. There is no canonical EN/RU paired route system comparable to BitEvo V3.2/V3.3 and no visible locale switch.

Classification: `RU_PRIMARY / EN_PRODUCT_LAYER_MISSING`.

Future localization should not mechanically translate all 162 historical pages. First classify/review the corpus, then localize only canonical retained content with reciprocal EN/RU pairs.

## Shared chrome / infrastructure debt

The current `src/layouts/Layout.astro` contains ecosystem links to current BitEvo/Arena surfaces but also exposes raw legacy infrastructure URLs for Arena dashboards in the public footer.

Those links are an implementation-era coupling, not a stable public-product contract. They should be replaced by canonical public surface links or a verified registry entry.

The layout also loads multiple Google Font families through two external font stylesheet groups. This is not itself a correctness defect, but should be reevaluated under the BitEvo performance/privacy/design standard rather than inherited accidentally.

## Commercial / claim-boundary conflict

The public guide:

`/guides/ai-agent-reliability-audit`

is currently live and predates the current BitEvo audit doctrine.

It makes stronger promises and uses an older commercial ladder, including language that an AI Agent Reliability Audit makes production agents safe within 72 hours, plus old mini/full/enterprise pricing and broad rollback/injection-test claims.

This conflicts with the canonical BitEvo V3.x product boundary, which offers scoped engineering evidence rather than certification/guaranteed safety and currently defines the primary Agent Authority & Evidence Audit separately.

Classification: `STALE_COMMERCIAL_GUIDE / CANONICAL_PRODUCT_CONFLICT`.

Repair direction is not to silently edit historical evidence. Preserve the old artifact as historical if useful, but remove it from current commercial authority and point current service intent to the canonical BitEvo audit product.

## Strong asset worth preserving

`/sovereign-arena-dataset` is materially better disciplined than many other pages:

- explicitly labels backtest + forward-paper rather than real-money returns;
- includes failures instead of only winners;
- reports that zero of 29 tested configurations passed the stated gate;
- marks candidate strategies `do_not_trade` rather than promoting them;
- uses Dataset + FAQ structured data.

Its numerical values are still dated research artifacts and must get provenance/currentness receipts before being presented as current. The **failure-inclusive research doctrine** should be preserved as a model for the redesigned library.

## Content quality / currentness risk

The production generation is intentionally restored to July content. It must not be treated as automatically current in August merely because the deployment is healthy.

High-risk review buckets include:

- exchange/API mechanics;
- model names/capabilities/pricing;
- regulations;
- trading execution assumptions;
- current market microstructure claims;
- vendor/product availability;
- security recommendations;
- commercial product/pricing claims.

These require source-level re-verification before republication as `CURRENT`.

## Duplicate / near-duplicate risk

The current corpus contains multiple topic families with overlapping titles/slugs and historical generations. Examples observed in the build/source include multiple microstructure/delisting, Latent Space Protocol, agent architecture, trading discipline, grid and AI-governance variants.

No page should be deleted from production merely from name similarity. Required process:

1. exact body hash;
2. normalized-title similarity;
3. semantic duplicate cluster;
4. freshness/evidence comparison;
5. canonical winner + redirect/archive decision.

Classification: `DEDUP_CENSUS_REQUIRED`.

## 10-dimension BitEvo assessment — current state

This is a gap assessment, not a self-awarded score.

1. **Product clarity** — mixed library/research/protocol/product/service identities.
2. **Visual system** — coherent dark BitEvo-family styling exists, but the product IA and page semantics are not unified.
3. **UX/navigation** — home works, but `/guides` canonical index is missing and taxonomy is not reliable.
4. **Conversion** — stale audit commercial page competes with canonical BitEvo offer.
5. **Proof/trust** — good failure-inclusive dataset exists, but API/synthetic content boundaries are weak.
6. **SEO/i18n** — robots references missing sitemap; no paired EN/RU layer; crawler index count/link drift.
7. **Performance** — static site is structurally simple, but content source is monolithic and fonts are externally duplicated; fresh measured web-performance evidence not yet captured.
8. **Accessibility** — not yet independently audited in this census.
9. **Technical hygiene** — exact Git deployment binding is good; canonical content model/build receipt/quality gates are missing.
10. **Universe integration** — ecosystem links exist but are manually embedded and include legacy infrastructure coupling instead of registry-driven verified surfaces.

## Target architecture

Do not redesign the current 3.5 MB monolith in place as another large hand-edited file.

Target:

`content record -> review/evidence metadata -> generated HTML + API + llms + sitemap + Universe registry`

Each retained record should carry at minimum:

- stable `id` / slug;
- type;
- locale;
- title / abstract;
- subject taxonomy;
- source/provenance references;
- `reviewed_at`;
- evidence/currentness class;
- YMYL flag;
- historical/current status;
- canonical EN/RU pair where applicable;
- machine-readable exposure policy.

## Repair plan

### P0 — truth / discovery

1. Establish one canonical content dataset; remove divergent hand-maintained copies.
2. Separate synthetic/spec/protocol records from editorial guides in both human UI and API.
3. Fix `/guides` or stop advertising it as the guide index.
4. Generate a real sitemap and make `robots.txt` point to an existing artifact.
5. Resolve the `public/llms.txt` vs `src/pages/llms.txt.ts` collision from the canonical dataset.
6. Remove current commercial authority from the stale AI Audit guide.
7. Replace raw legacy infrastructure links with canonical public registry links.

### P1 — source architecture

1. Split the monolithic `[slug].astro` corpus into content/data files or an Astro content collection.
2. Generate index/API/llms/sitemap from the same records.
3. Add exact build metadata and `/version` / `version.json` receipts comparable to BitEvo.
4. Add provider-neutral quality gates: claims, links, metadata, accessibility structure, content type, YMYL boundaries, sitemap and build receipt.

### P2 — product quality / i18n

1. Rebuild IA around verified topic families rather than the restored `Trading` catch-all.
2. Add evidence/currentness filters and clear `historical` labels.
3. Curate a smaller high-quality public core before translating it.
4. Add reciprocal RU/EN localized routes and visible switch for retained canonical guides.
5. Integrate the library into standalone Universe through verified registry records rather than hand-written footer links.

## Mutation boundary

This document is a census only. No write has been made to `bitmaster162/crypto-guides-site` and no Crypto Guides deployment has been created or promoted.

The next source-changing step must start from a fresh `2b19db...` (or newly observed main) baseline, create a dedicated feature branch/PR, and build a preview. Production remains unchanged until a later exact-head approval.
