# R50 protected source successor — Guides API headers and Node 24, 2026-11-12

**Authority:** `D:\_EVIDENCE\CLAUDE_INBOX\20261112_2010_DECISIONS.md`, independent Opus `D:\_EVIDENCE\OPUS_BITEVO_PR252_REVIEW_20261112.md`. Draft PR #252 only; no merge, production deployment or new public claims approved.

## Material reason
Vercel serves prerendered `/api/guides` as an octet-stream without `X-Robots-Tag`, although `src/pages/api/guides.ts` has both headers. PR #252 adds an exact Vercel path-scoped static route/header rule and pins Node 24. Previously protected R50-B and R50-D tests correctly rejected changes to `vercel.json` and `package.json`. These are intentionally protected release contracts, not flaky tests.

## Authorized, fail-closed successor
- Do **not** replace, delete or loosen any historical `r50ProtectedSources` hashes, `r50Guides34SuccessorSha`, `r50RGapsSuccessorSha` or historical package digest `4e60d233a8f495bfe02ff270a2c01834b1ffcc2daa7c8e4900f7e4c81880e9a8`.
- `scripts/guides-api-node24-successor-r1.mjs` pins exact SHA-256 of six changed-surface inputs (Vercel config, package, two workflows, runtime contract, new four-case test), and requires the exact JSON/noindex route, `continue:true`, Node 24 and disabled review-branch deployment. Mutation/extra-path input must reject.
- R50 protected source verifier accepts a new `vercel.json` SHA **only when this exact complete successor predicate passes**. Other protected paths and all previous successor SHA remain fail-closed.
- R50 package digest checker preserves the historical accepted canonical package. The new alternative removes the two exact mandatory `verify:core` test commands before hashing and admits only the fixed successor package digest `7c12fdf05417b906fccdbbb170cd3f08e8e0b6f94b3ae8e47b4a73926b13541e` **and** exact successor predicate. All other package changes must reject; existing negative mutations remain tested.
- New `node --test --test-reporter=tap tests/guides-response-headers-node24-r1.test.mjs` is included *before* the original R50 mandatory three-file suffix in `verify:core`. Nothing removed from core gate.
- The historical R50 suite remains **90 tests**, without skipped, duplicated, weakened or excluded tests. Successor test negatives are added to an existing protected test rather than hiding old failures.

## Remaining independent gates
Local `npm run build:core` on Node v24.16.0 completed 0 with protected suite 90/90 PASS and new guide test 4/4 PASS. CI exact-head rerun and Opus independent re-review are required. Actual Vercel/Cloudflare deployments and served headers remain **unverified**. Workers Builds failure on prior PR head was observed; Cloudflare logs unavailable, so R50-based causality is *inferred*, not proven. No production release or merge until explicit approval.

Evidence: `D:\_EVIDENCE\BITEVO_GUIDES_HEADERS_NODE24_20261112\R50_SUCCESSOR_PIN_EVIDENCE_20261112.json`, `BUILD_CORE_20261112.log`, `D:\_EVIDENCE\BITEVO_GUIDES_HEADERS_NODE24_PR252_20261112.md`.
