# BitEvo Seven Authority Gates R1

Status: `DOCUMENTATION_PROJECTION / NO_SAFETY_PASS / NO_CERTIFICATION / NO_TESTING_AUTHORIZATION`

This document is an inspectable projection of the seven authority gates used by the BitEvo diagnostic. It is not an independent source of truth.

Canonical source:

`mcp/bitevo-authority/src/diagnostic.mjs` → `DIAGNOSTIC_QUESTIONS`

A deterministic verifier compares every row below against that source. If the canonical source changes without this projection changing with it, `verify:core` must fail.

## The seven gates

<!-- B9:GATES:START -->
| ID | Gate | Diagnostic question | Why it matters |
| --- | --- | --- | --- |
| action | Authority Budget | Can you name the exact external action this workflow is allowed to perform? | If the consequential action is vague, the authority boundary cannot be tested. |
| object | Object binding | Can the workflow prove which exact object the action applies to before execution? | Correct permission on the wrong record, account or document is still the wrong effect. |
| owner | Authority owner | Is there a named role that owns the permission to perform this action? | Authority without an owner becomes difficult to approve, constrain or revoke. |
| evidence | Evidence Before Effect | Is the minimum pre-action evidence explicitly defined? | A workflow cannot fail closed on missing evidence if the evidence requirement is implicit. |
| freshness | Freshness | Does the workflow know when required evidence has become stale or invalid? | A healthy-looking service can still be operating on truth that stopped advancing. |
| confirm | External confirmation | Is the intended external effect independently confirmed after the action? | Internal completion or a tool acknowledgement is not proof that the outside system reached the expected state. |
| recovery | Recovery | When evidence or confirmation becomes uncertain, does the workflow enter a defined constrained/recovery state? | Retrying or continuing through ambiguity can turn one uncertain action into repeated effects. |
<!-- B9:GATES:END -->

## Interpretation boundary

The diagnostic accepts `YES`, `NO` or `UNKNOWN` for every gate. A `YES` means the description layer explicitly answers that gate. It does not establish that the workflow is safe, prove implementation correctness, certify a system, or authorize testing.

`NO` and `UNKNOWN` remain unresolved questions for the authority owner. They are not converted into a numeric trust or risk score.

## Inspectable source paths

- Canonical gate definitions: `mcp/bitevo-authority/src/diagnostic.mjs`
- Diagnostic implementation and output semantics: `mcp/bitevo-authority/src/diagnostic.mjs`
- Parity verification for this document: `scripts/verify-b9-public-seven-gates-r1.mjs`
- Provider-neutral gate chain: `npm run verify:core`

## Effect boundary

This documentation grants no authority to mutate repositories, providers, customer systems, wallets, exchanges, trading systems or capital. It does not unblock C4/N14 and contains no live-trade evidence.
