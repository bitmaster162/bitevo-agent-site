# BitEvo Ecosystem Inventory V1

Snapshot: 2026-08-13 16:15 UTC / 23:15 Asia-Bangkok
Branch baseline: `72218ed72dd4b8e8251139d01f3e4df49361a9b4`

## Evidence rule

`SOURCE != BUILD != DEPLOYMENT != READBACK != EXTERNAL EFFECT`

A surface is not canonical merely because it returns HTTP 200. Production promotion, domain/DNS changes, deletion of legacy projects, paid-offer publication changes, and runtime/control effects remain separately authorized actions.

## Surface registry

| Surface | Vercel project | Current public alias | Source custody | Classification | Next action |
|---|---|---|---|---|---|
| BitEvo Agent Site | `prj_U2iHyiwhJlO33r0u4uN65PpdzEiv` | `bitevoagentsite.vercel.app` | GitHub `bitmaster162/bitevo-agent-site`; production `main=72218ed72dd4b8e8251139d01f3e4df49361a9b4`; V3.3 draft PR #6 | PRIMARY_CANONICAL | finish V3.3 human/product acceptance; no merge without exact-head approval |
| Crypto Guides | `prj_COnJDL3H3VF6bQQolYXWMbR2UsiH` | `cryptoguidessite.vercel.app` | GitHub `bitmaster162/crypto-guides-site`, `main=2b19db447318a3ddf0c856889d91d0e566deafa7` | CANONICAL_CONTENT | freshness/taxonomy/YMYL/SEO/i18n/10x audit before redesign |
| Sovereign Arena | `prj_yp0tLCr4MWGQUvTuJrW28bwu3EcF` | `sovereign-arena-site.vercel.app` | public Git main stale; nine page-output artifacts recovered and hashed; direct-upload assembly/config layer not source-bound | DEPLOYED_SOURCE_DISCOVERED_PARTIAL | reconstruct final direct-upload bundle/config, then recovery preview + repair |
| Arbitrage Radar | `prj_LdPJQJjbsYk0l97Qxwyq3eN5nwjv` | `arb-radar-zeta.vercel.app` / `sovereign-arb-radar.vercel.app` | Arena/grid_lab source discovered in Drive; no canonical Git revision binding | OPERATIONAL_RUNTIME_SOURCE_DISCOVERED_UNBOUND | bind generator/source revision, then YMYL/provenance audit |
| Grid Mirror | `prj_zHarabZ6OTItYVVYhT9JvnyXAhvR` | `grid-mirror.vercel.app` | `grid_lab/push_to_vercel.py` discovered; not Git-bound | OPERATIONAL_MIRROR_SOURCE_DISCOVERED_UNBOUND | add generator/source receipt and paper/live boundary |
| Grid VIP | `prj_gPqtZvlIvyiKIuKlQ9eRg9P6ESCD` | `grid-vip.vercel.app` / `sovereign-grid-vip.vercel.app` | exact page generator not Git-bound | PUBLIC_TRADING_SURFACE_SOURCE_PARTIAL | source custody, then YMYL/risk/freshness review |
| Grid Source | `prj_bMhKAeQyVoBC2AW8Af1fQTxTGYzw` | `grid-src.vercel.app` | `grid_lab/publish_src.py` discovered; no dedicated Git repo | PUBLIC_SOURCE_BUNDLE_UNBOUND | decide public/private boundary and bind manifest to source revision |
| Legacy Arena | `prj_NoaAnwAsboyYHAufIva0zqipDHsL` | `site-azure-xi-64.vercel.app` | older Arena generation | LEGACY_REPLACED_CANDIDATE | preserve for forensic diff; explicit retire only |
| Legacy BitEvo | `prj_jS0SMz8cVZNz9YoA2VG1Wo4TcF1D` | `bitevoagentsite-seven.vercel.app` | legacy deployment | LEGACY_REPLACED_CANDIDATE | preserve until lineage sealed |
| Legacy Crypto Guides | `prj_w7BVhj70izGUpNzGI46WdsSv0ka2` | `cryptoguidessite-eight.vercel.app` | legacy deployment | LEGACY_REPLACED_CANDIDATE | preserve until lineage sealed |
| Quota probe | `prj_ahrhM3khEKYvWhQIrMffFJiROKMg` | `quota-probe-woad.vercel.app` | utility deployment | UTILITY_INTERNAL | exclude from public Universe unless product reason exists |
| Standalone BitEvo Universe | not deployed | none | old Drive `BitevoUniverse.dc.html` found; newer Claude Design/Cowork export still pending | SOURCE_PENDING | ingest fresh Design/Cowork source; dedicated repo + preview from verified registry |

## BitEvo V3.3 current truth

Current feature head before this inventory update: `ce9250fdde4364ebe971228da2256bf4a787d0f0`.

- GitHub Quality Gate #68 / run `31719259498` = SUCCESS.
- Exact Vercel preview `dpl_3HTNcR8YwxoJTuk8ppHT6MGb8BGT` = READY, Git SHA `ce9250fdde4364ebe971228da2256bf4a787d0f0`.
- 46 pages built.
- `localized_pairs=16`, `locale_switches=32`.
- P0 claim scan, public quality, primary deliverables, performance, home trust, budget, dogfood, workspace, RU surface, build receipt and Vercel policy gates all PASS.

The route-preserving EN/RU switch is therefore source/build verified in V3.3. Protected preview body readback remains a separate evidence class from build/deployment readiness.

## Sovereign Arena source/deployment recovery

Current production is `dpl_9xeifLftSads4yq7F1osw1URjgX9`, READY / production, no Git metadata. Its build log downloads ten deployment files, performs no Git clone and completes output assembly in ~25 ms.

Nine public page-output families are now recovered and hashed: root, guide, ai-audit, research-log, triage, pulse, grids, boards and continuityos. Sampled duplicates for triage, grids and continuityos are byte-identical.

A historical deployment-truth record states that Arena had been restored as a multi-page local project after a stale Git-main deployment overwrote a newer CLI-deployed site. The documented local recovery model was `src/pages/index.astro` plus self-contained `public/<route>/index.html` pages, followed by `vercel deploy` rather than blind Git-main promotion.

A separate ecosystem record documents another deployment mode: direct Vercel API v13 upload of built `dist` files, including post-build ecosystem-chrome injection. This is consistent with the current direct-upload production history and helps explain why current public HTML contains a shared `sa-topnav`/`sa-footer` layer absent from preserved pre-navigation page artifacts.

## Confirmed Arena configuration/runtime drift

Historical Git and `README_DEPLOY.md` evidence define a Vercel rewrite contract for first-party `/api/*` and `/gate/*` paths. Current public deployment behavior does not preserve the expected `/api/*` path:

- `/pulse` page = 200, but `/api/pulse` = Vercel 404 `NOT_FOUND`;
- root Edge Ledger API link `/api/pricing` = Vercel 404 `NOT_FOUND`;
- sampled earlier direct-upload production `dpl_DWBZoMWmQyPSs3FXyfag6XPJvMMk` also returns Vercel 404 for `/api/pulse`.

Thus the Pulse defect predates the final navigation/CTA cleanup and is consistent with deployment/config drift in the direct-upload generation. This proves the public origin is not serving the expected first-party endpoint; it does not establish whether the backend service itself is healthy.

Additional public-product debt: `/robots.txt`, `/sitemap.xml`, `/favicon.ico` each currently return 404.

## Historical security status discovered during recovery

The sanitized WO-019 acceptance records that an original Arena recovery archive was quarantined for credential contamination. A P0 checklist states that provider-backed revocation/rotation closure was required for multiple credential classes. During this inventory pass no all-provider closure receipt was found in the searched Drive corpus.

Current bounded classification is recorded separately in `docs/P0_SECURITY_STATUS_V1.md` as `UNKNOWN / CLOSURE_RECEIPT_NOT_FOUND`. This does not prove any historical credential is still valid today; it means closure is not evidenced in the material currently inspected. No secret values are reproduced in this repo.

## Canonical development order

1. BitEvo V3.3 — human visual/conversion acceptance + ecosystem manifest integration.
2. Sovereign Arena — finish direct-upload source/config reconstruction, then repair and 10x redesign in preview.
3. Crypto Guides — source/content audit, then IA/SEO/i18n/design upgrade.
4. Arb/Grid — source custody + public/private split + provenance, then UX.
5. Standalone Universe — ingest fresh Claude Design/Cowork work, dedicated repo, verified registry.
6. Legacy retirement — only after replacements are proven and separately approved.

## No-action boundaries

- No DNS/domain/canonical-origin cutover.
- No deletion of Vercel projects or Git branches.
- No Arena/Grid runtime/control changes.
- No trading/capital action.
- No credential mutation.
- No external outreach or payment publication changes.
- No merge/promotion of V3.3 without exact-head approval.
