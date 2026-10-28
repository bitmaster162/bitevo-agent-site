# R50-H — Cloudflare isolated staging preparation (2026-10-26)

**Status:** LOCAL_PASS / CLOUD_AUTH_HOLD. Staging has not been provisioned, no provider D1 queries or writes, no Worker publish, no real events, no CTA or Cal.com navigation, no production environment or secrets accessed.

Source baseline `bitmaster162/bitevo-agent-site` at `685c9833db261dd3f39d8edcd663290b11b5f0e3`, tree `a36a2fa98584dc211f8eaa4c104e58773f4f47d8`. Coordination lease readback before publication required. Public client disabled and public API GET 404.

## Resources and boundaries

- Worker exact name: `bitevo-r50-staging-20261026`, D1 exact name: `bitevo-r50-staging-20261026`. Both new; no existing resources reused.
- D1 config ID is intentionally `00000000-0000-0000-0000-000000000000`, a **NON-DEPLOYABLE placeholder**. Only replace in separately generated staging copy after independent provider inventory/readback.
- Explicitly denied D1 UUIDs: BitEvo production `b533a76e-ddd0-406b-9449-94e878bc2c50`, school `1de9ec7f-5d92-4edd-a069-ec5296b54b82`.
- Never deploy `wrangler.r50-grant.jsonc` or `wrangler.jsonc`, change Vercel Preview flags, use production secrets, or enable B1.2 public browser counter.
- Staging Worker handles only `/r50/claim` and `/b1-2/event`, both **OFF by default**; other routes return 404. No ASSETS/public client or access to `/event-report`.
- A single isolated D1 includes three tables (grant, ledger, aggregate), with the two handler bindings mapped internally. SQL migrations are byte-identical to qualified G3-L2/L3 originals.
- Staging uses synthetic HMAC material only. Token/secrets and raw IP are not persisted. Request ID, date/page/locale/time are stored in the ledger, a **new privacy surface; production use remains prohibited**.
- Staging synthetic active rows must be cleared promptly; Cloudflare D1 Time Travel and provider logs may retain history beyond clearing live rows. Do not state total deletion within 24 hours.

## One command — offline (no login)

Run from the Windows PC:

```powershell
& 'D:\BITEVO_R50H_STAGING_KIT_685C983_20261026_R1\scripts\r50h\run-local.ps1'
```

This rechecks the pinned Git baseline, rejects any production D1 identity in staging config, runs a real Miniflare + isolated local D1 trial and the G3-L2/L3 regression tests, cleans only the synthetic **rows inside this disposable local test database**, records an evidence manifest and receipt. There are no network calls to Cloudflare. No installed dependencies or files are deleted.

## Post-OAuth provider procedure (NOT YET EXECUTED)

1. Re-authenticate Wrangler using the scoped command in the handoff; `wrangler whoami`, account ID, plan/billing/usage and current D1/Worker inventory must pass. If any paid resource/payment prompt/plan change is shown, **STOP**. Error 10000, 502 or 503 => **STOP without retries; use readback**.
2. Verify `main`, coordination lease, Vercel alias/version and `/api/event=404` again, source SHA exact, Draft PR with Vercel auto-preview disabled.
3. Create new D1 `bitevo-r50-staging-20261026` with `wrangler d1 create` **once**. Read back the UUID; it must not be any existing DB. If command result is ambiguous, do not create again.
4. Generate an untracked staging config copy using returned UUID, never modify/deploy checked-in production configs. Apply `schema/r50h/001-grants.sql`, `002-event-aggregate.sql`, `003-event-ledger.sql` only to exact staging DB with `wrangler d1 execute bitevo-r50-staging-20261026 --remote --file <file>`. Verify table names/SQL before inserting data.
5. Deploy new Worker `bitevo-r50-staging-20261026` in OFF mode only, then read back exact Worker version/bindings; never use production secrets or bindings. Generate a fresh local synthetic test secret (not the production secret), keep it out of source control, turn on only staging Worker routes explicitly, and run synthetic signed tests. No Preview/Vercel environment impersonation.
6. Expected/observed: valid grant 200 once; replay 409; signed event 200 once and same requestId 409; concurrent same-grant 200/409; bad HMAC 401; mismatched/expired grant rejected; dropped acknowledgment readback without retry; trigger failure leaves no new ledger write. All failures fail-closed, cloud D1 rows count independently.
7. Immediately after synthetic trials, execute `scripts/r50h/cloud-cleanup.ps1 -DatabaseId <VERIFIED_NEW_UUID> -Execute`, read back three table counts and sum of aggregate counts as zero; keep D1/Worker until Claude/Robert verification. Cloudflare Time Travel and logs remain per provider retention.
8. Record Worker ID/version and D1 UUID, Draft PR URL/head SHA, scenario results, before/after rows, binding isolation, provider billing/usage cost observation. A plan Free does not prove actual account billing without provider readback.

`scripts/r50h/cloud-readback.ps1` and `cloud-cleanup.ps1` contain exact-identity checks and no resource deletion. They are **not** automatic cloud runners; no cloud call is authorized or performed in this local package.

## Local result scope

- R50-G3-L4R historical evidence: Chrome 390 and 1280; 204/204 tests, 88/88 core; SHA of receipt `926e58fc00f36fa967ec495eef529b3c5eb250d01ced9ee104af8f3f4bc76dfd`.
- This R50-H package: 15/15 Miniflare/D1 trial; 12/12 G3-L2/L3 regression; 12/12 staging-kit static boundary tests. Local result is not Cloudflare provider qualified; the cloud plan/current billing remains unproven.
- Git publication: Draft PR only, **without merge**. `git.deploymentEnabled["agent/site-r50h-staging-trial-20261026-r1"]=false` is the only deliberate tracked main-site config change, solely to suppress Vercel preview deploy from this branch.
