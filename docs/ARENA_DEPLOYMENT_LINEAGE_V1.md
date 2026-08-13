# Sovereign Arena — deployment lineage and first-party dependency census V1

Snapshot: 2026-08-13 15:55 UTC / 22:55 Asia-Bangkok
Parent: BitEvo V3.3 ecosystem inventory
Task class: READ_ONLY_FORENSIC

## Invariant

`PAGE_200 != DYNAMIC_HEALTH`

No Arena production state was changed during this pass.

## Final direct-upload production sequence

The last three production deployments in the current direct-upload generation are all Git-unbound and were created within one release window:

| Deployment | Created UTC | Created BKK | State | Observed root mutation |
|---|---|---|---|---|
| `dpl_DWBZoMWmQyPSs3FXyfag6XPJvMMk` | 2026-07-31 20:29:40 | 2026-08-01 03:29:40 | READY / production | shared `sa-topnav` present; Arb Radar present; no Grid VIP nav item; Telegram target `t.me/bitai1_bot` |
| `dpl_Gk4Au56UTDQqrygqVMe9yAM6qEmD` | 2026-07-31 22:34:35 | 2026-08-01 05:34:35 | READY / production | Grid VIP nav item added; root Telegram CTA moved to `BitmasterTm`; footer still retained `@bitai1_bot` wording/target |
| `dpl_9xeifLftSads4yq7F1osw1URjgX9` | 2026-07-31 22:37:19 | 2026-08-01 05:37:19 | READY / production | final observed navigation/CTA cleanup: `Канал` / `BitmasterTm` plus Grid VIP; current public alias resolves to this generation |

The current deployment build log shows:

- no Git clone;
- `Downloading 10 deployment files`;
- `Build Completed in /vercel/output [25ms]`;
- no prepared build cache.

Therefore the final production generation was assembled as uploaded deployment artifacts, not reproducibly rebuilt from the public Git main.

## What the sequence proves

The shared `sa-topnav` / `sa-footer` layer was already present before the final deployment and then mutated across successive direct-upload releases. The mutation sequence is independently visible in immutable deployment URLs.

This narrows the missing source problem:

- the base page artifacts are substantially recovered in Drive;
- the remaining unknown is not an abstract redesign, but the exact assembly/injection mechanism and final ten-file bundle used for the July 31 release window.

Classification: `ASSEMBLY_LAYER_SOURCE_MISSING`.

## Recovered first-party dependency graph

The recovered pre-navigation artifacts expose these relative dependencies:

| Source route | First-party dependency | Current public status | Classification |
|---|---|---:|---|
| `/` | `/guide` | 200 | OK_STATIC_ROUTE |
| `/` | `/pulse` | 200 shell | DEPENDENCY_SHELL_ONLY; nested API broken |
| `/` | `/grids` | 200 | OK_STATIC_ROUTE / YMYL_REVIEW_REQUIRED |
| `/` | `/continuityos` | 200 | OK_STATIC_ROUTE |
| `/` | `/api/pricing` | **404** | BROKEN_PUBLIC_FUNNEL_LINK |
| `/guide` | `/boards` | 200 | OK_STATIC_ROUTE |
| `/guide` | `/continuityos` | 200 | OK_STATIC_ROUTE |
| `/guide` | `/grids` | 200 | OK_STATIC_ROUTE / YMYL_REVIEW_REQUIRED |
| `/guide` | `/pulse` | 200 shell | DEPENDENCY_SHELL_ONLY; nested API broken |
| `/ai-audit` | `/guide` | 200 | OK_STATIC_ROUTE |
| `/research-log` | `/ai-audit` | 200 | OK_STATIC_ROUTE / CLAIM_REVIEW_REQUIRED |
| `/research-log` | `/guide` | 200 | OK_STATIC_ROUTE |
| `/triage` | `/ai-audit` | 200 | OK_STATIC_ROUTE / CLAIM_REVIEW_REQUIRED |
| `/triage` | `/continuityos` | 200 | OK_STATIC_ROUTE |
| `/pulse` | `/api/pulse` | **404** | FALSE_GREEN_RUNTIME_DEFECT |
| `/grids` | `/guide` | 200 | OK_STATIC_ROUTE |
| `/boards` | `/guide` | 200 | OK_STATIC_ROUTE |

`/continuityos` recovered page artifact does not depend on another relative first-party route in its pre-navigation body.

## Duplicate artifact convergence

Drive contains repeated copies of several Arena page outputs. Two independently retrieved copies were compared for each of these route families:

- `/grids`: `1IPnRG5DSAWNw_qAq4-lnJz4kS0SBDzvd` and `1UOCy0wrXxslkMub2zqlS0vkdoUwIrgVd` are both 9869 bytes and both hash to `258c6c40e39b05a9f214bd09115a4f6e1747d52f033ac16c5ba5cc7e5fe34f99`.
- `/triage`: `15KQPaODXyMJ9qZjMv7FUGzS7RULM39ym` and `15hr5SJaiiDP0nqU3RMD8RYLjucsg0fbz` are both 8377 bytes and both hash to `2be3fef40a1f8cc64e1f331ee50be2fc4ecfab554426e0f3c96f82355aa3f774`.
- `/continuityos`: `1tnbd8lf2CQwT7IxhlrL9_CgWPbavp84P` and `1lZqOnz3M6tQowpLWyUhvfwtHw_q7NACY` are both 16847 bytes and both hash to `324c54855d4c02c39e7faabe3463be6354769c6c1f24f0670f828aa146dc0961`.

This removes filename-level ambiguity for the sampled duplicates: each sampled pair is byte-identical.

Together with already content-addressed artifacts, the recovered page-output spine now has immutable digests for:

- root: `d7c2a3780da6ac920b2fccc339d452be74b085d945aacf0dfa4c441c3e8a1949` (15108 bytes);
- guide: `6d4c6f969e8edac63dcbcddb1b0572710e60f296c2ff42a7d37d90775a2e4d5d` (10682 bytes);
- ai-audit selected snapshot: `ba32902bd1cf3f6eb6be97708e3950541828a238cab03c035b71a248c34d7bce` (14608 bytes);
- research-log: `e4024f14d02ae560384fe54c57c14f3dfbd6e88d6434de8158833969c9b6501d` (8724 bytes);
- triage: `2be3fef40a1f8cc64e1f331ee50be2fc4ecfab554426e0f3c96f82355aa3f774` (8377 bytes);
- pulse: `48a0b1fa5a0ecb3e268783ec49552daa5dda7963a1dfd910aa1c906cf4ed20da` (5548 bytes);
- grids: `258c6c40e39b05a9f214bd09115a4f6e1747d52f033ac16c5ba5cc7e5fe34f99` (9869 bytes);
- boards: `f3aa09ade1a311e8e54c27e5f159aca1e361bc118d0c7fa1c6fbd588e7e5992e` (15938 bytes);
- continuityos: `324c54855d4c02c39e7faabe3463be6354769c6c1f24f0670f828aa146dc0961` (16847 bytes).

The route bodies are therefore largely recoverable as immutable artifacts. The missing pieces are the exact final assembly layer, final per-route mutations, and any tenth deployment file not yet route-bound.

## Release-repair implication

Do **not** fix `/api/pulse` or `/api/pricing` by editing the old public Git main. That source is not the current deployment generation.

Correct sequence remains:

1. recover/derive the final ten-file deployment bundle and assembly layer;
2. reproduce current output offline;
3. establish a fresh Arena recovery branch from a verified reconstructed baseline;
4. in preview, repair broken dependencies and lower/qualify unsupported dynamic/commercial claims;
5. run route + dependency smoke;
6. only then request production-promotion approval.

## Parent BitEvo receipts

BitEvo V3.3 head `4feed902d7486f3505c7a99ae4ef965bd5c09dd0` completed GitHub Quality Gate #65 / run `31717326849` with `success` before this document was added. That receipt is ancestor-only; this new commit requires its own checks.

## No-effect receipt

Arena production, runtime services, trading, capital, DNS, aliases, paid-offer state and public messaging were not changed by this census.
