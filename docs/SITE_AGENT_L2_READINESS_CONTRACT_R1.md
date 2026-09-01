# Site Agent L2 Readiness Contract R1

State: `SOURCE_PREPARED / NO LIVE WRITER / NO STORAGE AUTHORITY`

## Purpose

Define one deterministic precondition gate before any site lane can move from browser-local/human-handoff operation toward structured L2 intake. This contract prepares evidence and approvals; it does not create an endpoint, store a lead, or grant write authority.

## Required controls

A lane is not L2-ready until all of the following are explicitly approved and evidenced:

1. **Destination** — a specific approved storage/intake destination reference. Never place credentials, tokens or secrets in this config.
2. **Controller** — an identified responsible owner/controller reference.
3. **Retention** — an approved retention rule/reference.
4. **Access** — explicit approved roles that may access stored intake data.
5. **Privacy** — an approved privacy notice/policy reference for the intake path.
6. **Deletion / correction** — an approved method for correction and deletion requests.
7. **Idempotency** — a defined strategy that prevents duplicate writes/replays.
8. **Policy binding** — explicit binding to the current `SITE_AGENT_POLICY_PACK_R1` version.
9. **Synthetic test** — a passing synthetic/copied-data receipt identified by SHA-256.

The machine-readable shape is `docs/SITE_AGENT_L2_READINESS_SCHEMA_R1.json`.

## Decisions

- `BLOCKED_SCHEMA` — config is malformed, uses an unsupported lane/version, or contains undeclared fields.
- `NEEDS_L2_CONTROLS` — one or more required approvals/evidence items are absent or inconsistent.
- `READY_FOR_L2_POLICY_GATE` — controls are complete, but the lane policy has not explicitly granted L2 release authority.
- `READY_FOR_L2_DRY_RUN` — controls are complete and the policy explicitly grants L2; this means synthetic/copied-data dry-run readiness only.

## Non-authority invariant

Every readiness receipt has:

- `write_allowed=false`;
- `execute_authority=false`.

`READY_FOR_L2_DRY_RUN` is not permission to write production leads. A production writer requires a separately implemented adapter/effect gate, current policy authorization, idempotent receipts, synthetic validation and an explicit production approval. No current lane gains L2 authority from this contract.

## Current fleet interpretation

Current L0/L1/L1-review lanes remain below L2 until their own control bundle is approved. A verified WhatsApp, Telegram or phone handoff is not a storage destination approval. Owner response, public contact data, a generated brief, a copied JSON packet, a click or a preview does not satisfy the L2 gate by itself.

`destination.kind` is additionally checked against human-handoff/contact types. A WhatsApp, Telegram, phone, email, generic public contact or `human_handoff` route is rejected as an L2 storage destination even if a caller marks it `approved=true`.

Current source-state fixtures for the first four fleet lanes are recorded in `docs/SITE_AGENT_L2_LANE_FIXTURES_R1.json`. They preserve current PR heads, owner-intake state and verified handoff evidence separately from the readiness config. The fixture file intentionally keeps every storage control unapproved until an explicit approval/evidence source exists.

The second fixture wave is recorded separately in `docs/SITE_AGENT_L2_LANE_FIXTURES_WAVE2_R1.json` for HAVEN → Creator → Stas → BitEvo. It preserves the R6 source authority without mutating the first-wave evidence set. HAVEN, Creator and BitEvo have no approved human handoff in this L2 fixture context. Stas keeps the verified Telegram handoff to Robert as handoff evidence only; it is not a storage destination. BitEvo is bound to the exact source parent head used to create the wave rather than attempting a self-referential future commit SHA.

## Verification

`scripts/site-agent-l2-readiness-harness.mjs` covers incomplete controls, policy mismatch, access/deletion gaps, malformed schema, unknown lane, invalid synthetic receipt shape, current L0/L1 policy gating, and a synthetic L2-policy dry-run case.

`scripts/site-agent-l2-lane-fixtures-harness.mjs` verifies the Dar → Pharaohs → Yakov → Ivan priority fixtures, exact source heads, current blocked readiness state, and the regression that a verified phone/WhatsApp/Telegram handoff cannot be promoted into an L2 storage destination.

`scripts/site-agent-l2-lane-fixtures-wave2-harness.mjs` verifies HAVEN → Creator → Stas → BitEvo source bindings, blocked readiness state, absence of invented handoffs, Stas role label `Robert`, and the regression that the Stas Telegram handoff cannot be promoted into L2 storage.

The evaluator never produces write or execute authority.
