# Sovereign Arena current production vs recovered R51 regression matrix R4

Status: `READBACK_COMPARISON / NO_RUNTIME_WRITE / NO_PROMOTION`

Comparison basis:

- current public alias read back directly from Vercel on 2026-08-13 UTC;
- physically recovered R51 deployment candidate, strict-return SHA-256 `998fdec799988c3dc92836909c7cf1ebda03b7052c4a85bcbd5bf262a3891006`;
- R51 candidate Git HEAD `5c7549bd6fc2bb7e33f714a3596e238864d573d5`, tree `0c88a23f39769eb95f5a37d5fe366d074a1e3dcc`;
- R51 candidate was verified but **not** production-promoted.

This is a truth/currentness comparison, not an instruction to redeploy R51 wholesale.

| Route | Current production readback | Recovered R51 candidate | Finding |
|---|---|---|---|
| `/pulse` | HTTP 200; title `Live Pulse`; client calls `/api/pulse`; auto-refreshes every 30s and exposes live-looking market/epoch/bot/fleet slots | `Pulse data status`; `LIVE_DEGRADED`; reads `/pulse-status.json`; requires `arena.pulse.status.v1` + `DATA_UNAVAILABLE`; explicitly binds failed predecessor `/api/pulse`; no auto-refresh | **REGRESSION / FALSE_GREEN** |
| `/api/pulse` | HTTP 404 `NOT_FOUND` | R51 deliberately stopped treating it as a working producer and preserved failure evidence in `/pulse-status.json` | **CURRENT PRODUCER ABSENT** |
| `/ai-audit` | Claims `production-агенты безопасны за 72ч`; `Флагман · production AI reliability`; $0/72h triage; Deep Audit `от $1.5k`; case described as real current production evidence; direct Telegram conversion | `STATIC_DEMO`; title/description explicitly say static reference + dated 2026-07-21 incident case; pricing/SLA/conversion unverified; historical $0/72h and $1.5k replaced by `UNVERIFIED`; CTA routed to client-only brief intake | **REGRESSION / CLAIM INFLATION** |
| `/grids` | `арена → биржа`; live-price setup; specific exchange instructions; `1–2x maximum`; hard-stop percentages; current coin examples; `следующий шаг — executor-бот ... сам перевыставляет ордера через API`; framing `арена → реальная торговля` | `PAPER_ONLY`; `can_trade=false`; `capital_permission=DENY`; orders/keys unused; executor and exchange APIs explicitly OFFLINE; no capital permission | **REGRESSION / CAPITAL-BOUNDARY DRIFT** |
| `/continuityos` | Public `pip install continuityos`; strong product/runtime wording; `v0.1 — рабочее ядро`; installability presented directly | `STATIC_DEMO`; registry install explicitly not qualified; only verifiable GitHub source path allowed; no `pip install continuityos` instruction | **REGRESSION / UNVERIFIED INSTALLABILITY** |

## 1. `/pulse` is the strongest blocker

Fresh current readback proves the page and producer disagree:

```text
GET /pulse     -> 200, live-looking client shell
GET /api/pulse -> 404 NOT_FOUND
```

The current shell still executes:

```js
fetch('/api/pulse', { cache: 'no-store' })
```

R51 had already repaired precisely this condition. Its candidate made the failure state visible and machine-checkable instead of presenting blank live slots behind a green-looking shell.

This route alone is sufficient to reject current production as a trustworthy canonical source without reconciliation.

## 2. `/ai-audit` conflicts with the current BitEvo claim ceiling

Current production says, among other things:

```text
AI-Agent Reliability Audit — production-агенты безопасны за 72ч
Флагман · production AI reliability
$0 · 72ч
Deep Audit · от $1.5k
```

The recovered R51 candidate had already lowered this to a dated static reference:

```text
STATIC_DEMO
Описание услуги и датированный incident case.
Текущую доступность Arena или ботов страница не утверждает.
Pricing, 72h SLA и conversion не подтверждены.
```

This is not a stylistic difference. Current production reintroduced claims R51 specifically removed as unverified.

## 3. `/grids` crosses the governance boundary R51 restored

Current production gives actionable exchange configuration and progression toward an executor that places orders through APIs. It also explicitly frames the path as `арена → реальная торговля`.

R51 instead required:

```text
PAPER_ONLY
can_trade=false
capital_permission=DENY
ордера и ключи не используются
Executor и биржевые API ... OFFLINE
R51 не читает ключи, не создаёт ордера и не даёт capital permission
```

The safe canonical reconstruction must preserve the latter governance boundary unless a separate trading/capital authorization exists. None is implied by the public-site workstream.

## 4. `/continuityos` reintroduced unverified package-registry installability

Current production again exposes:

```text
pip install continuityos
```

R51 had deliberately removed that instruction because registry installability was not qualified, while leaving the product overview as `STATIC_DEMO` and pointing to a verifiable source path instead.

Any future canonical surface must independently verify package registry identity/installability before restoring a package-manager command.

## 5. Current reconstruction rule

Do **not** choose either current production or R51 wholesale.

Use this precedence:

```text
R51 truth repair boundaries
  + independently verified later product improvements
  + current BitEvo doctrine / claim ceiling
  + current route/source/build/readback evidence
  - later regressions / unverified claims / capital-boundary drift
  = next canonical Arena candidate
```

Current public navigation/footer improvements may be retained after source recovery. Live-looking telemetry, unverified commercial claims, unverified package-install instructions, and trading/executor guidance must not inherit trust merely because they are present in the later production artifact.

No Arena source, runtime, deployment, DNS, credentials, trading, capital, scheduler, or service state was modified during this comparison.
