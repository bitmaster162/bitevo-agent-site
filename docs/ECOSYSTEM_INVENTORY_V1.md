# BitEvo Ecosystem Inventory V1

Snapshot: 2026-08-13 14:56 UTC / 21:56 Asia-Bangkok
Branch baseline: `72218ed72dd4b8e8251139d01f3e4df49361a9b4`

## Evidence rule

`SOURCE != BUILD != DEPLOYMENT != READBACK != EXTERNAL EFFECT`

A surface is not canonical merely because it returns HTTP 200. Production promotion, domain/DNS changes, deletion of legacy projects, paid-offer publication changes, and runtime/control effects remain separately authorized actions.

## Surface registry

| Surface | Vercel project | Current public alias | Latest deployment | Source custody | Classification | Next action |
|---|---|---|---|---|---|---|
| BitEvo Agent Site | `prj_U2iHyiwhJlO33r0u4uN65PpdzEiv` / `bitevo_agent_site` | `bitevoagentsite.vercel.app` | `dpl_4j7NifqXDRFoEtopBH7mCyzPe4ns` | GitHub `bitmaster162/bitevo-agent-site`, `main=72218ed72dd4b8e8251139d01f3e4df49361a9b4` | PRIMARY_CANONICAL | V3.3 UX/product audit; make RU/EN switch obvious in shared header; continue 10/10 gates |
| Crypto Guides | `prj_COnJDL3H3VF6bQQolYXWMbR2UsiH` / `crypto_guides_site` | `cryptoguidessite.vercel.app` | `dpl_8xyMj7faMfo67pVXXXs3RVRhjhC4` | GitHub `bitmaster162/crypto-guides-site`, `main=2b19db447318a3ddf0c856889d91d0e566deafa7` | CANONICAL_CONTENT | freshness/taxonomy/YMYL/SEO/i18n/10x audit before redesign |
| Sovereign Arena | `prj_yp0tLCr4MWGQUvTuJrW28bwu3EcF` / `sovereign-arena-site` | `sovereign-arena-site.vercel.app` | `dpl_9xeifLftSads4yq7F1osw1URjgX9` | GitHub `origin/main=f070fe0587a4222b993b7e8fc9b8f2726ca414d9` is explicitly stale; forensic evidence preserves local website repo HEAD `d0d637fc1f9220c7e9f1d8f099c1b861cefed1bc` with dirty worktree, and Drive preserves R51 candidate `5c7549bd6fc2bb7e33f714a3596e238864d573d5`; latest production is newer again and direct-uploaded | CANONICAL_RUNTIME_DRIFT | recover exact current deployed source before redesign; claim/evidence audit; seal source/build identity |
| Arbitrage Radar | `prj_LdPJQJjbsYk0l97Qxwyq3eN5nwjv` / `arb-radar` | `arb-radar-zeta.vercel.app`; `sovereign-arb-radar.vercel.app` resolves to same deployment | `dpl_JCfHpPfL7hV8dokkNcfibopDJYwh` | Drive identifies runtime source as Arena `Trade/HANDOFF/grid_lab/ARB_RADAR.md` + `arb_sources.py` / `arb_engine.py` / `arb_service.py`, service `arena-arb.service`; not Git-bound | OPERATIONAL_RUNTIME_SOURCE_DISCOVERED_UNBOUND | bind authoritative source to Git/receipt; preserve 5-min generator semantics; trading/YMYL claim audit |
| Grid Mirror | `prj_zHarabZ6OTItYVVYhT9JvnyXAhvR` / `grid-mirror` | `grid-mirror.vercel.app` | `dpl_ErGUyUCkH8fsWvEXRjFq2LeS8Gdx` | Drive identifies `grid_lab/push_to_vercel.py` as mirror publisher; source lives in Arena/handoff tree, not a dedicated Git repo | OPERATIONAL_MIRROR_SOURCE_DISCOVERED_UNBOUND | bind generator + source revision to each snapshot; distinguish paper metrics from live results |
| Grid VIP | `prj_gPqtZvlIvyiKIuKlQ9eRg9P6ESCD` / `grid-vip` | `grid-vip.vercel.app`; `sovereign-grid-vip.vercel.app` resolves to same deployment | `dpl_6F1rTUVntjjHEQwD94GPfz32kDvr` | user-facing page is deployed as uploaded static/runtime files; related Grid runtime source is documented in Arena `grid_lab/`, but exact page generator is not yet Git-bound | PUBLIC_TRADING_SURFACE_SOURCE_PARTIAL | source custody first; YMYL/risk language review; explicit data freshness/build receipt |
| Grid Source | `prj_bMhKAeQyVoBC2AW8Af1fQTxTGYzw` / `grid-src` | `grid-src.vercel.app` | `dpl_GsHNsvzQM5i1z91gySdLRymCPBm9` | Drive identifies `grid_lab/publish_src.py` as publisher; public `manifest.json` exposes file size + truncated SHA256 receipts; no dedicated Git repo | PUBLIC_SOURCE_BUNDLE_UNBOUND | decide intentional open-source boundary; audit published operational files; bind manifest to a canonical Git/source revision |
| Legacy Arena candidate | `prj_NoaAnwAsboyYHAufIva0zqipDHsL` / `site` | `site-azure-xi-64.vercel.app` | `dpl_Ag8NDtMTTeuK6kVMo2dN7WRhSzhF` | legacy Arena deployment with stale direct-IP links and older claims | LEGACY_REPLACED_CANDIDATE | preserve for forensic diff; do not promote; later redirect/retire only after explicit approval |
| Legacy BitEvo candidate | `prj_jS0SMz8cVZNz9YoA2VG1Wo4TcF1D` / `bitevoagentsite` | `bitevoagentsite-seven.vercel.app` | `dpl_Eek5LwJE191DSMknbTyf8Yvu7wh5` | legacy deployment | LEGACY_REPLACED_CANDIDATE | preserve until canonical lineage is sealed; then explicit retire decision |
| Legacy Crypto Guides candidate | `prj_w7BVhj70izGUpNzGI46WdsSv0ka2` / `cryptoguidessite` | `cryptoguidessite-eight.vercel.app` | `dpl_BY3waZuQ8FDzoL1a2VkSymyvXHwp` | legacy deployment | LEGACY_REPLACED_CANDIDATE | preserve until canonical lineage is sealed; then explicit retire decision |
| Quota probe | `prj_ahrhM3khEKYvWhQIrMffFJiROKMg` / `quota-probe` | `quota-probe-woad.vercel.app` | `dpl_4ZFhFWdCAAen7CeNFmPnW45fhx1V` | utility deployment | UTILITY_INTERNAL | exclude from public Universe unless there is a real product reason |
| Standalone BitEvo Universe | not deployed | not assigned | none | older Drive prototype `BitevoUniverse.dc.html`; newer Claude Design/Cowork work not exported yet | SOURCE_PENDING | ingest fresh Design/Cowork source, diff with old prototype + public BitEvo `/universe`, then establish dedicated repo and preview |

## Source discovery receipts

- `project_arb_radar_20260725.md` (`Drive file 1x-ZWi3luZOQ42Y8pGFFIlGk6e9tHJXqT`) identifies Arb Radar code, service and handoff path.
- `project_grid_lab_20260722.md` (`Drive file 1DriQYhzU-Kl6Udswgt5d4g6EysVbmSII`) identifies Grid runtime code, mirror publisher, copytrade API and Vercel mirror lineage.
- `project_price_sources_20260725.md` (`Drive file 1e_WAS8u17CVCVM4ew_sorYbyTPKKDZum`) identifies `grid_supervisor.py`, `price_sources.py`, `publish_src.py` and the `grid-src` publishing model.
- `CODEX05_R52C_SOVEREIGN_ARENA_PREVIEW_RELEASE.md` (`Drive file 1AGj2CMbdPCXwUQX5MxUVnYbialJYNzKU`) preserves one verified Arena candidate (`5c7549bd...`, tree `0c88a23f...`, tests 9/9), but this receipt must not be projected onto newer production.
- `CODEX04_R29_ARENA_REMOTE_FORENSIC_VERDICT.md` preserves website root `C:\PROJECTS\sovereign-arena-site`, local `main` HEAD `d0d637fc1f9220c7e9f1d8f099c1b861cefed1bc`, stale `origin/main=f070fe...`, and a dirty worktree with `src/pages/index.astro` modified plus untracked public output.
- `CODEX04_M1_ARENA_TRUTH_SMOKE_HARNESS_20260801T165200Z.zip` independently re-observed the same local Arena HEAD and records source tree `8f6bf2d3d322b7dae4c248f22d2f9711b89ec028` plus an observed dirty-tree identity `51043155abf8d7208bb34c8df448b4cb386c1751`.
- Vercel deployment history binds R51 preview `dpl_CkBcC5hGyL1mLj5xW8CsmQZTQVic` to `candidateHead=5c7549bd...`. Current production `dpl_9xeifLftSads4yq7F1osw1URjgX9` has no Git metadata and its build log shows a direct upload of 10 deployment files.

## Current P0/P1 findings

### P0 — source custody / truth

1. Sovereign Arena has confirmed three-layer drift: public Git `f070fe...` is stale; preserved local source `d0d637...` is newer but dirty; the R51 claim-repair candidate `5c7549bd...` was previewed; current production is newer again and not Git-bound. Do not redesign from any older source until current deployed lineage is recovered.
2. Arena current production also represents an evidence-boundary regression relative to R51 preview: R51 explicitly labeled the surface `STATIC_DEMO` / `LIVE_DEGRADED` and qualified historical counts, while current production again publishes stronger `live` and commercial claims without a current source/build receipt. This does not prove those claims false; it means the current evidence binding is insufficient.
3. Arb/Grid source is no longer wholly unknown: Drive proves the Arena/handoff generators. The remaining problem is **source custody** — those generators are not bound to a canonical Git revision and deployment receipt.
4. `grid-src.vercel.app` exposes a broad operational source bundle including `access_keys.py`, ACL tooling, bot/service code, deploy scripts and Telegram code. Current probing did not establish publication of a secret file; the public-code boundary itself still requires review.
5. Legacy projects still return public pages. Do not delete them until canonical lineage + redirect/retirement plan is explicit.
6. Arb Radar changed during this inventory pass: the current production deployment was generated at 13:51 UTC with only 3 uploaded deployment files and no Git metadata. Treat these operational surfaces as concurrently changing and re-read immediately before any write.

### P0.5 — BitEvo V3.3 UX

The Russian product layer is real and paired, but locale discovery is too weak. Add an always-visible `EN / RU` switch to shared desktop and mobile chrome, preserving the current route when a paired translation exists and falling back to `/` or `/ru` only when there is no pair.

### P1 — claims and product quality

1. Arena contains strong dynamic/quantitative claims and paid service descriptions that require an evidence/freshness taxonomy before 10x redesign. Its current AI-Audit wording also predates the stricter BitEvo V3.x claim ceiling.
2. Grid Mirror and Grid VIP publish paper-performance/APR/trading implementation language. Preserve paper/live boundaries and add data timestamps, methodology, provenance and non-advisory framing wherever metrics are shown.
3. Crypto Guides main was explicitly restored to a July generation with 162 guides; do not assume every guide is current in August. Run freshness, duplicate, taxonomy, citation and YMYL review.
4. Standalone Universe must be a registry of verified public surfaces, not a synthetic live control room. Runtime status is allowed only where a real adapter + evidence contract exists.

## Canonical development order

1. BitEvo V3.3 — locale UX + human visual/conversion acceptance + ecosystem manifest integration.
2. Sovereign Arena — recover deployed source, then 10x redesign and claim cleanup.
3. Crypto Guides — source/content audit, then IA/SEO/i18n/design upgrade.
4. Arb/Grid family — bind discovered runtime source to Git + public/private split + provenance receipts, then UX.
5. Standalone Universe — ingest fresh Claude Design/Cowork work, establish dedicated repo, build from verified registry.
6. Legacy retirement — only after replacements are proven and separately approved.

## No-action boundaries in this inventory pass

- No DNS/domain/canonical-origin cutover.
- No deletion of Vercel projects or Git branches.
- No Arena/Grid runtime/control changes.
- No trading/capital action.
- No external outreach or payment publication changes.
- No merge/promotion of V3.3 without exact-head approval.
