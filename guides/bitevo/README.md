# BitEvo Research Library — bilingual authoring and translation contract (T1.4)

This directory is the **operator template and structural QA entrypoint**, not a source of published articles. The actual published research-note pairs live in **src/content/research-notes/**. Do not put a README.md or other unapproved Markdown in that content folder: **scripts/generate-research-notes.mjs treats every .md file there as a publishable research note** and requires the P30 frontmatter contract.

## Authorship, evidence and publication authority

- **English is the primary, Claude-authored and fact-reviewed language** for BitEvo Research Library.
- **GPT produces Russian as the secondary translation**, using the evidence, scope and caveats in the reviewed EN source. Translate rather than add assertions, capabilities, dates, numbers, customer outcomes or guarantees.
- Preserve uncertainty, provenance and the difference between source-backed reporting, source interpretation and inference. No unverified direct quotations. Keep technical names and BitEvo terms such as Authority Budget, Evidence Before Effect, False Green, object binding and External Confirmation stable.
- The three completed P30 EN/RU pairs (before-write-access, mcp-server-authority-review, bitget-authority-after-orchestration-compromise) are **already bilingual**. Do not retranslate, edit, re-review by implication or republish them under T1.4. The completed AI Skill Lab E2 pair and Crypto Guides T1.3 are likewise outside this work.
- A structural checker PASS does **not** establish the semantic fidelity or contemporary truth of the material and does not constitute owner approval, source review, merge approval or publication authorization.

## Real source files, routes and language direction

For each newly reviewed, separately approved research-note slug:

| Source | Primary EN | Translated RU |
| --- | --- | --- |
| Markdown | `src/content/research-notes/<slug>.en.md` | `src/content/research-notes/<slug>.ru.md` |
| Public route | `/guides/<slug>` | `/ru/guides/<slug>` |
| Frontmatter lang | `en` | `ru` |
| Frontmatter alternate | `/ru/guides/<slug>` | `/guides/<slug>` |

Both versions must use the **same slug**. The published P30 generator and verifier are authoritative for route, metadata, sitemap, llms.txt, JSON-LD and hreflang behaviour:

- Generator and existing frontmatter parser: scripts/generate-research-notes.mjs
- Canonical P30 publication / rendered-page verifier: scripts/verify-p30-research-library-r3.mjs
- Adjacent, read-only T1.4 checker: guides/bitevo/check_translation_parity.mjs

## Frontmatter template (placeholders — not publishable facts)

Primary EN candidate:

~~~yaml
---
site: bitevo.work
path: /guides/<slug>
alternate: /ru/guides/<slug>
lang: en
card: "NN · Research · <reviewed label and summary>"
title: "<reviewed English title>"
seo_title: "<reviewed English SEO title>"
description: "<reviewed English description>"
reviewed: YYYY-MM-DD
next_review: YYYY-MM-DD
related: [/agent-authority-audit, /diagnostic]
schema: [Article, BreadcrumbList]
research_source: "<exact reviewed attribution and evidence boundary>"
---
~~~

RU translation carries the same **site**, **reviewed**, **next_review**, **schema**, slug and card number; localise **path** to /ru/guides/<slug>, **alternate** to /guides/<slug>, **lang** to ru, **related** links to their already-existing /ru counterparts, and accurately translate the card label, titles, description, research_source attribution and body. Do not fabricate a source, change the review date or treat a pending source review as complete.

The P30 metadata uses **research_source** and **related**, not the Crypto Guides T1.2 sources/list or Astro page-layout fields. Do not copy the Crypto Guides frontmatter into this repository.

## Translation parity and independent review

For each pair, the adjacent checker must fail closed on incomplete/orphan Markdown and verify:

- the required P30 frontmatter fields, reciprocal EN/RU paths, schema, matching review/next-review dates, same card number, and related links in corresponding locale/order;
- identical H2 and H3 counts, Markdown table lines and non-separator semantic rows, and Markdown list-item counts;
- the same external URL **sets**, with source citations preserved (no invented links or altered attribution);
- equivalent numeric-token **sets** excluding URL digits, normalising decimal comma/dot and RU/EN spelled-out dates to YYYY-MM-DD; separately match normalised explicit date sets;
- in-memory positive and negative fixtures, including orphan Markdown, missing structural elements, altered external URLs, numbers and dates.

Number-set comparison is intentionally **set-based**, not an occurrence-by-occurrence multiset count: a translated paragraph may restate an existing timestamp without adding a distinct factual value. Set comparison cannot, by itself, prove that every number is attached to the same claim. Human review must check context, chronology, attribution and retained qualifications. The checker uses the existing P30 generator's exported parseFrontmatter and does not regenerate any public source or route.

Preserve P30's EN-first x-default policy, reciprocal hreflang, self-canonical, Article/BreadcrumbList JSON-LD and content review metadata. No SEO changes, new translations, route changes or producer/worker modifications are authorized merely by this contract.

## Local acceptance and release boundaries

Run from the repository root:

~~~sh
node --check guides/bitevo/check_translation_parity.mjs
node guides/bitevo/check_translation_parity.mjs
npm run build:core
~~~

Expected current source coverage: **3 EN/RU pairs, 6 already-reviewed P30 files**. The existing P30 verifier is part of build:core. Provider-bound npm run build (Vercel) and build:cloudflare are separate checks; a local build:core PASS is **not** a provider or production readback.

T1.4 work is limited to this README and adjacent checker. Do not modify the six source Markdown bodies, generated data, package scripts, generator, P30 verifier, workers, routes, CSP, redirects, canonical policy, provider configuration or protected main. Require separate scoped owner gates for staging/commit, feature push, PR, lease seal, merge and production verification.
