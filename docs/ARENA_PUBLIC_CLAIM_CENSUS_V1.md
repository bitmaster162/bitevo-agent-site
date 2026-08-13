# Sovereign Arena — public claim and product-boundary census V1

Snapshot: 2026-08-14 00:05 Asia-Bangkok
Parent: BitEvo V3.3 ecosystem inventory
Task class: READ_ONLY_PUBLIC_CLAIM_REVIEW

## Evidence rule

`PAGE_COPY != RUNTIME_PROOF != CUSTOMER_PROOF != CURRENTNESS`

This census is based on recovered public Arena page artifacts and current public readback evidence. It does not change Arena production, trading, capital, DNS, credentials, prices, aliases, runtime services or outbound messaging.

## Root page — claim classes

The recovered root page presents Sovereign Arena as a regime-aware strategy lab and explicitly frames the environment as paper-only / not financial advice. That boundary is directionally correct and should be preserved.

However the same page contains a large number of time-sensitive operational claims that should not be mirrored into BitEvo Universe as static truth without a freshness receipt, including:

- `150+ bots on live Binance data`;
- `81k+ paper trades`;
- `157 bots live 24/7`;
- `90+ days public logs`;
- `8 live experiments` and six-hour auto-verdict cadence;
- current market/regime dashboards;
- `46,000+ trades` in Edge Ledger API;
- current paid-plan prices for Edge Ledger API, Alpha Gatekeeper and Inner Circle;
- `93 bot cards`;
- live-copy / VIP wording;
- statements that specific market-neutral tracks are currently positive.

Classification:

`DYNAMIC_OR_COMMERCIAL_CLAIM_REQUIRES_FRESH_RECEIPT`

The root also links `/api/pricing`; current Vercel-origin readback for that route is 404. That public service card therefore currently contains a broken first-party funnel link.

## AI-Agent Reliability Audit page

The recovered audit page is a legacy commercial surface and should not be treated as the canonical current BitEvo audit doctrine.

Problematic claim ceiling examples include:

- page title: `production agents safe in 72h`;
- description: `live case` and first run framing;
- hero: `we find this in hours` and triage `in 72 hours`;
- `real incident on our production system, 150+ autonomous bots`;
- `report in 72h`;
- `Deep Audit from $1.5k`.

The page also describes read-only access as enough for connection and promises prioritized P0–P2 findings with reproduction and a concrete fix.

These statements conflict with the current BitEvo V3.x claim ceiling and canonical Agent Authority & Evidence Audit product boundary, which avoids guaranteed safety/certification language and requires written scope / evidence / authorization boundaries before testing effects.

Classification:

`LEGACY_COMMERCIAL_SURFACE / CLAIM_CEILING_CONFLICT`

Recommended future handling:

1. preserve the recovered page as historical evidence;
2. remove it from current commercial authority;
3. route present-day audit demand to canonical BitEvo Agent Authority & Evidence Audit;
4. retain the seven failure classes only as historical/research input where they remain useful;
5. never present the legacy `safe in 72h` wording as current product truth.

## Legacy audit incident case

The page describes an internal incident where a hardening change allegedly removed `PG_DSN` from seven background collectors, causing quiet restart loops and stale public data for nearly three days, followed by a one-hour diagnosis and configuration repair.

The artifact itself is evidence that this claim was published. It is **not** sufficient independent evidence that every incident detail, exact duration, bot count, price value or `0 data loss` statement is externally verified.

Classification:

`PUBLISHED_DOGFOOD_CLAIM / INDEPENDENT_VERIFICATION_NOT_BOUND`

If reused publicly, it must be framed as internal self-audit / dogfood, not customer proof, independent certification or universal safety evidence.

## Live Pulse page

The recovered `/pulse` artifact is a client-side shell whose primary behavior is a no-store fetch to:

`/api/pulse`

It then renders BTC, 24h change, regime, Fear & Greed, news count, epoch PnL, win rate, trades, bots, open positions, experiment verdicts, green edges and fleet reachability. It refreshes every 30 seconds.

Current Vercel-origin `/api/pulse` returns 404, so the page-level HTTP 200 is a false-green shell and cannot support any live telemetry claim.

Classification:

`FALSE_GREEN_RUNTIME_DEFECT`

Until the first-party API path is repaired and source/build/runtime receipts are rebound, `/pulse` should be treated as a broken dynamic surface, not a live dashboard.

## Grid guide — trading / YMYL boundary

The recovered `/grids` guide crosses from research explanation into directly actionable trading setup instructions. It contains:

- symbol-selection guidance from an Arena low-cap scanner;
- a command-line invocation for `grid_setup.py SYMBOL [USD] [GRIDS] [LEVERAGE]`;
- instructions for copying generated values into exchange grid-bot UI fields;
- leverage guidance (`1–2x max`);
- a hard-stop rule;
- DRS/firewall eligibility rules;
- named coin examples with concrete prices, ranges, step sizes and stops;
- an explicit path from paper validation to a future API executor.

The footer says this is not financial advice and that paper proof is not a guarantee of income, but the material is still actionable financial/trading content and uses dated market values.

Classification:

`YMYL_ACTIONABLE_TRADING_GUIDE / FRESHNESS_REQUIRED`

Required future treatment:

- retain clear paper/live separation;
- date-stamp and source-bind all prices/market conditions;
- do not present historical scanner outputs as current candidates;
- independently verify any exchange-specific mechanics before labeling current;
- keep executor/order-placement actions outside public automatic authority unless separately scoped and authorized.

## Honest Research Log

The recovered research log is the strongest public Arena claim surface because it explicitly shows both positive and failed research outcomes.

Useful doctrine worth preserving:

- `Research · not signals · not income`;
- signal × direction × regime cell model;
- minimum-sample threshold framing;
- GREEN/WATCH/KILL states;
- explicit examples of strategies that died on forward data;
- realized-PnL-only language;
- forward-only evaluation and anti-lookahead framing;
- `can_trade conservative — microscope, not cash register`.

This aligns with BitEvo's evidence doctrine better than the commercial and live-telemetry pages.

Still, individual GREEN rows and statements such as `only OOS-confirmed classes today` are dynamic research-state claims and require a dated evidence snapshot before being repeated as current.

Classification:

`GOOD_RESEARCH_DOCTRINE / DYNAMIC_RESULTS_REQUIRE_FRESHNESS`

## Claim migration policy for Arena V2

Public Arena V2 should separate four layers that are currently mixed together:

1. **Method** — durable research methodology and failure-inclusive doctrine.
2. **Static historical artifact** — dated incidents, old pricing, old counts, old guides.
3. **Dynamic runtime** — only data backed by a working first-party adapter and visible freshness timestamp.
4. **Commercial offer** — current canonical product/pricing only, sourced from one authority.

Every public claim should carry enough metadata to answer:

- what is the source;
- when was it observed/reviewed;
- is it paper, simulated, historical, dynamic runtime or real-money;
- is it internal dogfood or independent/customer evidence;
- does it authorize any action (normally no);
- what invalidates the claim.

## Priority repair list

P0:

- repair or explicitly degrade `/pulse` instead of false-green 200 shell;
- remove/replace broken `/api/pricing` funnel;
- remove current commercial authority from legacy `safe in 72h` audit copy;
- prevent current Universe from mirroring dynamic Arena metrics without freshness receipts.

P1:

- move dynamic counts/results into a typed runtime adapter;
- add a visible `paper / historical / live-runtime` evidence label per surface;
- convert old prices/offers into historical records or current canonical references;
- review YMYL trading pages for dated market inputs and current exchange behavior.

P2:

- preserve Honest Research Log doctrine as the basis for Arena's public trust layer;
- expose failures, invalidations and source/build/runtime receipts alongside positive findings;
- bind Arena to the BitEvo Universe registry only after reconstructed source + runtime contracts are verified.

## No-effect receipt

No Arena or BitEvo production promotion, DNS, runtime, trading, capital, credential, price, Telegram, payment or external-message effect occurred from this census.
