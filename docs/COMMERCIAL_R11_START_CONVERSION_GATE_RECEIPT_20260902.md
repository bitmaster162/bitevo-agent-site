# Commercial R11 — start conversion gate receipt

Status: validation receipt only; no merge or production deployment authority.

## Baseline
- R10 parent: `2d10b7eebe5aa12c01fa637a4bf5df389bd5e5f3`
- R11 gate commit before this receipt: `d71ec61893b65e39054d8e44d5f29a485465af81`

## New deterministic contract
`verify-commercial-start.mjs` runs inside `verify:core` and fails the build if the commercial start path regresses.

It requires:
- `/start` retains the $1,500 Entry Audit route;
- `/start` retains MCP / Tool Governance;
- `/start` retains the $3,000 BUILD Workflow Exception Diagnostic route;
- `/start` retains the $4,900 Primary Audit route;
- no-testing and no-secrets boundaries remain visible;
- `/pricing` retains `/start`, `/entry-audit`, direct Entry scope-prep and Mapper wiring;
- Free / $1,500 / $4,900 pricing invariants remain present.

The verifier is additive; existing public-quality and funnel gates are not weakened.

## Validation
GitHub provider-neutral CI and Vercel preview must be read back on the final R11 head before a green claim.
