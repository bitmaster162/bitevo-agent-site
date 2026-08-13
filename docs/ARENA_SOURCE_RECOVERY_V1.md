# Sovereign Arena — deployed source recovery V1

Snapshot: 2026-08-13 15:24 UTC / 22:24 Asia-Bangkok
Parent program: BitEvo V3.3 ecosystem inventory
Task class: READ_ONLY_FORENSIC + SOURCE_CUSTODY_RECOVERY

## Rule

`SOURCE != BUILD != DEPLOYMENT != READBACK != CLAIM`

No production alias, DNS, runtime, trading, capital, payment, or external messaging state is changed by this recovery record.

## Current public deployment identity

- Vercel project: `prj_yp0tLCr4MWGQUvTuJrW28bwu3EcF` / `sovereign-arena-site`.
- Public alias: `https://sovereign-arena-site.vercel.app`.
- Current resolved production deployment: `dpl_9xeifLftSads4yq7F1osw1URjgX9`.
- Deployment is `READY`, target=`production`, but contains no Git metadata in the Vercel deployment record.
- Its build log is a direct-upload style build: 10 deployment files, no source clone, build completed in ~25 ms.

## Git source reality

GitHub repository `bitmaster162/sovereign-arena-site` currently exposes only `main`.

Observed commit lineage in GitHub:

- `64277a03a041df03bc66c4691f32db79be7deec0` — init site + Grid Lab card
- `d0d637fc1f9220c7e9f1d8f099c1b861cefed1bc` — add Copy + Trade Gate cards
- `f070fe0587a4222b993b7e8fc9b8f2726ca414d9` — dashboard URL change; current public Git `main`

Drive forensic evidence explicitly records `f070fe...` as the wrong website version for recovery purposes. It also records a local website checkout at `C:\PROJECTS\sovereign-arena-site`, local HEAD `d0d637...`, with a dirty worktree (`src/pages/index.astro` modified plus untracked public output).

The verified R51 claim-repair candidate `5c7549bd6fc2bb7e33f714a3596e238864d573d5` is preserved in Drive evidence and was deployed as preview `dpl_CkBcC5hGyL1mLj5xW8CsmQZTQVic`, but that SHA is not present in the accessible GitHub repository and must not be projected onto current production.

## Newly recovered Drive source material

The deployed source is no longer wholly missing. Drive contains page-level HTML snapshots that match the pre-navigation body/content of current public Arena pages.

### `/` root

Drive source candidate:

- file id: `1HG0qEtLKOPlNTWHGTUWNU-kms4eZlGWz`
- content-addressed title: `d7c2a3780da6ac920b2fccc339d452be74b085d945aacf0dfa4c441c3e8a1949`
- mime: `text/html`
- size: 15108 bytes

Its content contains the same root title/description, 150+ live-bot wording, 81k+/157/90+/5 counters and service-card structure observed on the current public root. Current public HTML additionally contains shared navigation/footer injections.

### `/ai-audit`

Drive source candidate:

- file id: `1R5AzI_KMBhJn9GXywAhvkaAf8ctawx6G`
- title: `index.html`
- mime: `text/html`

It contains the same `AI-Agent Reliability Audit` page body currently served publicly: 72h / 7 failure classes / free triage, the PG_DSN incident narrative, self-check logic and Deep Audit offer. The Drive snapshot CTA points to `t.me/bitai1_bot`; current public readback points to `t.me/BitmasterTm`, demonstrating a later public-layer mutation/injection after the preserved page snapshot.

### Other preserved HTML candidates

Drive also contains multiple content-addressed / `index*.html` Arena page snapshots around the same recovery generation, including files such as:

- `19yVLB-zKuBls8pVhe-dAx-JvVFYrCvCC` — content-addressed HTML, 10682 bytes
- `1QBtRK_nOz5eHfnHa2c2pDzkP1e8wzjSo` — `index-2.html`, 10682 bytes
- `1UVtn1RfFrTnqmZizQ7ucj9Ldy9FyP_qV` — `index.html`, 10682 bytes

These are candidates only until each is route-bound by title/content comparison. Duplicate filenames alone are not route identity.

## Current readback findings

Public `/` and `/guide` return HTTP 200 and expose the later shared Arena navigation with links to `/guide`, `/ai-audit`, `/research-log`, `/triage`, `/pulse`, `/grids`, `/boards`, `/continuityos`, Arb Radar, Grid VIP, BitEvo and Crypto Guides.

Current public content is materially stronger than the R51 evidence-bounded preview. Examples include `live` experiment/robot counts, commercial service descriptions and the `/ai-audit` statement that production agents are made safe in 72h. This recovery record does **not** classify those statements as false. It classifies them as `EVIDENCE_BINDING_REQUIRED` because the current production artifact has no source revision/build receipt binding those claims to fresh evidence.

## Recovery classification

Previous: `CANONICAL_RUNTIME_DRIFT`.

Current: `DEPLOYED_SOURCE_DISCOVERED_PARTIAL`.

Meaning:

1. public production identity is known;
2. GitHub canonical source is stale;
3. one verified R51 preview candidate is known but is not current production;
4. page-level source snapshots matching current public content have now been found in Drive;
5. the later shared-nav / CTA mutation layer is observed but not yet source-bound;
6. the complete current deployment bundle has not yet been reconstructed route-for-route.

## Next deterministic recovery steps

1. Build a route census for every public Arena path and record status/title/ETag/body identity.
2. Bind each current route to the best Drive source candidate by exact title/body markers, not filename guesses.
3. Identify the shared navigation/footer injection source that produced the later public mutation layer.
4. Reconstruct an immutable candidate bundle without publishing it.
5. Compare reconstructed output against current Vercel production route-by-route.
6. Only after source equivalence is proven: establish a fresh Git recovery branch/PR in `sovereign-arena-site`, then begin claim cleanup and 10-dimension redesign.

## Current blocker

An attempt to create `recovery/deployed-source-census-20260813` in the Arena GitHub repo was blocked by the OpenAI connector safety interlock (`couldn't determine the safety status of the request`). This was not a GitHub branch-protection or permission error. No Arena repository mutation occurred.

Until that interlock clears, durable recovery evidence is being recorded in the BitEvo V3.3 ecosystem branch only. No direct write to Arena `main` is permitted.
