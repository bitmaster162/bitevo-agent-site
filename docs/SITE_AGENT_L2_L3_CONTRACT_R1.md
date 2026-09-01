# Site Agent L2/L3 Contract R1

State: `SOURCE_PREPARED / STORAGE_DISABLED / EFFECTS_DISABLED`

## Purpose
Turn the browser-local concierge output into one normalized envelope that can later pass through a shared intake adapter and owner copilot without giving the agent uncontrolled authority.

## Flow
`site concierge -> SITE_AGENT_ENVELOPE_V1 -> policy evaluator -> optional L2 intake adapter -> L3 owner copilot -> human decision`

## L1 browser contract
- Raw answers remain in the visitor browser unless the visitor explicitly opens a verified human channel.
- The envelope may contain ordinary commercial/logistics context only.
- Passwords, API keys, access tokens, private keys, wallet seeds, card/CVV data, identity-document scans, medical records and biometric templates are blocked.
- A brief, copy, download, call, WhatsApp open or Telegram open is an intent/handoff event, never a booking, order, project, payment or conversion.
- Browser envelope states stop at `READY_FOR_HUMAN_REVIEW` / `READY_FOR_HUMAN_HANDOFF`; `CONVERTED` is deliberately not a valid `SITE_AGENT_ENVELOPE_V1` state. Evidence-backed conversion belongs to a downstream state machine after human decision and evidence receipts.

## L2 guarded intake adapter
Disabled by default. It may be enabled lane-by-lane only after all of the following exist:
1. approved intake destination;
2. documented controller/owner;
3. retention duration;
4. access roles;
5. deletion/correction path;
6. lane-specific policy pack;
7. idempotency key/receipt strategy;
8. synthetic-data test receipt.

When enabled, the adapter must validate schema, allowed intent, required fields, sensitive input, blocked claims, requested effects and release level before any write. A failed guard produces a local/returned receipt and no write.

R1 validation is fail-closed against `docs/SITE_AGENT_ENVELOPE_SCHEMA_V1.json` before lane-policy evaluation. Unsupported schema versions/states, additional properties, malformed field/effect shapes and invalid date-time values are rejected. Unknown requested effects are denied by default; only an explicitly verified L1 `human_handoff` can pass the effect gate.

## L3 owner copilot
Inputs: validated envelope + verified lane fact bundle + lane policy.

Outputs only:
- intent classification;
- missing information;
- short owner/staff summary;
- risk flags;
- reply draft for human review;
- exactly one suggested next action.

The copilot cannot send the draft, confirm booking/order, accept payment, alter price/availability, post, deploy, access an account or write downstream systems unless a later separately approved effect gate explicitly grants that action.

## Receipt contract
Every evaluation produces a receipt with:
- `decision`;
- `lane` / `intent`;
- schema errors;
- missing fields;
- sensitive matches;
- blocked claims/effects;
- release level;
- envelope SHA-256;
- `write_allowed` boolean.

In R1 `write_allowed` is always false for this shared adapter implementation.

## Production boundary
This contract is architecture and deterministic validation only. It does not create a live intake endpoint and does not authorize CRM storage, booking, ordering, payment, messaging, publishing or account access.
