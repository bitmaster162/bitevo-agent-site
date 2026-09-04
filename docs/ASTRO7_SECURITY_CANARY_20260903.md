# BitEvo Astro 7.2.10 security canary

Date: 2026-09-03 Asia/Bangkok

Status: CANARY_ONLY / DRAFT_PR_ONLY / NO_PRODUCTION_MERGE

## Baseline

Protected `main` at canary start:

`ae71e9948dff1b5e3a8d0d574db6ab38177ab095`

The production site is a static Astro build with a provider-neutral `dist/` postprocess/verification contract and separate Vercel / Cloudflare provider checks.

## Why this canary exists

The current dependency graph rooted at `astro ^6.4.4` reports known advisories. The current repository CI observed two high-severity and one low-severity audit findings in the Astro/esbuild/sharp dependency chain.

Relevant current advisory boundaries verified before this canary:

- Astro spread-attribute XSS `GHSA-f48w-9m4c-m7f5`: affected `<7.0.6`, patched `7.0.6`.
- Astro hydrated-island transition directive XSS `GHSA-7pw4-f3q4-r2p2`: affected `>=3.10.0 <7.0.4`, patched `>=7.0.4`.
- Astro reflected View Transition animation XSS `GHSA-4g3v-8h47-v7g6`: affected `>=2.9.0 <=7.0.9`, patched `7.1.0`.
- esbuild Windows dev-server path traversal `GHSA-g7r4-m6w7-qqqr`: affected `>=0.27.3 <0.28.1`, patched `0.28.1`.
- sharp/libvips inherited vulnerabilities `GHSA-f88m-g3jw-g9cj`: affected `<0.35.0`, patched `0.35.0`.

Because one Astro advisory is patched only at `7.1.0+`, staying on Astro 6.x cannot clear the known Astro advisory set. At canary creation, the latest stable `astro` release checked was `7.2.10`.

## Repo-specific migration scan

Before the canary, central review found:

- no `astro:transitions` imports in the default branch;
- no `@astrojs/db` usage;
- no `experimental.*` Astro flags;
- `astro.config.mjs` remains the minimal static `defineConfig({})` contract;
- Node engine is already `>=22.12.0`.

Astro 7 upgrades the build stack to Vite 8 / Rolldown. The repository does not currently declare custom Vite plugins or Astro integrations in `package.json`, which lowers but does not eliminate migration risk.

## Canary target

Change only the dependency graph needed to test exact:

`astro = 7.2.10`

Use npm to regenerate the lockfile. Do not hand-edit lockfile dependency resolution.

Do not add adapters, SSR, runtime endpoints, new Astro features, experimental flags or provider configuration.

## Required evidence

The canary is acceptable for review only if all of the following are true:

1. `npm ci` succeeds from the generated lockfile.
2. `npm audit` is captured after upgrade; remaining findings must be explicitly recorded, not hidden.
3. `npm run build:core` passes.
4. Existing public/RU/intake/CSP/build/commercial/identity/route/legacy gates remain green.
5. GitHub required jobs `quality-gate` and `main-history-audit` pass on the final exact head.
6. Cloudflare provider preview/build remains green on the final exact head.
7. Vercel provider result is reported honestly. The existing Hobby build-rate limit may block preview creation; a rate-limit status is not a code failure and is not a provider PASS.
8. Production `main` remains unchanged.

## Hard non-goals

This canary does not authorize:

- merge to `main`;
- production deployment/promotion;
- P1 Scope Handoff merge or runtime enablement;
- Blob provisioning or writes;
- Vercel plan upgrade/spend;
- DNS changes;
- Cloudflare runtime changes;
- email/form/CRM/LinkedIn effects.

## Concurrency boundary

PR49 (`agent/p1-scope-handoff-r1-implementation`) independently changes `package.json` / `package-lock.json` by adding `@vercel/blob`. Therefore this Astro canary must remain a separate draft PR. If either dependency PR is later authorized for merge, the other must be rebased/reconciled and re-run from the new protected `main` before any merge gate.

## Terminal expected state

`ASTRO7_SECURITY_CANARY = SOURCE_TESTED / DRAFT_UNMERGED`

`PRODUCTION = UNCHANGED`

## Final canary evidence

- Candidate: Astro 7.2.10, Node >=22.19.0, exact dev esbuild 0.28.1.
- npm audit: 0 known vulnerabilities.
- Parser migration is limited to closing the previously unclosed scoped <style> block in EN and RU Universe.
- Vite 8 compatibility bridge explicitly selects esbuild for JS/CSS minification. This is a temporary compatibility control because Vite 8 deprecates esbuild minification; future removal requires a separate CSP migration.
- CSP structure remains 97 HTML / 67 inline style blocks / 37 unique styles / 246 inline scripts / 13 unique scripts / 50 executable scripts / 196 JSON-LD.
- CSS proof covers every one of the 67 paired style blocks. Generated Astro scope IDs and equivalent media-range syntax are normalized; declaration order is normalized only when property identities are unique. Old/new unique style hashes map one-to-one. Exactly 1 of 37 reviewed unique style hashes remains byte-identical and 36 change.
- Script shape proof requires 11 of 13 reviewed unique script hashes to stay byte-identical. Exactly two changed hashes are permitted, one on EN audit-intake and one on RU audit-intake.
- Those two compiled page scripts pass differential jsdom 30.0.1 execution on Node 22.22.2 across initial state, Entry generation, Primary depth, EN mapper handoff, copy, download, reset and intake-segmentation marker behavior with a deterministic clock.
- CSP re-baseline therefore changes exactly 36 style hashes, preserves exactly 1 style hash, and changes exactly 2 script hashes only after semantic/behavioral proof.
- The canary branch quality-gate workflow was prepatched directly to Node 22.19.0 in exactly two locations; the finalizer verifies this state but does not rewrite workflow files.
- No production merge/deploy is authorized by this canary.
