# Commercial R9 — Vercel CSP sync receipt

Status: validation receipt only; no production deployment authority.

## Baseline
- R8 parent: `ccade46d0a2d28ec58d4ba9594e22155d12d9e5f`
- R9 CSP-sync commit before this receipt: `20a3c861547d62ae366b6d6275ee59ec1832a4ae`

## Reason
The Vercel provider policy gate reported eight missing `style-src` SHA-256 entries in `vercel.json`.

All eight exact hashes were already present in the canonical reviewed `scripts/csp-inline-allowlist.json`; the allowlist records them as reviewed Commercial R3 (3), R4 (2), and R5 (3) page-style hashes.

R9 synchronizes `vercel.json` to that already-reviewed allowlist. It does not add an unreviewed hash and does not enable `unsafe-inline` or `unsafe-eval`.

## Provider readback
Vercel preview deployment for commit `20a3c861547d62ae366b6d6275ee59ec1832a4ae` reached `READY`:
- deployment: `dpl_AiwjS3xXu33F3RyS7JnfnT2ZKRWv`
- environment: preview / target null

This is not a production deployment or production-routing change.

## Remaining validation
GitHub provider-neutral Quality Gate must pass on the final R9 head before R9 may be called green across both validation surfaces.
