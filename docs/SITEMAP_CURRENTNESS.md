# Sitemap currentness

BitEvo sitemap `lastmod` values are bound to rendered route content, not to every repository build.

## Model

- `src/data/sitemap-currentness.json` stores one `lastmod` and normalized rendered-HTML SHA-256 fingerprint per indexable route.
- Normalization removes only the four build-receipt values injected into every page (`data-build-sha`, `bitevo-build-sha`, `data-public-build-receipt`, and the visible `Build <shortSha>` footer value).
- `npm run verify:sitemap-currentness` fails closed when an indexable route is missing/stale, a fingerprint drifts, or a manifest route becomes stale.
- `scripts/verify-public-quality.mjs` separately requires every sitemap `<lastmod>` to equal the corresponding manifest value.

## Content-change workflow

After a change that can alter rendered public HTML, run:

```text
npm run update:sitemap-currentness
```

The command builds once, updates fingerprints and `lastmod` only for routes whose normalized rendered HTML changed, rebuilds the sitemap, and verifies the result. Unchanged routes retain their prior `lastmod`.

For a controlled date, set `SITEMAP_CURRENTNESS_DATE=YYYY-MM-DD` before the command.

## Migration baseline

P12 initializes all existing routes from the sitemap date already published on 2026-09-19. It deliberately does not invent older historical modification dates. From this baseline forward, dates advance only when normalized rendered route content changes.
