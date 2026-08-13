# Sovereign Arena — route census V1

Snapshot: 2026-08-13 15:37 UTC / 22:37 Asia-Bangkok
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
| `/guide` | 200 | `Путеводитель — арена, продукты, сайты | Sovereign Arena` | STATIC GUIDE | public body observed; source candidate search pending exact binding |
| `/ai-audit` | 200 | `AI-Agent Reliability Audit — production-агенты безопасны за 72ч | Sovereign Arena` | COMMERCIAL / CLAIM-HEAVY | Drive body snapshot found; later CTA/nav mutation observed |
| `/research-log` | 200 | `Honest Research Log — Memento case-bank | Sovereign Arena` | RESEARCH / FORWARD-PERFORMANCE CLAIMS | current body observed; exact Drive candidate binding pending |
| `/triage` | 200 | `AI Agent Reliability Triage — open tool (7 classes)` | BROWSER-LOCAL TOOL | current body observed; exact Drive candidate binding pending |
| `/pulse` | 200 | `Sovereign Arena — Live Pulse` | DYNAMIC UI SHELL | exact pre-nav Drive source bound to `1jm6bF7zd4EoiIeH6c0jXjlk4zVhuLjAi` / content-addressed title `48a0b1fa...` |
| `/grids` | 200 | `Гайд по грид-торговле — арена → биржа | Sovereign Arena` | TRADING / YMYL GUIDE | multiple matching Drive HTML snapshots found; exact duplicate generation selection pending |
| `/boards` | 200 | `Гайд по всем доскам Grafana | Sovereign Arena` | RESEARCH / METRICS GUIDE | content-addressed Drive candidate `1bPNETlsDSa0GwSg8mEYqL2wlelHDA23H` plus duplicate snapshots found |
| `/continuityos` | 200 | `ContinuityOS — durable hybrid memory for AI agents & humans` | PRODUCT / SOURCE CLAIMS | public body observed; exact page-snapshot binding pending |

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

## Exact source recovery advance

### `/pulse` source is now strongly bound

Drive file `1jm6bF7zd4EoiIeH6c0jXjlk4zVhuLjAi` contains a pre-navigation `Sovereign Arena — Live Pulse` HTML artifact whose structural body and JavaScript match current production `/pulse`, including:

- same Astro scope id `oxi3sj7z`;
- same `/api/pulse` client fetch;
- same market / epoch / experiments / green-edges / fleet sections;
- same 30-second refresh loop.

Observed difference: the preserved artifact has no shared Arena nav/footer injection and references an older Grafana Hub dashboard URL, while current public output has the later shared chrome and a newer dashboard URL.

This proves at least two separable layers for `/pulse`:

1. page artifact;
2. later shared navigation/link mutation layer.

### `/grids` source family found

Drive search returns multiple HTML snapshots with the exact current title and article metadata for `/grids`, including file ids such as `1IPnRG5DSAWNw_qAq4-lnJz4kS0SBDzvd`, `1UOCy0wrXxslkMub2zqlS0vkdoUwIrgVd`, and other duplicates. These are now route-family candidates, but duplicate identity must be resolved by byte/body comparison before selecting one immutable source artifact.

### `/boards` source family found

Drive content-addressed file `1bPNETlsDSa0GwSg8mEYqL2wlelHDA23H` contains the exact current `/boards` title/description/schema metadata, with duplicate `index.html` snapshots also present. Route-family binding is therefore established; exact generation selection remains.

## Claim/evidence implications

Current production contains dynamic and quantitative claims whose data adapters are not consistently bound to the static deployment artifact. The new `/api/pulse` 404 is direct evidence that a 200 page shell is not sufficient runtime proof.

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

1. Bind `/guide`, `/research-log`, `/triage`, `/continuityos` to exact Drive source artifacts.
2. Resolve duplicate-generation identity for `/grids` and `/boards` by body/hash comparison.
3. Find the shared `sa-topnav` / `sa-footer` injection source.
4. Census direct first-party dependencies used by each page (`/api/*`, internal routes) and record 2xx/4xx.
5. Reconstruct the current deployment bundle offline/read-only.
6. Compare reconstructed output route-by-route against production.
7. Only then establish an Arena recovery Git branch/PR and repair broken links/claims in preview before any production promotion.

## No-action boundary

No Arena source write, production deployment, DNS/alias change, runtime-service restart, trading action, payment change, or external message was performed in this census.
