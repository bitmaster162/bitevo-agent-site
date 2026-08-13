# Sovereign Arena R51 physical recovery + current regression R3

Status: `RECOVERY_EVIDENCE / NO_RUNTIME_WRITE / NO_PROMOTION`

This note supersedes the earlier uncertainty that the R51 strict return was only referenced indirectly. The exact R51 return bytes have now been physically recovered from the Library and verified locally. It does **not** assert that R51 equals current production.

## 1. Physical custody recovered

Library source container:

`GPT_CONTROLLER_BUNDLE_R55.zip`

Recovered nested strict return:

`CODEX-04/CODEX04_R51_SOVEREIGN_ARENA_TRUTH_REPAIR_RETURN.zip`

Local verification of the nested R51 ZIP:

```text
SHA-256 = 998fdec799988c3dc92836909c7cf1ebda03b7052c4a85bcbd5bf262a3891006
members = 58
ZIP CRC = PASS
```

The nested return includes:

- complete `candidate/` source, tools, tests, docs and screenshots;
- exact prebuilt `deployment/` candidate;
- `git/0001-R51-repair-Arena-production-truth-surfaces.patch`;
- `git/CODEX04_R51_SOVEREIGN_ARENA_TRUTH_REPAIR.bundle`;
- `MANIFEST.json`;
- `SHA256SUMS`;
- the exact R51 work order.

## 2. Exact Git identities recovered from the R51 bundle

The reconstructed production-artifact baseline in the recovered bundle is:

```text
branch = production-artifact-baseline
commit = 5105058ddf9450848b8fdc3b7af56f860edfecce
tree   = 764a8c436ee82d0feb017eaaf5e6628bc41bfaad
state  = CLEAN
```

The verified R51 repair candidate is:

```text
branch = codex04/r51-sovereign-arena-truth-repair
HEAD   = 5c7549bd6fc2bb7e33f714a3596e238864d573d5
tree   = 0c88a23f39769eb95f5a37d5fe366d074a1e3dcc
parent = 5105058ddf9450848b8fdc3b7af56f860edfecce
state  = CLEAN
```

The recovered history is therefore minimal and causally inspectable: exact reconstructed production artifact → one R51 truth-repair commit.

## 3. Production artifact identity bound by R51

R51 source identity binds the reconstructed baseline to the production deployment observed at that time:

```text
provider       = Vercel
project        = sovereign-arena-site
project_id     = prj_yp0tLCr4MWGQUvTuJrW28bwu3EcF
deployment_id  = dpl_HvHdXyfam6V82vihvfc9X3DEbDzk
deployment_url = sovereign-arena-site-bwgu4y710-bitevo-s-projects.vercel.app
created        = 2026-07-22T08:24:35.101Z
state          = READY
target         = production
source_kind    = CLI_API_PREBUILT_STATIC_ARTIFACT
uploaded_files = 10
git_bound      = false
```

R51 also reverified the public alias on 2026-07-29 and recorded baseline-matching bytes for `/` and `/pulse`.

## 4. R51 candidate test ceiling

Recovered candidate receipts state:

```text
build                         = PASS
static-prebuilt allowlist     = PASS
deployment files              = 11
npm run verify                = PASS 9/9
mobile routes                 = 9
horizontal overflow           = 0
console errors                = 0
console warnings              = 0
approved                      = false
can_trade                     = false
capital_permission            = DENY
production deployment         = NOT PERFORMED
```

The candidate is therefore a verified repair candidate, not a production release.

## 5. Current public regression proven against R51

A fresh current readback of:

`https://sovereign-arena-site.vercel.app/pulse`

returns HTTP 200 and presents itself as:

`Sovereign Arena — Live Pulse`

Its client code still performs:

```text
fetch('/api/pulse', { cache: 'no-store' })
```

and presents dynamic market, epoch, bot, experiment and fleet slots as a live auto-refreshing surface.

A fresh readback of:

`https://sovereign-arena-site.vercel.app/api/pulse`

returns:

```text
HTTP 404
NOT_FOUND
```

This is not merely an unresolved historical defect. It is a **current false-green runtime regression** relative to the verified R51 candidate.

The physically recovered R51 `deployment/pulse.html` had already repaired this exact condition. It changed the page to `Pulse data status`, loaded the static `/pulse-status.json` evidence document, required schema `arena.pulse.status.v1`, required `status=DATA_UNAVAILABLE`, explicitly bound the failed predecessor endpoint `/api/pulse`, displayed `LIVE_DEGRADED`, removed auto-refresh, and rendered unavailable metrics as unavailable instead of pretending to have a live producer.

Therefore:

```text
CURRENT PROD /pulse = LIVE-looking shell + missing /api/pulse producer
R51 candidate /pulse = evidence-bound DATA_UNAVAILABLE / LIVE_DEGRADED surface
```

The later production generation has reintroduced behavior that R51 had already repaired.

## 6. Current `/boards` also remains above the R51 claim ceiling

Fresh current `/boards` readback is HTTP 200 and still publishes strong operational claims such as:

- `18 boards` as a current guide surface;
- `Live League 150+ bots`;
- bots trading paper on live Binance data;
- regime, PnL, WR and edge interpretation presented as active operational context;
- `GREEN = tradable` style language around Memento cells;
- directional/operator language around Grid Lab and related dashboards.

R51 had already classified and qualified these surfaces around `STATIC_DEMO`, `LIVE_DEGRADED`, `PAPER_ONLY`, source status and link state. Current production should therefore not be used as the source of truth for future canonical reconstruction without a route-by-route diff against the recovered R51 candidate and any proven later repair lineage.

## 7. Updated source-custody conclusion

The evidence hierarchy is now stronger:

```text
old GitHub main
    != current production source

Drive July static base d7c2...1949
    = useful older assembly evidence

R51 reconstructed production baseline 5105058...
    = exact content-addressed Git baseline for production artifact dpl_HvHd...

R51 candidate 5c7549b...
    = verified one-commit truth repair, 9/9 PASS, NOT promoted

current 2026-08 production
    = later manual/static lineage with at least one proven regression relative to R51
```

This materially reduces source-recovery uncertainty: we now possess an exact trustworthy Git candidate and its parent artifact baseline. The remaining problem is **currentness reconciliation**, not absence of recoverable source.

## 8. Next safe reconstruction gate

Before any Arena source write or production promotion:

1. compare all current public Arena routes against the recovered R51 `deployment/` set;
2. identify later changes that are legitimate product improvements versus regressions / claim inflation;
3. reconstruct a new candidate baseline from R51 plus only evidence-supported later mutations;
4. keep current BitEvo claim ceiling and `paper-only / no financial advice` boundaries;
5. build and test independently;
6. exact preview readback;
7. separate explicit production approval.

No Arena runtime, deployment, DNS, credentials, trading, capital, scheduler, or service state was changed during this recovery pass.
