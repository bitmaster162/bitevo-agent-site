# Sovereign Arena full route currentness matrix R5

Status: `READBACK_CENSUS / RECOVERY_RECONCILIATION / NO_RUNTIME_WRITE / NO_PROMOTION`

Fresh write baseline:

```text
repo   = bitmaster162/bitevo-agent-site
branch = feat/v3-3-ux-ecosystem
head   = 80f4dc50e85da4a10038c8677e2bafd4f506fb19
base   = 72218ed72dd4b8e8251139d01f3e4df49361a9b4
PR     = #6 OPEN / DRAFT / MERGEABLE
```

Comparison authorities:

1. current Vercel public readback from `https://sovereign-arena-site.vercel.app`;
2. physically recovered R51 strict return SHA-256 `998fdec799988c3dc92836909c7cf1ebda03b7052c4a85bcbd5bf262a3891006`;
3. R51 candidate HEAD `5c7549bd6fc2bb7e33f714a3596e238864d573d5`, tree `0c88a23f39769eb95f5a37d5fe366d074a1e3dcc`;
4. current BitEvo public truth / claim ceiling.

R51 is a verified candidate, not a production release. Current production is a later lineage, not automatically authoritative source. This matrix is therefore a **reconciliation map**, not a rollback instruction.

## Route matrix

| Route / dependency | Current public state | R51 truth boundary | Classification | Canonical reconstruction action |
|---|---|---|---|---|
| `/` | HTTP 200; presents `150+` bots on live Binance data, `157 bots live 24/7`, `81k+` paper trades, `90+` days of logs, `5` regime edges, `8 live experiments`, auto-verdict every 6h; several live/pricing/service claims | `STATIC_DEMO`; numerical catalogue is a dated snapshot rather than live telemetry | `REGRESSION_CURRENTNESS_AND_CLAIM_INFLATION` | retain later IA/navigation only after source binding; restore dated/evidence-bound status; independently verify every counter, pricing and service-availability claim |
| `/guide` | HTTP 200; says Arena is a live 150+ bot paper lab, says Crypto Guides has `94` guides, exposes `pip install continuityos`, current Arb Radar cadence and premium product claims | `STATIC_DEMO`; dated product map; current bot activity not confirmed; registry installability unqualified | `REGRESSION_STALE_PLUS_CURRENTNESS_OVERCLAIM` | update stale corpus counts from canonical registry; separate snapshot facts from current verified state; remove unverified install/availability claims |
| `/ai-audit` | HTTP 200; title promises production agents safe in 72h; `Флагман · production AI reliability`; `$0 · 72ч`; Deep Audit `от $1.5k`; direct conversion and real-production-case framing | `STATIC_DEMO`; dated incident reference; pricing, 72h SLA and conversion marked unverified | `REGRESSION_COMMERCIAL_AND_PROOF_INFLATION` | replace with current BitEvo Agent Authority & Evidence Audit doctrine/funnel or clearly historical reference; do not let Arena become a competing sales authority |
| `/research-log` | HTTP 200; says current Memento snapshot is updated every run and identifies the only OOS-confirmed classes “today”; strong methodology-trust language | `PAPER_ONLY`; historical research snapshot; current `arena_memento_reco` read absent | `REGRESSION_UNVERIFIED_CURRENT_DATA` | preserve methodology/history, but bind freshness/source receipts before using `today`, `current`, GREEN or OOS-current claims |
| `/triage` | HTTP 200; 20-check browser-local self-assessment; says nothing leaves the tab; no signup; local JS computes result; later Telegram CTA | `STATIC_DEMO`; local browser-only self-check, no backend/live data | `LATER_IMPROVEMENT_CANDIDATE` | retain local-only UX after source recovery; align CTA/product naming with canonical BitEvo funnel; maintain no-send/no-backend boundary |
| `/pulse` | HTTP 200; title `Live Pulse`; JS calls `/api/pulse`; live-looking market, PnL, bots, experiments and fleet; 30s auto-refresh | `LIVE_DEGRADED`; reads static `/pulse-status.json`, explicitly records failed predecessor `/api/pulse`, renders unavailable metrics unavailable, no auto-refresh | `P0_FALSE_GREEN_REGRESSION` | restore evidence-bound degraded state unless a real producer is independently proven; never render live slots from an absent producer |
| `/api/pulse` | HTTP 404 `NOT_FOUND` | explicitly represented as failed predecessor by R51 evidence document | `P0_CURRENT_PRODUCER_ABSENT` | source of truth is “unavailable” until a separately verified runtime producer exists; do not repair runtime in this workstream without authorization |
| `/grids` | HTTP 200; exchange setup guidance, 1–2x leverage, hard-stop percentages, current coin examples, live-price language, next-step executor that places API orders, `arena → реальная торговля` framing | `PAPER_ONLY`; `can_trade=false`; `capital_permission=DENY`; orders/keys unused; executor and exchange APIs OFFLINE | `P0_P1_CAPITAL_BOUNDARY_REGRESSION` | canonical public surface must remain paper/research-only and non-executing; move any educational material behind explicit non-capital boundary; no executor/live-order implication |
| `/boards` | HTTP 200; current 18-board guide, Live League 150+ bots, live market/edge interpretations, `GREEN = tradable` semantics, operational Grid/Memento guidance; mixed HTTP/HTTPS dashboard links | `LIVE_DEGRADED`; definitions/routes may exist while freshness is not confirmed; status and `can_trade=false` explicitly visible | `REGRESSION_FRESHNESS_AND_TRADING_SEMANTICS` | retain explanatory taxonomy only where source evidence exists; mark freshness per dashboard; replace “tradable” semantics with evidence/status semantics; normalize secure links |
| `/continuityos` | HTTP 200; direct `pip install continuityos`; `v0.1 — рабочее ядро`; strong CLI/MCP/API/local-first/package claims | `STATIC_DEMO`; registry install not qualified; verified source path preferred | `REGRESSION_UNVERIFIED_INSTALLABILITY` | independently verify package registry identity/installability and exact product source before restoring install commands; otherwise link source/docs only |

## Cross-route findings

### A. Current production is not a coherent truth surface

The later production generation contains useful UX improvements — most notably a shared sticky Arena navigation/footer and clearer cross-site discovery — but truth/currentness semantics drifted backward on multiple routes.

The strongest direct contradiction is:

```text
/pulse     -> HTTP 200, live-looking UI, fetch('/api/pulse'), 30s refresh
/api/pulse -> HTTP 404 NOT_FOUND
```

This is a machine-observable false-green state, not a subjective copy issue.

### B. R51 is now a trustworthy reconstruction anchor, not an automatic target release

Physical recovery gives an exact parent/candidate chain:

```text
production-artifact-baseline
5105058ddf9450848b8fdc3b7af56f860edfecce
 tree 764a8c436ee82d0feb017eaaf5e6628bc41bfaad
        |
        v
R51 truth repair
5c7549bd6fc2bb7e33f714a3596e238864d573d5
 tree 0c88a23f39769eb95f5a37d5fe366d074a1e3dcc
```

R51 passed its own candidate verification but was never production-promoted. It should be used as the **truth-boundary anchor** while later legitimate product changes are reapplied selectively.

### C. Later changes divide into three buckets

`RETAIN_AFTER_BINDING`

- shared sticky Arena navigation/footer;
- clearer ecosystem cross-links;
- browser-local `/triage` UX where the no-send boundary remains true;
- later public-route additions whose source can be recovered and whose claims can be bounded.

`REQUALIFY_BEFORE_CANONICAL`

- current counters and “live” language;
- bot/exchange/dashboard freshness claims;
- OOS/edge/GREEN currentness language;
- product/version/installability claims;
- service availability and pricing;
- historical incident claims presented as current commercial proof.

`DO_NOT_INHERIT`

- `/pulse` false-green live state while `/api/pulse` is missing;
- production-agents-safe-in-72h promise;
- unverified $0/72h + $1.5k Arena audit sales authority;
- `GREEN = tradable` semantics;
- live/executor/order/API progression from `/grids` while `can_trade=false` and `capital_permission=DENY`;
- package-manager commands without independent registry verification.

## Reconstruction precedence

The next Arena canonical candidate should be generated by:

```text
R51 verified truth boundaries
+ proven later route/UX/IA improvements
+ current BitEvo doctrine and ecosystem registry
+ independently verified current source/build/readback evidence
- false-green runtime assumptions
- stale/currentness overclaims
- unverified commercial/pricing/installability claims
- capital/trading-boundary drift
= Arena canonical candidate R-next
```

## Gate before Arena source implementation

Arena source implementation remains blocked until all of the following are true:

1. route-by-route custody is bound to recovered source or an exact reconstruction input;
2. retained later changes are enumerated explicitly rather than copied wholesale from current production;
3. all current counters, pricing, availability, installability and runtime claims have a source/evidence disposition (`KEEP_VERIFIED`, `DATE_AS_SNAPSHOT`, `DEGRADE`, `REMOVE`);
4. `can_trade=false` and `capital_permission=DENY` remain invariant across the public surface;
5. candidate source builds independently;
6. preview readback is exact-head and machine-bound;
7. production promotion receives a separate explicit approval.

No Arena runtime, source repository, deployment, DNS, credential, scheduler, service, order, wallet, or capital state was changed by this census.
