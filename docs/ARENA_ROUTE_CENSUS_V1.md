# Sovereign Arena — route census V1

Snapshot: 2026-08-13 15:56 UTC / 22:56 Asia-Bangkok
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
- Current public alias and the immutable deployment URL were both re-read and expose the same final root generation.

## Public route census

| Route | HTTP | Current title | Current readback classification | Source binding |
|---|---:|---|---|---|
| `/` | 200 | `Sovereign Arena — regime-aware strategy lab` | STATIC ROOT WITH STRONG DYNAMIC/COMMERCIAL CLAIMS | content-addressed Drive artifact `d7c2a3780da6ac920b2fccc339d452be74b085d945aacf0dfa4c441c3e8a1949`, 15108 bytes; final shared chrome differs |
| `/guide` | 200 | `Путеводитель — арена, продукты, сайты | Sovereign Arena` | STATIC GUIDE | content-addressed Drive artifact `6d4c6f969e8edac63dcbcddb1b0572710e60f296c2ff42a7d37d90775a2e4d5d`, 10682 bytes |
| `/ai-audit` | 200 | `AI-Agent Reliability Audit — production-агенты безопасны за 72ч | Sovereign Arena` | COMMERCIAL / CLAIM-HEAVY | Drive artifact selected SHA256 `ba32902bd1cf3f6eb6be97708e3950541828a238cab03c035b71a248c34d7bce`, 14608 bytes; later CTA/nav mutation observed |
| `/research-log` | 200 | `Honest Research Log — Memento case-bank | Sovereign Arena` | RESEARCH / FORWARD-PERFORMANCE CLAIMS | content-addressed Drive artifact `e4024f14d02ae560384fe54c57c14f3dfbd6e88d6434de8158833969c9b6501d`, 8724 bytes |
| `/triage` | 200 | `AI Agent Reliability Triage — open tool (7 classes)` | BROWSER-LOCAL TOOL | two sampled Drive copies are byte-identical: SHA256 `2be3fef40a1f8cc64e1f331ee50be2fc4ecfab554426e0f3c96f82355aa3f774`, 8377 bytes |
| `/pulse` | 200 | `Sovereign Arena — Live Pulse` | DYNAMIC UI SHELL | content-addressed Drive artifact `48a0b1fa5a0ecb3e268783ec49552daa5dda7963a1dfd910aa1c906cf4ed20da`, 5548 bytes |
| `/grids` | 200 | `Гайд по грид-торговле — арена → биржа | Sovereign Arena` | TRADING / YMYL GUIDE | two sampled Drive copies are byte-identical: SHA256 `258c6c40e39b05a9f214bd09115a4f6e1747d52f033ac16c5ba5cc7e5fe34f99`, 9869 bytes |
| `/boards` | 200 | `Гайд по всем доскам Grafana | Sovereign Arena` | RESEARCH / METRICS GUIDE | content-addressed Drive artifact `f3aa09ade1a311e8e54c27e5f159aca1e361bc118d0c7fa1c6fbd588e7e5992e`, 15938 bytes |
| `/continuityos` | 200 | `ContinuityOS — durable hybrid memory for AI agents & humans` | PRODUCT / SOURCE CLAIMS | two sampled Drive copies are byte-identical: SHA256 `324c54855d4c02c39e7faabe3463be6354769c6c1f24f0670f828aa146dc0961`, 16847 bytes |

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

### P1 — basic discovery files absent

Direct current-production readback also returns 404 for:

- `/robots.txt`
- `/sitemap.xml`
- `/favicon.ico`

These are not runtime-safety defects, but they are technical/SEO/public-product debt for a site intended to become a canonical public research surface.

## Immutable source recovery receipts

The content-addressed Drive artifacts below were downloaded as raw bytes and independently SHA-256 checked. In each content-addressed case, the raw-file digest exactly equals the Drive title.

| Route | Drive file id | Raw bytes | SHA-256 |
|---|---|---:|---|
| `/` | `1HG0qEtLKOPlNTWHGTUWNU-kms4eZlGWz` | 15108 | `d7c2a3780da6ac920b2fccc339d452be74b085d945aacf0dfa4c441c3e8a1949` |
| `/guide` | `19yVLB-zKuBls8pVhe-dAx-JvVFYrCvCC` | 10682 | `6d4c6f969e8edac63dcbcddb1b0572710e60f296c2ff42a7d37d90775a2e4d5d` |
| `/ai-audit` | `1R5AzI_KMBhJn9GXywAhvkaAf8ctawx6G` | 14608 | `ba32902bd1cf3f6eb6be97708e3950541828a238cab03c035b71a248c34d7bce` |
| `/research-log` | `1Gq4QSOmSy1J_ezZuOaxsmXeLCN8wOMro` | 8724 | `e4024f14d02ae560384fe54c57c14f3dfbd6e88d6434de8158833969c9b6501d` |
| `/triage` | `15KQPaODXyMJ9qZjMv7FUGzS7RULM39ym` | 8377 | `2be3fef40a1f8cc64e1f331ee50be2fc4ecfab554426e0f3c96f82355aa3f774` |
| `/pulse` | `1jm6bF7zd4EoiIeH6c0jXjlk4zVhuLjAi` | 5548 | `48a0b1fa5a0ecb3e268783ec49552daa5dda7963a1dfd910aa1c906cf4ed20da` |
| `/grids` | `1IPnRG5DSAWNw_qAq4-lnJz4kS0SBDzvd` | 9869 | `258c6c40e39b05a9f214bd09115a4f6e1747d52f033ac16c5ba5cc7e5fe34f99` |
| `/boards` | `1bPNETlsDSa0GwSg8mEYqL2wlelHDA23H` | 15938 | `f3aa09ade1a311e8e54c27e5f159aca1e361bc118d0c7fa1c6fbd588e7e5992e` |
| `/continuityos` | `1tnbd8lf2CQwT7IxhlrL9_CgWPbavp84P` | 16847 | `324c54855d4c02c39e7faabe3463be6354769c6c1f24f0670f828aa146dc0961` |

For `/triage`, `/grids`, and `/continuityos`, a second independently retrieved Drive copy produced the exact same byte count and SHA-256 as the selected artifact. The sampled duplicates are therefore byte-identical rather than divergent generations.

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

### Direct-upload mutation lineage

The final production generation is not a single unexplained jump. Three immutable Vercel production deployments expose a mutation sequence:

- `dpl_DWBZoMWmQyPSs3FXyfag6XPJvMMk` — shared nav present, Telegram still targets `bitai1_bot`, no Grid VIP nav item;
- `dpl_Gk4Au56UTDQqrygqVMe9yAM6qEmD` — Grid VIP nav item appears and root Telegram moves toward `BitmasterTm`, while footer still retains older `bitai1_bot` wording;
- `dpl_9xeifLftSads4yq7F1osw1URjgX9` — final observed current navigation/CTA cleanup.

This narrows the remaining source gap to the exact assembly/injection mechanism and final ten-file bundle rather than the individual page bodies, which are now largely recovered.

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

## Next deterministic steps

1. Locate or reconstruct the shared `sa-topnav` / `sa-footer` assembly source and identify the tenth uploaded deployment file.
2. Reconstruct the final ten-file deployment bundle offline/read-only from recovered page artifacts plus the observed mutation layer.
3. Compare reconstructed output route-by-route against immutable `dpl_9xe...` URLs.
4. Establish a fresh Arena recovery Git branch/PR only after the baseline is reproducible.
5. In preview: repair `/api/pulse`, `/api/pricing`, metadata/discovery debt and claim boundaries; add source/build receipts.
6. Run route/dependency/browser smoke before requesting any production promotion.

## No-action boundary

No Arena source write, production deployment, DNS/alias change, runtime-service restart, trading action, payment change, or external message was performed in this census.
