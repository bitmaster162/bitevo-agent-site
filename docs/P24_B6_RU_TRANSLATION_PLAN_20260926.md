# P24 B6 — RU translation plan and glossary

Status: PLAN ONLY for the broader low-Cyrillic RU surface. This document does not authorize bulk translation.

Baseline: `cbc6b7271d372290aca335462a7050f9b3a8850a`.

## Re-audit result

The reported work order said 18 RU pages at or below 33% Cyrillic share.

Fresh canonical audit found:
- 54 canonical RU routes;
- 17 actual RU routes at or below 33% Cyrillic share;
- the apparent 18th route was `/ruap`, which is an English route whose slug starts with `ru`; it must not be included in RU translation scope.

## Immediate B6 scope

Translate only title, H1 and meta description on:
- `/ru/audit/proposal-readiness`
- `/ru/audit/paid-start-gate`
- `/ru/audit/measured-value-gate`
- `/ru/audit/renewal-expansion-gate`
- `/ru/build/measured-value-gate`
- `/ru/build/renewal-expansion-gate`

No other page body is translated in this B6 implementation.

## Broader translation candidates — plan only

Measured canonical RU pages at or below 33% Cyrillic share:
- `/ru/agent-authority-audit`
- `/ru/artifacts`
- `/ru/audit/measured-value-gate`
- `/ru/audit/paid-start-gate`
- `/ru/audit/proposal-readiness`
- `/ru/audit/renewal-expansion-gate`
- `/ru/build/measured-value-gate`
- `/ru/build/paid-start-gate`
- `/ru/build/proposal-readiness`
- `/ru/build/renewal-expansion-gate`
- `/ru/consulting`
- `/ru/continuityos`
- `/ru/dogfood-self-audit`
- `/ru/guides`
- `/ru/mapper`
- `/ru/sample-deployment`
- `/ru/workspace`

Before any future bulk pass:
1. Re-measure the canonical RU route set from current production.
2. Translate user-facing prose only; do not change machine/state/query identifiers.
3. Preserve prices, offer boundaries, claim ceilings, authority boundaries and testing-authorization semantics.
4. Re-run route-specific functional verifiers before any push.
5. Keep one bounded push for the future translation batch.

## Glossary

Use these Russian forms in user-facing prose unless a token is explicitly preserved below:
- authority → полномочия
- authority boundary → граница полномочий
- evidence → доказательства
- external effect → внешний эффект
- proposal → предложение
- paid start → оплаченный старт
- measured value → измеренная ценность
- renewal → продление
- expansion → расширение
- delivery → выполнение / начало работ, depending on context
- recovery → восстановление
- owner decision → решение владельца
- scope → границы
- scope drift → изменение границ
- retest → повторная проверка
- baseline → базовая точка / baseline where it is an explicit artifact term
- observation window → окно наблюдения
- finding → finding where it names the formal artifact; otherwise вывод/наблюдение only if meaning is unchanged
- claim → заявление
- claim ceiling → граница заявлений
- runtime → runtime when it denotes the technical execution environment
- staging/test → staging/test
- production → production

Preserve exact artifact/product/protocol names when they are identifiers:
- BitEvo
- BUILD
- Authority Ledger
- Evidence Contract
- Finding Record
- Decision Memo
- MCP
- ROI
- NRR
- Rules of Engagement / RoE
- RETEST_CANDIDATE
- SCOPE_DRIFT
- CROSS_WORKFLOW
- ALLOW / DENY / HOLD / ESCALATE
- machine-readable JSON keys, query parameters, schema names and boolean/state tokens

## Non-goals

This plan does not:
- authorize testing;
- enable Scope Handoff;
- change production/staging authority;
- create new claims, cases, guarantees, results or metrics;
- alter prices or commercial scope.
