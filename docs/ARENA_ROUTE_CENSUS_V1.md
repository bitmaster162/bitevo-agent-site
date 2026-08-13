# Sovereign Arena — route census V1

Snapshot: 2026-08-13 15:42 UTC / 22:42 Asia-Bangkok
Parent program: BitEvo V3.3 ecosystem inventory
Task class: READ_ONLY_RUNTIME_CENSUS + SOURCE_BINDING

## Rule

`SOURCE != BUILD != DEPLOYMENT != READBACK != CLAIM`

This census does not change Arena production, aliases, DNS, runtime services, trading state, capital, payments, or external messaging.

## Current production identity

- Vercel project: `prj_yp0tLCr4MWGQUvTuJrW28bwu3EcF` / `sovereign-arena-site`.
- Production deployment: `dpl_9xeifLftSads4yq7F1osw1URjgX9`.
- Deployment state: `READY`, target=`production`.
- Deployment record has no Git metadata; build is direct-upload style.

## Public route census

| Route | HTTP | Current title | Current readback classification | Source binding |
|---|---:|---|---|---|
| `/` | 200 | `Sovereign Arena — regime-aware strategy lab` | STATIC ROOT WITH STRONG DYNAMIC/COMMERCIAL CLAIMS | Drive body snapshot found; later shared nav/footer layer not yet source-bound |
| `/guide` | 200 | `Путеводитель — арена, продукты, сайты | Sovereign Arena` | STATIC GUIDE | content-addressed Drive artifact bound: `6d4c6f969e8edac63dcbcddb1b0572710e60f296c2ff42a7d37d90775a2e4d5d`, 10682 bytes |
| `/ai-audit` | 200 | `AI-Agent Reliability Audit — production-агенты безопасны за 72ч | Sovereign Arena` | COMMERCIAL / CLAIM-HEAVY | Drive body snapshot found; later CTA/nav mutation observed |
| `/research-log` | 200 | `Honest Research Log — Memento case-bank | Sovereign Arena` | RESEARCH / FORWARD-PERFORMANCE CLAIMS | content-addressed Drive artifact bound: `e4024f14d02ae560384fe54c57c14f3dfbd6e88d6434de8158833969c9b6501d`, 8724 bytes |
| `/triage` | 200 | `AI Agent Reliability Triage — open tool (7 classes)` | BROWSER-LOCAL TOOL | exact-title Drive artifact family found; selected immutable candidate SHA256 `2be3fef40a1f8cc64e1f331ee50be2fc4ecfab554426e0f3c96f82355aa3f774`, 8377 bytes |
| `/pulse` | 200 | `Sovereign Arena — Live Pulse` | DYNAMIC UI SHELL | content-addressed Drive artifact bound: `48a0b1fa5a0ecb3e268783ec49552daa5dda7963a1dfd910aa1c906cf4ed20da`, 5548 bytes |
| `/grids` | 200 | `Гайд по грид-торговле — арена → биржа | Sovereign Arena` | TRADING / YMYL GUIDE | exact-title Drive artifact family found; duplicate generation selection still pending |
| `/boards` | 200 | `Гайд по всем доскам Grafana | Sovereign Arena` | RESEARCH / METRICS GUIDE | content-addressed Drive artifact bound: `f3aa09ade1a311e8e54c27e5f159aca1e361bc118d0c7fa1c6fbd588e7e5992e`, 15938 bytes |
| `/continuityos` | 200 | `ContinuityOS — durable hybrid memory for AI agents & humans` | PRODUCT / SOURCE CLAIMS | exact-title Drive artifact family found; selected immutable candidate SHA256 `324c54855d4c02c39e7faabe3463be6354769c6c1f24f0670f828aa146dc0961`, 16847 bytes |

All observed HTML routes above carry the same later shared Arena navigation/footer layer (`sa-topnav`, `sa-footer`). That layer is absent from at least some preserved Drive body snapshots, proving a post-snapshot mutation/injection stage.

## Confirmed runtime defects

### P0 — `/pulse` frontend depends on a missing API route

Current `/pulse` JavaScript calls:

`fetch('/api/pulse', { cache: 'no-store' })`

Direct current-production readback of `/api/pulse` returns **HTTP 404 / NOT_FOUND**.

Therefore the page shell itself is 200, but its advertised live data path is currently broken at the same public origin. The page can render the static frame while its primary dynamic payload fails.

Classification: `FALSE_GREEN_RUNTIME_DEFECT`.

Do not describe current `/pulse` as a verified working live surface until the data endpoint is restored or the page is explicitly degraded/static.

### P0 — root commercial API link is broken

Current root contains an `Edge Ledger API` service card linking to `/api/pricing`.

Direct current-production readback of `/api/pricing` returns **HTTP 404 / NOT_FOUND**.

Classification: `BROKEN_PUBLIC_FUNNEL_LINK`.

The service claim itself is not classified false by this receipt; the published first-party link is currently non-functional.

## Immutable source recovery receipts

The four content-addressed Drive artifacts below were downloaded as raw bytes and independently SHA-256 checked. In every case, the raw-file digest exactly equals the content-addressed Drive title.

| Route | Drive file id | Raw bytes | SHA-256 |
|---|---|---:|---|
| `/guide` | `19yVLB-zKuBls8pVhe-dAx-JvVFYrCvCC` | 10682 | `6d4c6f969e8edac63dcbcddb1b0572710e60f296c2ff42a7d37d90775a2e4d5d` |
| `/research-log` | `1Gq4QSOmSy1J_ezZuOaxsmXeLCN8wOMro` | 8724 | `e4024f14d02ae560384fe54c57c14f3dfbd6e88d6434de8158833969c9b6501d` |
| `/pulse` | `1jm6bF7zd4EoiIeH6c0jXjlk4zVhuLjAi` | 5548 | `48a0b1fa5a0ecb3e268783ec49552daa5dda7963a1dfd910aa1c906cf4ed20da` |
| `/boards` | `1bPNETlsDSa0GwSg8mEYqL2wlelHDA23H` | 15938 | `f3aa09ade1a311e8e54c27e5f159aca1e361bc118d0c7fa1c6fbd588e7e5992e` |

Two additional exact-title source-family candidates were downloaded and hashed even though their Drive filenames are generic `index.html`:

- `/triage`: Drive `15KQPaODXyMJ9qZjMv7FUGzS7RULM39ym`, 8377 bytes, SHA-256 `2be3fef40a1f8cc64e1f331ee50be2fc4ecfab554426e0f3c96f82355aa3f774`.
- `/continuityos`: Drive `1tnbd8lf2CQwT7IxhlrL9_CgWPbavp84P`, 16847 bytes, SHA-256 `324c54855d4c02c39e7faabe3463be6354769c6c1f24f0670f828aa146dc0961`.

These generic-name candidates remain `SOURCE_FAMILY_BOUND` rather than `EXACT_CURRENT_SOURCE` until duplicate-generation comparison proves which preserved copy is authoritative.

## Exact source recovery advance

### `/pulse` source is strongly bound

Drive file `1jm6bF7zd4EoiIeH6c0jXjlk4zVhuLjAi` contains a pre-navigation `Sovereign Arena — Live Pulse` HTML artifact whose structural body and JavaScript match current production `/pulse`, including:

- same Astro scope id `oxi3sj7z`;
- same `/api/pulse` client fetch;
- same market / epoch / experiments / green-edges / fleet sections;
- same 30-second refresh loop.

Observed difference: the preserved artifact has no shared Arena nav/footer injection and references an older Grafana Hub dashboard URL, while current public output has the later shared chrome and a newer dashboard URL.

This proves at least two separable layers for `/pulse`:

1. page artifact;
2. later shared navigation/link mutation layer.

### `/guide`, `/research-log`, `/boards`

Each route now has a content-addressed Drive artifact whose title/metadata/body markers match the current route family, and whose title was independently verified to equal its raw SHA-256. This establishes immutable historical page artifacts, but does not yet prove that current production bytes equal those artifacts because current production includes the later shared-chrome mutation layer.

### `/grids`, `/triage`, `/continuityos`

Drive contains multiple exact-title HTML snapshots for each route. The route family is therefore source-discovered. The remaining work is to compare duplicate generations and bind the one that corresponds to the deployed pre-navigation body.

## Claim/evidence implications

Current production contains dynamic and quantitative claims whose data adapters are not consistently bound to the static deployment artifact. The `/api/pulse` 404 is direct evidence that a 200 page shell is not sufficient runtime proof.

Required future taxonomy:

- `STATIC_CONTENT`
- `STATIC_CONTENT_WITH_EXTERNAL_LINKS`
- `DYNAMIC_ADAPTER_REQUIRED`
- `DYNAMIC_VERIFIED`
- `DEGRADED`
- `BROKEN`
- `HISTORICAL_METRIC`
- `CURRENT_METRIC_WITH_TIMESTAMP`

No metric, bot count, PnL, service availability, paid offer, or research verdict should inherit freshness merely because the page itself is reachable.

## Parent BitEvo V3.3 verification

This census is stored on BitEvo V3.3 feature branch only. Before this update, exact head `414acb02e51287a175b0571317e76e4764733f4a` had:

- Vercel preview `dpl_GxDaPcY8HPuyW1De2RLKJcfqCj3S` = `READY`;
- build-time `localized_pairs=16`, `locale_switches=32`;
- all existing BitEvo repository/provider gates PASS;
- GitHub Quality Gate run #64 / `31716442490` = `completed/success`.

This document update creates a successor branch head, so those receipts remain bound to `414acb...` and must not be projected onto the successor until its own CI/build completes.

## Next deterministic steps

1. Resolve duplicate-generation identity for `/grids`, `/triage`, `/continuityos` by body/hash comparison.
2. Find the shared `sa-topnav` / `sa-footer` injection source.
3. Census direct first-party dependencies used by each page (`/api/*`, internal routes) and record 2xx/4xx.
4. Reconstruct the current deployment bundle offline/read-only.
5. Compare reconstructed output route-by-route against production.
6. Only then establish an Arena recovery Git branch/PR and repair broken links/claims in preview before any production promotion.

## No-action boundary

No Arena source write, production deployment, DNS/alias change, runtime-service restart, trading action, payment change, or external message was performed in this census.
