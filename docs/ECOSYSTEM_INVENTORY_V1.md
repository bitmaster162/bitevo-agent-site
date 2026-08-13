# BitEvo Ecosystem Inventory V1

Snapshot: 2026-08-13 14:16 UTC / 21:16 Asia-Bangkok
Branch baseline: `72218ed72dd4b8e8251139d01f3e4df49361a9b4`

## Evidence rule

`SOURCE != BUILD != DEPLOYMENT != READBACK != EXTERNAL EFFECT`

A surface is not canonical merely because it returns HTTP 200. Production promotion, domain/DNS changes, deletion of legacy projects, paid-offer publication changes, and runtime/control effects remain separately authorized actions.

## Surface registry

| Surface | Vercel project | Current public alias | Latest deployment | Source custody | Classification | Next action |
|---|---|---|---|---|---|---|
| BitEvo Agent Site | `prj_U2iHyiwhJlO33r0u4uN65PpdzEiv` / `bitevo_agent_site` | `bitevoagentsite.vercel.app` | `dpl_4j7NifqXDRFoEtopBH7mCyzPe4ns` | GitHub `bitmaster162/bitevo-agent-site`, `main=72218ed72dd4b8e8251139d01f3e4df49361a9b4` | PRIMARY_CANONICAL | V3.3 UX/product audit; make RU/EN switch obvious in shared header; continue 10/10 gates |
| Crypto Guides | `prj_COnJDL3H3VF6bQQolYXWMbR2UsiH` / `crypto_guides_site` | `cryptoguidessite.vercel.app` | `dpl_8xyMj7faMfo67pVXXXs3RVRhjhC4` | GitHub `bitmaster162/crypto-guides-site`, `main=2b19db447318a3ddf0c856889d91d0e566deafa7` | CANONICAL_CONTENT | freshness/taxonomy/YMYL/SEO/i18n/10x audit before redesign |
| Sovereign Arena | `prj_yp0tLCr4MWGQUvTuJrW28bwu3EcF` / `sovereign-arena-site` | `sovereign-arena-site.vercel.app` | `dpl_9xeifLftSads4yq7F1osw1URjgX9` | GitHub `bitmaster162/sovereign-arena-site` exists, but `main=f070fe0587a4222b993b7e8fc9b8f2726ca414d9` is older than deployed site | CANONICAL_RUNTIME_DRIFT | recover exact deployed source before any redesign; claim/evidence audit; remove stale source/build ambiguity |
| Arbitrage Radar | `prj_LdPJQJjbsYk0l97Qxwyq3eN5nwjv` / `arb-radar` | `arb-radar-zeta.vercel.app` | `dpl_JCfHpPfL7hV8dokkNcfibopDJYwh` | No matching GitHub repo found by name; deployment contains 3 uploaded files and no Git metadata | OPERATIONAL_RUNTIME_SOURCE_UNKNOWN | locate authoritative generator/source; create immutable source/build receipt; trading/YMYL claim audit |
| Grid Mirror | `prj_zHarabZ6OTItYVVYhT9JvnyXAhvR` / `grid-mirror` | `grid-mirror.vercel.app` | `dpl_ErGUyUCkH8fsWvEXRjFq2LeS8Gdx` | No matching GitHub repo found by name | OPERATIONAL_MIRROR_SOURCE_UNKNOWN | bind mirror to canonical generator + snapshot receipt; distinguish paper metrics from live results |
| Grid VIP | `prj_gPqtZvlIvyiKIuKlQ9eRg9P6ESCD` / `grid-vip` | `grid-vip.vercel.app` | `dpl_6F1rTUVntjjHEQwD94GPfz32kDvr` | No matching GitHub repo found by name | PUBLIC_TRADING_SURFACE_SOURCE_UNKNOWN | source custody first; YMYL/risk language review; explicit data freshness/build receipt |
| Grid Source | `prj_bMhKAeQyVoBC2AW8Af1fQTxTGYzw` / `grid-src` | `grid-src.vercel.app` | `dpl_GsHNsvzQM5i1z91gySdLRymCPBm9` | Public generated source bundle; no matching GitHub repo found by name | PUBLIC_SOURCE_EXPOSURE | decide intentional open-source boundary; audit all published operational files before keeping public |
| Legacy Arena candidate | `prj_NoaAnwAsboyYHAufIva0zqipDHsL` / `site` | `site-azure-xi-64.vercel.app` | `dpl_Ag8NDtMTTeuK6kVMo2dN7WRhSzhF` | legacy deployment | LEGACY_REPLACED_CANDIDATE | preserve for forensic diff; do not promote; later redirect/retire only after explicit approval |
| Legacy BitEvo candidate | `prj_jS0SMz8cVZNz9YoA2VG1Wo4TcF1D` / `bitevoagentsite` | `bitevoagentsite-seven.vercel.app` | `dpl_Eek5LwJE191DSMknbTyf8Yvu7wh5` | legacy deployment | LEGACY_REPLACED_CANDIDATE | preserve until canonical lineage is sealed; then explicit retire decision |
| Legacy Crypto Guides candidate | `prj_w7BVhj70izGUpNzGI46WdsSv0ka2` / `cryptoguidessite` | `cryptoguidessite-eight.vercel.app` | `dpl_BY3waZuQ8FDzoL1a2VkSymyvXHwp` | legacy deployment | LEGACY_REPLACED_CANDIDATE | preserve until canonical lineage is sealed; then explicit retire decision |
| Quota probe | `prj_ahrhM3khEKYvWhQIrMffFJiROKMg` / `quota-probe` | `quota-probe-woad.vercel.app` | `dpl_4ZFhFWdCAAen7CeNFmPnW45fhx1V` | utility deployment | UTILITY_INTERNAL | exclude from public Universe unless there is a real product reason |
| Standalone BitEvo Universe | not deployed | not assigned | none | older Drive prototype `BitevoUniverse.dc.html`; newer Claude Design/Cowork work not exported yet | SOURCE_PENDING | ingest fresh Design/Cowork source, diff with old prototype + public BitEvo `/universe`, then establish a dedicated repo and preview |

## Current P0/P1 findings

### P0 — source custody / truth

1. Sovereign Arena has confirmed source/build drift: current Vercel production is materially newer than GitHub `main`. Do not redesign from GitHub until deployed source is recovered.
2. Arb Radar, Grid Mirror, Grid VIP and Grid Source have Vercel production but no matching GitHub repository found by the current name. Their authoritative source must be identified before normal product development.
3. `grid-src.vercel.app` intentionally or accidentally exposes a broad operational source bundle including `access_keys.py`, ACL tooling, bot/service code, deploy scripts and Telegram code. No secret file is asserted here; the publication boundary itself requires review.
4. Legacy projects still return public pages. Do not delete them until canonical lineage + redirect/retirement plan is explicit.

### P0.5 — BitEvo V3.3 UX

The Russian product layer is real and paired, but locale discovery is too weak. Add an always-visible `EN / RU` switch to shared desktop and mobile chrome, preserving the current route when a paired translation exists and falling back to `/` or `/ru` only when there is no pair.

### P1 — claims and product quality

1. Arena contains strong dynamic/quantitative claims and paid service descriptions that require an evidence/freshness taxonomy before 10x redesign.
2. Grid Mirror and Grid VIP publish paper-performance/APR/trading implementation language. Preserve paper/live boundaries and add data timestamps, methodology, provenance and non-advisory framing wherever metrics are shown.
3. Crypto Guides main was explicitly restored to a July generation with 162 guides; do not assume every guide is current in August. Run freshness, duplicate, taxonomy, citation and YMYL review.
4. Standalone Universe must be a registry of verified public surfaces, not a synthetic live control room. Runtime status is allowed only where a real adapter + evidence contract exists.

## Canonical development order

1. BitEvo V3.3 — locale UX + human visual/conversion acceptance + ecosystem manifest integration.
2. Sovereign Arena — recover deployed source, then 10x redesign and claim cleanup.
3. Crypto Guides — source/content audit, then IA/SEO/i18n/design upgrade.
4. Arb/Grid family — source custody + public/private split + provenance receipts, then UX.
5. Standalone Universe — ingest fresh Claude Design/Cowork work, establish dedicated repo, build from verified registry.
6. Legacy retirement — only after replacements are proven and separately approved.

## No-action boundaries in this inventory pass

- No DNS/domain/canonical-origin cutover.
- No deletion of Vercel projects or Git branches.
- No Arena/Grid runtime/control changes.
- No trading/capital action.
- No external outreach or payment publication changes.
- No merge/promotion of V3.3 without exact-head approval.
