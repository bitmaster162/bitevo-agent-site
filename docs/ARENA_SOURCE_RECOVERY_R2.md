# Sovereign Arena source recovery R2

Status: `READ_ONLY_RECOVERY_EVIDENCE`

This note records source-custody evidence only. It does **not** authorize Arena runtime changes, deployment promotion, trading, capital effects, credential changes, DNS changes, or deletion of older artifacts.

## 1. Recovered static base assembly

Google Drive contains two Arena HTML files:

- `index.html` — 15,108 bytes, Drive modified `2026-07-21T14:00:27.064Z`;
- `index-1.html` — 15,108 bytes, Drive modified `2026-07-21T14:48:14.441Z`.

Both raw files were downloaded and compared byte-for-byte during this recovery pass.

```text
SHA-256(index.html)   = d7c2a3780da6ac920b2fccc339d452be74b085d945aacf0dfa4c441c3e8a1949
SHA-256(index-1.html) = d7c2a3780da6ac920b2fccc339d452be74b085d945aacf0dfa4c441c3e8a1949
cmp                   = identical
bytes                  = 15108 each
```

Drive also contains a 15,108-byte HTML artifact whose title is exactly the same SHA-256:

`d7c2a3780da6ac920b2fccc339d452be74b085d945aacf0dfa4c441c3e8a1949`

This strongly identifies `d7c2...1949` as a content-addressed Arena static assembly artifact, not merely a coincidental filename.

## 2. What the recovered base contains

The recovered base already contains the core generation visible in the later Arena production lineage:

- title `Sovereign Arena — regime-aware strategy lab`;
- `BiTEvo · Sovereign Arena` branding;
- `Edge Matrix`;
- `8 live experiments`;
- public bot race / `Live League`;
- hero counters `81k+`, `157`, `90+`, `5`;
- `Battle of AI` and `3 Битвы`;
- the large services grid;
- research-lab / paper-only positioning and an honest-disclaimer section.

Therefore the July Drive artifact is materially newer than the old GitHub `sovereign-arena-site` main generation and explains the large source-vs-production drift previously observed.

## 3. Proven post-base mutation layer

The recovered base is **not** byte-identical to current production.

Current public Vercel readback contains additional mutations including:

- injected sticky Arena navigation and ecosystem footer;
- later `Regime Radar` public token `b9af05da5ff34fc894a6cc9741545fa6` instead of the older token in the recovered base;
- additional public-surface links, including the separate Arb Radar;
- later Telegram-link changes;
- a later `AI-Agent Reliability Audit` commercial card whose claim ceiling conflicts with current BitEvo doctrine.

A separate Drive project note, `project_radar_public_fix_20260722.md`, explicitly records the Radar token evolution and states that `/`, `/pulse`, and `/boards` were updated when the public token changed to `b9af05da5ff34fc894a6cc9741545fa6`. It also records successive Arena production deployments during that repair sequence.

This proves that at least one post-base mutation layer existed after the `d7c2...1949` static assembly.

## 4. Reconstructed custody model

The best-supported reconstruction is now:

```text
old GitHub main
  !=
recovered July static base assembly
  SHA-256 d7c2a3780da6ac920b2fccc339d452be74b085d945aacf0dfa4c441c3e8a1949
  +
post-base site mutations / public-dashboard repairs / navigation changes
  =
current-looking Vercel Arena generation
```

This is a **partial source recovery**, not yet a canonical source reconstruction.

## 5. Remaining gap before source edits

Do not use old GitHub main as the production source baseline yet.

Still required before an Arena source repair branch can safely become canonical:

1. recover or reconstruct the exact post-base mutation operations that produced the current navigation/footer and later route/link edits;
2. census all current Vercel public routes against recovered Drive artifacts;
3. bind each recovered route to a content hash or trustworthy source artifact;
4. construct a candidate Git baseline from the recovered generation;
5. perform source → build → preview readback comparison against current production;
6. only then consider a separate promotion decision.

## 6. Immediate product-quality finding preserved

The current production generation still contains public claims that must be normalized before any future canonical promotion, especially the legacy `AI-Agent Reliability Audit` promise that production agents are safe in 72 hours. Source recovery must preserve the page as evidence while preventing that legacy claim from silently becoming the new canonical BitEvo commercial authority.

No merge or production promotion is implied by this recovery note.
