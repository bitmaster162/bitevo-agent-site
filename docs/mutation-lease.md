# Site mutation lease R1

Status: local implementation candidate. Not yet activated as a required GitHub merge control.

## Purpose

The site mutation lease serializes repository mutations performed by cooperating writers. It is designed to prevent two agents from independently acting on the same `main` snapshot and both proceeding as if they were the sole writer.

The canonical coordination ref is:

`refs/heads/coordination/site-mutation-lease`

Each lease transition is represented by a Git commit containing only `lease.json`. The new lease commit names the previous coordination commit as its parent. The update is published with a normal non-force `git push`.

This gives the lease a Git-native compare-and-swap property: two writers that build children of the same lease tip cannot both advance the remote ref. The second stale update is rejected by the Git server as non-fast-forward.

## Evidence boundary

R1 is a coordination control for writers that invoke it. It does **not** by itself prevent a writer with repository permissions from bypassing the CLI and mutating another branch directly.

Server-side merge enforcement is intentionally deferred to a separate activation lane. The intended later activation is a required `mutation-lease-audit` check in protected `main`, after the local protocol is reviewed and merged.

## Lease object

The lease records:

- exact repository remote and target ref;
- exact `main` base SHA;
- lease ID and rotating nonce;
- owner and session identifiers;
- exact worktree path;
- state and timestamps;
- caller-supplied expiry;
- exact sealed feature ref, head SHA, and tree SHA when applicable;
- predecessor coordination commit.

R1 does not define a universal lease duration. `acquire` and `transfer` require the caller to provide an explicit future expiry timestamp.

## States

| State | Meaning |
| --- | --- |
| `ACTIVE` | Owner may work, run pre-push checks, or perform an update-branch operation. |
| `SEALED` | Candidate is immutable for Ready/merge: exact feature ref, head, and tree are bound. |
| `RELEASED` | Lease no longer authorizes mutations; another writer may acquire a child lease. |

An expired non-released lease may be superseded by a new `acquire`, but it never passes `check`.

## Required sequence

1. Verify the repository baseline and obtain the exact approved `main` SHA.
2. `acquire` the lease with owner, session, worktree, nonce, and caller-selected expiry.
3. Before a feature push, run `check --phase push`.
4. Push the feature branch normally.
5. `seal` the lease against the already-published feature ref. Seal fails if the remote feature ref is not exact local `HEAD`.
6. Before Ready, run `check --phase ready`.
7. Before merge, run `check --phase merge`.
8. After terminal production evidence, `release` or explicitly `transfer` the lease.

`check` also rejects a lease when remote `main` no longer equals the recorded base SHA, when owner/nonce/worktree differ, or when the lease has expired.

After sealing, `ready` and `merge` additionally require:

- local `HEAD == sealedHead`;
- local `HEAD^{tree} == sealedTree`;
- remote feature ref `== sealedHead`.

An update-branch action is permitted only while the lease is `ACTIVE`. A sealed candidate must not be updated in place; it must return through an explicit new coordination decision.

## CLI

Package entrypoints:

- `npm run lease:site -- <command> ...`
- `npm run verify:site-mutation-lease`

Acquire example:

```text
npm run lease:site -- acquire --remote origin --base-sha <MAIN_SHA> --owner <OWNER> --session <SESSION> --nonce <NONCE> --expires-at <ISO_TIMESTAMP>
```

Pre-push check:

```text
npm run lease:site -- check --remote origin --owner <OWNER> --nonce <NONCE> --phase push
```

Seal a published feature branch:

```text
npm run lease:site -- seal --remote origin --owner <OWNER> --nonce <NONCE> --feature-ref refs/heads/<FEATURE_BRANCH>
```

Ready and merge checks use `--phase ready` and `--phase merge` respectively.

Transfer rotates authority and the nonce, clears any previous seal, and returns the lease to `ACTIVE`:

```text
npm run lease:site -- transfer --remote origin --owner <OLD_OWNER> --nonce <OLD_NONCE> --next-owner <NEW_OWNER> --next-session <NEW_SESSION> --next-worktree <PATH> --next-nonce <NEW_NONCE> --next-expires-at <ISO_TIMESTAMP>
```

Release example:

```text
npm run lease:site -- release --remote origin --owner <OWNER> --nonce <NONCE> --reason <REASON>
```

`status` is read-only and displays the current coordination object.

## Harness coverage

The harness creates a temporary local bare Git remote and real clones. It exercises:

- concurrent acquisition from the same coordination tip, with exactly one accepted writer;
- owner token and worktree mismatch rejection;
- explicit transfer and authority rotation;
- expiry rejection;
- remote `main` drift rejection;
- requirement that a feature ref be published before sealing;
- exact sealed head and tree binding;
- remote feature-ref drift rejection;
- local post-seal head drift rejection;
- release and subsequent reacquisition.

## Activation conditions

Do not claim this control is server-enforced merely because these files exist in the repository. Activation requires a separate reviewed change that makes a lease-aware check mandatory on protected `main` and verifies that the check cannot be satisfied by self-asserted untrusted metadata.

Until that activation is complete:

- direct branch writes by a bypassing actor remain outside this control;
- `main-history-audit` remains a detective history control rather than a pre-action lock;
- branch protection and normal PR review/merge gates remain authoritative;
- manual provider deployment is outside the lease protocol and remains disallowed by the current site operating policy.

The coordination ref is deliberately separate from feature history. Lease commits should never be merged into `main`; only the implementation and later enforcement code belong in normal PR history.
