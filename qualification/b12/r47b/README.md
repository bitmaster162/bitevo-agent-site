# R47B — isolated qualification, LOCAL ONLY / R1 + F1 local hardening (2026-10-14)

## Authorization and baseline

Approval: `APPROVE_BITEVO_R47B_ISOLATED_QUALIFICATION_LOCAL_ONLY_R1`.
Repository: `bitmaster162/bitevo-agent-site`.
Baseline: `622d4580c8953688e26cb4ab9fc67825087b8428`.
Tree: `bf97d795936e31cb03ed5f60fcb9d5a06b04e1e3`.

Exactly five new source files are admitted under `qualification/b12/r47b/`:
`README.md`, `manifest.json`, `admission.py`, `test_admission.py`,
`expected-observed.json`. No existing runtime, lockfile, build configuration,
deployment configuration, published Privacy page or production guard is changed.

This package uses Python 3.11+ and the standard library. No package install,
cloud-resource creation, actual event POST, D1 write, credential access, source
commit, push, PR, merge or deploy is authorized. The separately admitted native
coordination lease controls concurrent local work; it is not a provider-test grant.

## What is implemented

`manifest.json` is a strict offline proposal. Known production anchors are pinned.
Unverified production account/database/namespace IDs, all isolated IDs, inventory
references, budgets, retention and cleanup decisions remain `null`. Unknown does
not mean zero, absent data, an empty account or an approved default.

`admission.py` validates this proposal, the local Git baseline and 13 protected
source files. It rejects unexpected fields, duplicate JSON keys, nonfinite
numbers, resource collisions, changed guards and attempts to claim live authority.
It provides pure budget arithmetic and evaluates synthetic before/receipt/after
observations bound to the same row and isolated target.

Every result sets `execution_authorized=false`. There is no live executor,
request builder, URL fetcher, secret loader or automatic retry. A fully populated
synthetic fixture may reach `DRY_RUN_COMPLETE`, never cloud execution. Inventory
references, digests and reviewer names in JSON are declarations, not authenticated
proof; `provider_identity_verified` therefore stays false.

## Run without installation

From the repository root:

```text
python -B qualification/b12/r47b/admission.py --root .
python -B -m unittest discover -s qualification/b12/r47b -p test_admission.py -v
```

The shipped manifest is expected to produce `HOLD`, exit **2**: missing IDs and
owner decisions are not filled with fictional values. Invalid input, unsafe
changes or a wrong baseline exit **3**. A complete declared/synthetic proposal
exits **0**, still with no execution authority. Unsupported flags such as
`--execute` are rejected by argparse.

The validator uses fixed local Git rev-parse, cat-file, ls-tree and status
reads, plus fixed public source-file reads. It does not fetch remote refs. Fresh remote-main and lease
checks remain the operation controller's responsibility. The local validator
cannot prove that GitHub or a provider account has not changed.

The test suite installs a process audit hook blocking socket connections, binds,
DNS calls and non-memory SQLite. `-B` prevents bytecode files. Fixture IDs,
timestamps and numeric limits are test inputs only, never real provider settings.

## Isolation and production boundaries

The existing ingress requires the designated Vercel production environment and
project. Ordinary Preview is not a substitute. Spoofing production environment
values to bypass the ingress guard is forbidden. The proposed future trial goes
directly to a separately reviewed isolated Worker; it does not qualify the
browser-to-Vercel or Vercel-to-Worker delivery paths.

The public client remains `data-bitevo-events="disabled"`. The approved limited
Privacy Disclosure is not approval for event retention, public activation,
provisioning, provider-log processing or use of real visitor data.

A shared Cloudflare account may contain disjoint workloads. The isolated database,
Worker, receiver URL, rate-limit namespace and Vercel project must not equal the
corresponding production resources. Unknown production database or namespace IDs
block proof of separation just as unknown test IDs do. Raw secrets must not be
placed in this manifest. A future credential workflow must verify isolated secret
references without exposing or reusing production secret values.

## Expected versus observed

`expected-observed.json` is a versioned test specification, not a generated result
or provider receipt. Its provider observations are deliberately null. Actual local
results belong in a separate source-bound run audit.

Before a real trial, obtain separately scoped owner approval and independent,
fresh provider inventory for the exact account, project, Worker, database and
bindings. Verify access, exclusive test-writer conditions, budgets, rate-limit
profile, retention and data-disposition rules. JSON declarations alone must never
issue authority.

A future real test would require a complete independent baseline read of one
agreed synthetic row, one event attempt, an explicit write receipt and an
independent after-read of the same target and row. Positive delta must be **+1**;
approved rejection/OFF scenarios require **0**. HTTP 200 alone is not a receipt of
an independently verified increment. An incomplete report or missing baseline is
not zero. The existing unpaginated report limits results to 500 rows, so absence
from it does not establish complete coverage.

Unknown write outcome means STOP and independent readback, never an automatic
second POST. Even +1 after an ambiguous response does not prove unique attribution;
the evaluator keeps that case on HOLD. A count change does not prove an email,
appointment, sale, unique visitor or exactly-once delivery.

The SQL test runs the actual baseline schema and UPSERT in SQLite `:memory:`.
First execution yields 1; replay yields 2. This is not a D1 test or a deduplication
claim. Negative schema tests leave the counter unchanged. No disk database is
created and no cloud request is made.

Disablement, deletion and rollback are distinct. Disabling a receiver does not
delete previously written data. Data disposition and its confirmation need
separate evidence. Rate limiting is not an exact aggregate counter or a global
cost budget. The separate 30-day request-retention rule is not an event-retention
default.

## Integrity and acceptance

Protected hashes normalize only CRLF to LF to accommodate the reviewed checkout;
all other bytes remain protected. The hashes are pinned in code, not supplied by
the manifest. The operation controller additionally compares all tracked files
against Git before and after the local suite.

R47B is deliberately not attached to `verify:core` or provider builds: doing so
would expand the authorized file scope. Acceptance requires the dedicated offline
suite and exact-scope/baseline verification. Prior full-site build results remain
historical; this step does not claim a fresh site build, deploy, browser execution
or visual audit.

Specification: RC. Implementation qualification is tied to the actual local run
and its evidence. Real-provider qualification and public activation remain HOLD
until independently verified under a separate approval.

## F1 local review hardening (14 October 2026)

The original 151 tests passed, but two additional boundary probes reproduced
validation gaps: numeric overflow such as `1e999` became infinity, and a trace
accepted inconsistent Worker name / URL declarations that the manifest rejected.
Neither issue granted execution authority; every result stayed non-executable.

F1 rejects nonfinite float results during JSON parsing, including nested values,
while preserving finite values and ordinary strings. The trace now checks the
same Worker name / URL relation before any receipt outcome is evaluated.

All 151 original test identities remain present. Nine new tests bring the suite
to 160. The new tests produce 15 failed assertions including subtests against R1;
the complete suite passes against F1. This is local synthetic evidence only.
The input manifest and expected-observed matrix are unchanged: unknown resource
IDs, budgets, retention and cleanup decisions remain null; the CLI returns HOLD.

Historical F1 persistence boundary: check_source pinned the exact baseline HEAD and tree.
A later source commit requires a separately reviewed baseline-admission policy;
this pre-commit run must not be presented as validation of a later Git identity.

## F2 persistence admission (14 October 2026)

F2 supersedes only F1's exact-current-HEAD persistence restriction. The original
baseline commit and tree remain pinned; none of the 13 protected SHA-256 values,
manifest values, provider restrictions or evidence rules is changed.

There are exactly two admitted local source shapes:

1. BASELINE_PRECOMMIT: HEAD is the pinned baseline. Exactly the five package files
   are untracked, or exactly all five are staged additions. Mixed staging, tracked
   changes and additional untracked paths are rejected. This does not stage them.
2. ONE_DIRECT_PACKAGE_COMMIT: HEAD has exactly one parent, the pinned baseline.
   The full committed tree must preserve every baseline path, mode, type and blob
   and add exactly the five named regular non-executable package files. Each added
   blob must match the current package bytes after CRLF-to-LF normalization, and
   git status must be empty. Missing/extra paths, symlinks, executable modes, dirty
   worktrees, merge commits, second commits and unrelated parents are rejected.

Raw commit objects are checked against their object IDs. Recursive tree listings
are reconstructed in memory and checked against the actual tree IDs; this covers
all 407 baseline entries, not only the 13 separate runtime/protection hashes.
The reader disables optional Git writes, replacement objects, fsmonitor and lazy
fetch. It checks HEAD again after the snapshot. It does not write commits, trees,
indexes or refs, install dependencies or fetch from any remote.

A matching lineage is not approval of the five files. The operation controller
must still compare a separately reviewed raw SHA-256 package manifest and obtain
explicit stage/commit/push authority with fresh remote and lease verification.
The in-repository checker is not an independent signer of its own code.
Every returned source decision retains execution_authorized=false and
candidate_review_required=true. Provider inventory and retention remain unknown.
The shipped proposal still returns HOLD.

The additional tests use synthetic commit/tree transcripts built from the real
baseline and package contents. Git hash-object without -w cross-checks the
synthetic commit ID; no candidate commit or object is persisted by the tests.
This tests the admission algorithm, not an actual post-commit checkout or GitHub
CI run. The real future commit must be checked again after it is separately
authorized and created. Only the first direct package commit is covered; further
commits or a merge require a separately reviewed policy, not ancestry widening.

All 160 F1 test identities are preserved. F2 adds 32 persistence tests. Site
builds, cloud writes, production checks and data collection are outside this run.
