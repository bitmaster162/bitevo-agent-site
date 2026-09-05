# Scope Handoff R1 — isolated staging activation R1

Status: `P1G5_SOURCE_DRAFT / DEFAULT_OFF / NO_PROVIDER_EFFECT`

## Purpose

This layer prevents a generic environment switch from enabling the Scope Handoff UI or runtime in the BitEvo production project.

Activation is permitted only when all immutable provider-bound conditions match the isolated Vercel staging project and both explicit operator switches are present.

This document describes source behavior only. It does not authorize environment changes, Blob operations, browser POST, production activation or merge.

## Immutable binding

The exact allowed Vercel project is:

`prj_zQ1Mb8RJA6zCrZbPfC2z3dWFcfZI`

The exact activation mode is:

`isolated_staging_preview_r1`

Both `VERCEL_ENV` and `VERCEL_TARGET_ENV` must equal the exact string `preview`.

`VERCEL` must equal the exact string `1`.
## Explicit switches

The shared runtime/UI boundary also requires:

- `SCOPE_HANDOFF_R1_ACTIVATION_MODE=isolated_staging_preview_r1`
- `SCOPE_HANDOFF_R1_ENABLED=true`
- `SCOPE_HANDOFF_R1_UI_ENABLED=true` for browser UI activation

Runtime may be enabled without browser UI only when the first two switches and every immutable provider binding match. Browser UI can never enable unless runtime is also enabled.

Matching is exact and case-sensitive. Values are not trimmed or coerced.

## Decision matrix

| Context | Runtime | Browser UI |
|---|---:|---:|
| Missing provider values | disabled | disabled |
| Production project with all switches | disabled | disabled |
| Exact staging project, production target | disabled | disabled |
| Exact staging project, preview, mode absent | disabled | disabled |
| Exact staging preview, runtime switch only | enabled | disabled |
| Exact staging preview, runtime + UI switches | enabled | enabled |

A missing, malformed, inaccessible or throwing environment source resolves to disabled.

## Browser binding

EN and RU intake pages evaluate the shared predicate during static build. They expose only a versioned public marker on the existing controller script tag.

The browser source accepts only the exact marker `isolated_staging_preview_r1`. Generic values such as `enabled`, `true` or another version are rejected.

The staging project ID is not emitted into the public browser controller.
When the marker is disabled or absent, the controller does not mount the online handoff shell and performs no application request.

## Runtime binding

The Vercel function evaluates the same shared predicate before creating the rate limiter or intake store.

Failure of the predicate returns the existing fail-closed response:

```json
{"status":"SERVICE_DISABLED","provider_io":0,"testing_authorization":false}
```

A true runtime decision does not bypass the existing rate-limit configuration, schema, secret, origin, idempotency or storage-reconciliation gates.

## Required evidence before any staging activation

A future effect gate must verify the exact project ID, preview target, source SHA, private empty Blob store and complete environment plan before changing provider state.

It must define bounded synthetic IDs, maximum POST count, cleanup, final disabled deployment and independent readback.

No production threshold is selected in P1G5.

## P1G5 non-effects

- Production source activation: 0
- Production environment mutation: 0
- Staging environment mutation: 0
- Blob read/write/delete: 0
- Browser/application POST: 0
- Merge: 0
- Production promotion: 0
- Branch deletion: 0
- Outbound effect: 0
- Spend or plan change: 0
## P1G5 terminal

```text
ACTIVATION_BINDING = EXACT_STAGING_PROJECT_AND_PREVIEW
RUNTIME_DEFAULT = DISABLED
UI_DEFAULT = DISABLED
PRODUCTION_PROJECT_CAN_ACTIVATE = NO
PRODUCTION_THRESHOLDS = UNSET
PROVIDER_EFFECT = 0
```

## CSP review note

Adding the build-time activation import changes Astro's concatenation order for the existing RU audit-intake scoped style block.

Direct comparison against the prior production page proved both blocks are 4,998 bytes and one is a pure cyclic rotation of the other at offset 955. No CSS rule was added or removed.

The reviewed style hash was therefore replaced atomically in `scripts/csp-inline-allowlist.json` and `vercel.json`; the stale hash was not retained.
