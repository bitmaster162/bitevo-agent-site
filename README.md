# BitEvo Agent Site

BitEvo is the public product and evidence surface for authority-first AI-agent engineering. The site separates what source exists, what was built, what a provider deployed, what was read back, and what external effects were actually authorized.

`SOURCE != BUILD != DEPLOYMENT != READBACK != EXTERNAL EFFECT`

## Public surfaces

- `/` — product overview and trust boundary.
- `/agent-authority-audit` — canonical Authority & Evidence Audit offer.
- `/mapper` and `/workspace` — bounded public workflow tools.
- `/proof` and `/dogfood-self-audit` — evidence and internal dogfood boundaries.
- `/build` and `/version` — inspectable build/source receipts.
- `/universe` — evidence-bound ecosystem navigator; public URL existence is not runtime-health proof.
- `/ru/*` — paired Russian product layer.

## Architecture

This is a static Astro site. Build metadata is generated before compilation, then the built output is postprocessed and verified. Provider-specific policy checks run after provider-neutral core verification.

The release path is intentionally fail-closed:

1. source revision is identified;
2. build metadata records provider, ref and provenance class;
3. Astro renders the static site;
4. postprocessing adds paired locale/build receipts without executable inline code;
5. deterministic quality, trust, accessibility, budget, CSP and build-receipt gates run;
6. provider policy verifies that the receipt is bound to the expected provider/ref;
7. deployment readiness remains distinct from protected/public HTTP readback and from production promotion.

## Commands

```sh
npm install
npm run dev
npm run build:core
npm run build
npm run build:cloudflare
npm run preview
```

`npm run build:core` is provider-neutral. It may produce a `LOCAL_GIT` receipt when executed in a local Git checkout.

`npm run build` is the Vercel release path and requires a `PROVIDER_BOUND` Vercel Git SHA/ref. `npm run build:cloudflare` requires a `PROVIDER_BOUND` Cloudflare commit SHA/branch. Provider verification must fail rather than silently treating an unknown or empty provider/ref as release-grade evidence.

## Build receipts

- `/version` — human-readable source/build identity.
- `/version.json` — machine-readable receipt.
- `src/generated/build-meta.json` — generated source-side receipt used by the build.

A valid provider release receipt contains an exact 40-character Git SHA, a non-empty provider ref/branch and `provenanceClass=PROVIDER_BOUND`. A local Git build is explicitly `LOCAL_GIT`; unknown or malformed identity is `UNKNOWN_INVALID` and is never release-grade.

## Content security

The public site is self-hosted. CSP is defined in both `vercel.json` and `public/_headers`. `scripts/verify-inline-csp.mjs` scans built HTML and rejects executable inline JavaScript, inline `<style>` blocks and style attributes; inert JSON-LD is inventoried separately. The locale switch stylesheet is served from `/locale-switch.css` rather than injected inline.

## Provider boundaries

Vercel and Cloudflare are separate provider paths. A successful build on one provider is not evidence that the other provider, DNS/canonical origin, private runtime or production promotion is healthy or authorized.

No credentials, private hosts or secret-bearing runtime configuration belong in this repository or public build metadata.

## Safety invariants

This public site does not grant trading, wallet, exchange, runtime-control or capital authority. Production promotion, DNS changes, credential mutation and consequential external effects require separate explicit authorization.

`can_trade=false`

`capital_permission=DENY`
