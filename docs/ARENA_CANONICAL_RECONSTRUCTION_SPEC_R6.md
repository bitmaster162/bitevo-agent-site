# Sovereign Arena canonical reconstruction specification R6

Status: `IMPLEMENTATION_SPEC_ONLY / NO_ARENA_SOURCE_WRITE / NO_DEPLOYMENT / NO_PROMOTION`

Fresh authoring baseline:

```text
repo   = bitmaster162/bitevo-agent-site
branch = feat/v3-3-ux-ecosystem
head   = 055e08eb7853dae506b063b7e28b18097743b861
base   = 72218ed72dd4b8e8251139d01f3e4df49361a9b4
PR     = #6 OPEN / DRAFT / MERGEABLE
```

This specification converts the recovered R51 evidence and the fresh current-production census into an implementable source plan. It deliberately stops before touching the Arena source repository or Vercel project.

## 1. Canonical reconstruction anchor

Use the physically recovered R51 candidate as the initial source body, because it has an exact, minimal, content-addressed lineage:

```text
R51 production-artifact baseline
commit 5105058ddf9450848b8fdc3b7af56f860edfecce
tree   764a8c436ee82d0feb017eaaf5e6628bc41bfaad
          |
          | exactly one truth-repair commit
          v
R51 candidate
commit 5c7549bd6fc2bb7e33f714a3596e238864d573d5
tree   0c88a23f39769eb95f5a37d5fe366d074a1e3dcc
```

Recovered strict-return SHA-256:

`998fdec799988c3dc92836909c7cf1ebda03b7052c4a85bcbd5bf262a3891006`

The recovered candidate already contains:

```text
site/
  ai-audit.html
  boards.html
  continuityos.html
  grids.html
  guide.html
  index.html
  pulse-status.json
  pulse.html
  research-log.html
  triage.html
  vercel.json

tools/
  apply_truth_repair.mjs
  build.mjs
  qualify_claims.mjs
  static_server.mjs

tests/
  site.test.mjs
```

The build model is intentionally simple: a strict static-prebuilt allowlist, UTF-8/LF canonicalization, zero external build dependencies, and an explicit deployment-file set.

## 2. Preserve R51 invariants as hard tests

The next candidate must keep these R51 invariants unless a later item is independently verified and intentionally supersedes one:

```text
/pulse             = LIVE_DEGRADED unless producer + schema + freshness are proven
/grids             = PAPER_ONLY
/research-log      = PAPER_ONLY unless current source/freshness is proven
/ai-audit          = no unverified SLA/pricing/current-production proof
/continuityos      = no unverified registry install command
all capital paths  = can_trade=false
capital permission = DENY
```

Retain or strengthen these R51 machine gates:

- strict deployment allowlist;
- exactly one allowed truth classification on every primary route;
- `/pulse-status.json` schema validation;
- no fetch of missing `/api/pulse` while producer is absent;
- no unqualified `pip install continuityos`;
- explicit paper/capital denial on Grid surfaces;
- canonical HTTPS for Arena dashboard links;
- internal-link resolution;
- product-count / historical-offer qualification;
- mobile horizontal-overflow regression checks;
- zero console errors/warnings for the tested candidate.

## 3. Later production changes: selective overlay only

Do not import the current production artifact wholesale. Reapply only selected later improvements as an explicit overlay on top of R51.

### 3.1 `KEEP_AFTER_SOURCE_BINDING`

Candidate overlay items:

1. current shared sticky `.sa-topnav` / `.sa-footer` UX, after extracting it to one source-owned component/template or deterministic build transform;
2. current cross-site navigation to canonical BitEvo and Crypto Guides surfaces;
3. current `/triage` browser-local interaction improvements, while preserving no-backend/no-send semantics;
4. separate Arb Radar discovery link, once canonical URL/project identity is registry-bound;
5. clearer guide/navigation information architecture where it does not imply current telemetry, trading permission, package availability, pricing or customer proof.

### 3.2 `REQUALIFY_FROM_EVIDENCE`

These may be retained only if an exact source and current receipt exists at candidate-build time:

- Arena bot/configuration counts;
- trade/log-day counts;
- experiment counts and verdict cadence;
- current dashboard freshness;
- model/orchestrator roster counts;
- OOS / GREEN / edge-currentness claims;
- Arb Radar exchange count and update cadence;
- ContinuityOS version, package-registry installability, tool/test/gate counts;
- service availability, price, seats, free quotas and subscription/payment state.

Each item must resolve to one of:

```text
KEEP_VERIFIED
DATE_AS_SNAPSHOT
LIVE_DEGRADED
STATIC_DEMO
PAPER_ONLY
REMOVE
```

There is no implicit `CURRENT` state.

### 3.3 `DROP_AS_REGRESSION`

Do not inherit:

- `/pulse` live shell backed by missing `/api/pulse`;
- “production agents safe in 72 hours”;
- Arena-owned `$0 / 72h` or `$1.5k Deep Audit` commercial authority;
- “GREEN = tradable” wording;
- current coin/exchange setup presented as an execution path;
- executor/API-order progression while capital permission is denied;
- package-manager install command without independent registry verification;
- stale Crypto Guides corpus count `94`;
- HTTP dashboard URLs when HTTPS exists;
- any count or “live” label that exists only because it was embedded in a later static artifact.

## 4. Product-authority split

The reconstructed Arena must have a narrower role than the canonical BitEvo site.

```text
BitEvo
  = canonical authority/evidence audit product + commercial funnel

Sovereign Arena
  = paper/research/evidence laboratory + transparent historical/current-status surfaces

Crypto Guides
  = content/research library with explicit currentness/YMYL review state

Standalone Universe
  = ecosystem navigator/registry once separately sourced and built
```

Arena must not become a second competing commercial authority for Agent Authority & Evidence Audit. If `/ai-audit` remains for historical continuity, it should point to the current BitEvo audit doctrine/product surface and preserve the dated Arena incident as a scoped case artifact, not as proof of a universal 72h safety promise.

## 5. Proposed R-next source layout

The next Arena candidate should remain self-contained and deterministic:

```text
arena-r-next/
  site/
    index.html
    guide.html
    ai-audit.html
    research-log.html
    triage.html
    pulse.html
    pulse-status.json
    grids.html
    boards.html
    continuityos.html
    vercel.json
  data/
    ecosystem-registry.json
    claim-dispositions.json
    route-status.json
  templates/
    shared-nav.html
    shared-footer.html
    truth-band.html
  tools/
    build.mjs
    apply_overlay.mjs
    verify_claims.mjs
    static_server.mjs
  tests/
    site.test.mjs
    currentness.test.mjs
    registry-links.test.mjs
  docs/
    SOURCE_IDENTITY.json
    ROUTE_MATRIX.json
    CLAIM_DISPOSITION.json
    BUILD_TEST_RECEIPT.json
    READBACK_RECEIPT.json
    NO_EFFECT_RECEIPT.json
```

This layout is a target model, not yet created in the Arena repository.

## 6. Required registry contract

`data/ecosystem-registry.json` should be the only source for ecosystem cross-links and product identities. Minimum fields:

```json
{
  "id": "sovereign-arena",
  "label": "Sovereign Arena",
  "kind": "paper-research-lab",
  "canonical_url": "https://sovereign-arena-site.vercel.app/",
  "source_status": "RECOVERED_RECONSTRUCTION_PENDING",
  "runtime_status": "MIXED_CURRENTNESS",
  "can_trade": false,
  "capital_permission": "DENY"
}
```

Equivalent entries should exist for BitEvo, Crypto Guides, Arb Radar and later standalone Universe. No entry may manufacture live runtime status merely to populate UI.

## 7. Claim-disposition contract

Every high-risk public claim should have an explicit record before rendering. Example:

```json
{
  "claim_id": "arena.pulse.live",
  "route": "/pulse",
  "text_class": "runtime-currentness",
  "source": "/api/pulse",
  "observed": "HTTP_404",
  "disposition": "LIVE_DEGRADED",
  "render_live_value": false
}
```

Commercial, package-installability, telemetry, performance, OOS, pricing and capital-related claims should be handled the same way.

## 8. Fresh-read source gate before implementation

Before the **first Arena source write**, perform all of the following again at that time:

1. fresh-read `bitmaster162/sovereign-arena-site` live `main` HEAD/tree/status;
2. compare it to the recovered R51 baseline/candidate and confirm it is still an unsuitable writer root or document why that changed;
3. fresh-read current Vercel production deployment identity and route readbacks;
4. fresh-read any recovered later source package if one is found;
5. choose exactly one candidate authoring root;
6. create a dedicated branch; never write directly to `main`;
7. bind the branch parent/source identity in `SOURCE_IDENTITY.json` before content edits.

If a trustworthy current Git root cannot be established, do not pretend old `main` is canonical. Build the reconstruction in a separate candidate root/repository only after its custody model is explicit.

## 9. Minimum acceptance suite for R-next

A candidate may be called `SOURCE_CANDIDATE_PASS` only when all are true:

```text
strict files/allowlist                  PASS
all primary routes HTTP                 200
truth classification count             exactly 1 / route
/pulse producer-state consistency       PASS
/api/pulse absent => no live shell       PASS
capital invariant                       can_trade=false
capital permission                      DENY
commercial claim ceiling                PASS
package-installability qualification    PASS
currentness disposition coverage        100% of high-risk claims
internal links                          PASS
external canonical links                PASS or visibly DEGRADED
mobile smoke                            PASS
horizontal overflow                     0
console errors                          0
console warnings                        0
source/build identity receipt           PASS
preview exact-head readback             PASS
```

`SOURCE_CANDIDATE_PASS` still does **not** mean production promotion.

## 10. Stop conditions

Stop implementation and preserve a patch/evidence receipt instead of improvising if:

- OpenAI safety interlock blocks a source write;
- current source identity changes during the write sequence;
- Vercel preview cannot be bound to exact candidate SHA/artifact;
- any proposed later overlay cannot be traced to source or evidence;
- a route would require live trading/order/key/capital behavior;
- a commercial/pricing/customer/certification claim lacks current authority.

No Arena source repository, production deployment, DNS, runtime, credential, scheduler, service, order, wallet or capital state is modified by this specification.
