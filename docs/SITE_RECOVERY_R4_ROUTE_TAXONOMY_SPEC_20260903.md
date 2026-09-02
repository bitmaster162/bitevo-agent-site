# Site Recovery R4 — Route Taxonomy + Legacy Commercial Reconciliation

Date: 2026-09-03 Asia/Bangkok
Stacked base: Site Recovery R3 exact head `87235d3935d2d9fbaa9b8e77fe718a9695195dad`
Mode: source/recon only; no production merge or deploy from this document.

## Why R4 exists

Current production has a real machine-readable IA split:

- `/start` is the current English commercial front door but is absent from the `## Canonical public routes` list in `/llms.txt`.
- `sitemap.xml` currently indexes commercial surfaces that are not part of the canonical ladder in `/llms.txt`, including `/assurance`, `/evidence-readiness`, `/control-validation`, and `/phuket-ai-workflow`.
- Several noindex aliases/archive/concept routes still compile and must be classified intentionally rather than deleted blindly.

The goal is one route ownership model. This phase does not create new SKUs or reprice any offer.

## Canonical route classes

Allowed classes:

- `FLAGSHIP` — primary brand/commercial entry and canonical decision ladder.
- `ENTRY` — bounded paid entry service.
- `SPECIALIST` — current specialist service or specialist buyer path that is deliberately subordinate to the flagship ladder.
- `TOOL` — browser-local decision or scope tool.
- `PROOF` — evidence, artifacts, build provenance, security or operator trust surface.
- `RESEARCH` — reviewed research/guides.
- `CONTEXT` — doctrine, ecosystem, action-context or project context.
- `LEGACY` — superseded historical commercial/alias/archive route; never promoted as current offer.
- `INTERNAL_NO_INDEX` — retained utility/concept surface not intended for search discovery.

## Commercial hierarchy

### FLAGSHIP
- `/` — brand/product overview.
- `/start` — English commercial front door.
- `/pricing` — canonical Free → $1,500 Entry → $4,900 Primary ladder.
- `/consulting` — service map; must remain subordinate to the same ladder rather than create a second pricing model.
- `/agent-authority-audit` — $4,900 Primary Audit.

### ENTRY
- `/entry-audit` — canonical $1,500 Entry Audit: one action chain + one primary hypothesis.

### SPECIALIST — current, subordinate, not replacement flagships
- `/control-validation` — fixed $1,500 Security Control Validation for one bounded software-control scenario. Keep current, but its parent must no longer be legacy `/assurance`.
- `/evidence-readiness` — fixed $1,500 evidence/procurement-readiness specialist scope. Keep as specialist; do not present as a second generic Entry Audit.
- `/build/exception-workflow-diagnostic` — $3,000 / 5-business-day BUILD exception diagnostic.
- `/mcp-governance` — MCP/tool-governance routing surface; current pricing remains hypothesis/bounded routing, not a new canonical flagship tier.
- `/coding-agent-governance` — coding-agent governance routing surface; not a claim of first-party integration.
- `/failure-recovery` — failure/retry/recovery specialist context.
- `/phuket-ai-workflow` — separate local implementation pilot. Keep as `SPECIALIST_LOCAL`; it must not redefine the global audit ladder. Keep current price/claims unchanged unless separately approved.

## TOOL
- `/mapper`
- `/workspace`
- `/diagnostic`
- `/audit-intake`
- `/mcp-governance-checklist`
- `/agent-identity-worksheet`
- `/trust-evidence-template`

## PROOF
- `/proof`
- `/artifacts`
- `/dogfood-self-audit`
- `/build`
- `/sample-audit`
- `/sample-message`
- `/sample-deployment`
- `/security`
- `/operator`
- `/ai-skill-lab-sample`

## RESEARCH
- `/guides`
- `/guides/ai-agent-reliability-audit`
- `/guides/security-sandboxing`
- `/guides/fleet-coordinator-drift-monitoring`
- `/guides/d3-tool-io-bridge-contract`

## CONTEXT
- `/doctrine`
- `/continuityos`
- `/ruap`
- `/universe`
- `/vision`
- `/consequential-actions`
- `/commerce-action-validation`
- `/reservation-action-validation`
- `/regulated-service-action-validation`

## LEGACY / exact route decisions

### `/assurance`
Current evidence:
- currently indexable in sitemap;
- exposes an umbrella `BitEvo System Assurance` with two separate $1,500 entry offers plus the $4,900 Primary;
- this conflicts with the canonical global ladder in `/pricing` and `/llms.txt`.

Decision: `LEGACY_COMMERCIAL_UMBRELLA`.
Planned treatment:
- remove from canonical/indexable discovery;
- preserve direct route temporarily as a noindex transition page rather than deleting history;
- point current-service navigation to `/consulting` and canonical buyer selection to `/start`/`/pricing`;
- do not silently delete the specialist scopes it used to aggregate.

### `/ai-audit`
Current evidence: already `noindex, follow`; alias text points to `/assurance`.
Decision: `LEGACY_ALIAS`.
Planned treatment: stop chaining to legacy `/assurance`; direct the alias to `/start` and `/agent-authority-audit` or use an exact permanent redirect after route-specific verification.

### `/intake`
Current evidence: already `noindex, follow`; explicitly says old general questionnaire retired and links to `/audit-intake`.
Decision: `LEGACY_ALIAS`.
Planned treatment: eligible for permanent `/intake` → `/audit-intake` redirect because semantic equivalence is explicit in source.

### `/inner-circle`
Current evidence: already noindex and explicitly archived; historical trading/subscription offer.
Decision: `LEGACY_ARCHIVE`.
Planned treatment: keep archive/noindex for provenance; do not reintroduce into sitemap/nav/llms canonical routes.

### `/crypto-risk-desk`
Current evidence: already noindex and explicitly archived; stale market/pricing claims intentionally removed.
Decision: `LEGACY_ARCHIVE`.
Planned treatment: keep archive/noindex; no canonical commercial role.

### `/digital-entity-setup`
Current evidence: already noindex and explicitly describes itself as an advisory concept, not a standardized current package.
Decision: `INTERNAL_NO_INDEX / CONCEPT`.
Planned treatment: retain only as context until a separate commercial decision; never list as a fixed current offer.

### `/concierge`
Current evidence: `noindex,nofollow`, local-only qualification utility, no automatic submission.
Decision: `INTERNAL_NO_INDEX / EXPERIMENTAL_TOOL`.
Planned treatment: retain isolated. Do not promote to buyer funnel until Site Agent/concierge value is separately revalidated.

## Sitemap policy

`sitemap.xml` should contain only deliberate indexable routes. Legacy aliases, archive routes and internal-noindex routes must never be emitted.

R4 Phase B will make the route registry the review authority for sitemap inclusion rather than maintaining independent ad-hoc route lists.

## llms.txt policy

`/llms.txt` must reflect the same route hierarchy, with grouped sections rather than a flat stale canonical list:

- Commercial / flagship
- Specialist scopes
- Browser-local tools
- Proof / trust
- Research
- Context

It must include `/start` as the commercial front door and must not present `/assurance` as canonical.

## Navigation / parent-map policy

- Header primary remains compact; R4 must not turn the header into a service catalogue.
- `/start` remains the first commercial routing decision.
- `/consulting` may expose a clearly subordinate Specialist Scopes section so specialist pages have an intentional parent without competing with the Free/Entry/Primary ladder.
- `/control-validation` should no longer use `/assurance` as its parent/back link.
- `/evidence-readiness` should no longer use `/assurance` as its parent/back link.
- `/phuket-ai-workflow` remains separate local specialist work; if linked from `/consulting`, it must be clearly labeled local implementation rather than audit-tier pricing.

## RU policy in R4

Do not expand RU here. Existing paired RU surfaces stay as-is. Full RU semantic parity is Site Recovery R5.

## Explicit non-goals

- no new SKU;
- no repricing;
- no ISO-certification or pentest positioning;
- no deletion of historical source/branches;
- no Site Agent restore;
- no analytics;
- no automatic scope transmission;
- no production merge/deploy under generic approval.

## Phase B implementation gates

Before a future R4 merge candidate can be considered green it must prove:

1. one canonical route registry exists;
2. sitemap contains all and only registry-indexable routes;
3. llms commercial/front-door hierarchy matches the registry;
4. `/start` is present as commercial front door;
5. `/assurance` is not canonical/indexable;
6. legacy/noindex/internal routes are excluded from sitemap;
7. specialist routes have an intentional parent map;
8. no canonical Free/$1,500/$4,900 pricing drift;
9. RU scope unchanged;
10. existing R3 identity/accessibility gates remain green;
11. no production effect until separate exact merge gate.
