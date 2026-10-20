# R50-D ? required offline test admission, PR #242

Specification: Draft. Scope: CI only; no runtime activation. Baseline feature
HEAD bee8f828c7643d6aa0c1511f9c465fcf30383eca, production base
b34f31a984efa26676c00deae16b904c42fb29c8.

## Enforced chain

package.json appends exactly one explicit node --test --test-reporter=tap
command for b1-2-r50-operator-admission.test.mjs and
b1-2-r50-durable-grant.test.mjs to verify:core. build:core already executes
verify:core, and the existing required quality-gate job executes build:core.
A failing R50 assertion therefore returns nonzero and fails that existing
job. No optional step, continue-on-error, skip filter, package install,
new workflow or new independent required-status claim is introduced.
The local Chrome browser rehearsal is NOT added to CI: it is a separate
Windows-specific offline fixture, not part of this Node/SQLite contract.

## Historical source pins and package scope

The R50 protected-file test previously depended on git show for old Git
objects. To support shallow GitHub/provider clones, it now checks fixed
normalized SHA-256 digests extracted from the SAME production base before
any R50-D change. All 15 protected file contents were verified equal to
that base. There is no fallback accepting missing references. The old
package restriction is replaced only by an exact suffix exception:
removing that suffix must yield the exact original semantic package hash.
Negative tests reject missing or duplicate commands, omitted durable suite,
--test-name-pattern filtering, || true, skipped privacy, changed build:core
or unrelated package values. Existing admission/runtime tests are retained.
The historical verifier-release-manifest payload is untouched; its test
allows only this exact package change while preserving all previous pins.

## Proof boundaries

Local Node/SQLite tests prove the tested source behavior, not Cloudflare
D1 distributed atomicity, live grant provisioning, signed production
interoperability, booking, or any event write. Browser bootstrap remains
OFF, the public event Worker/config and aggregate schema are unchanged.
No R50 test contacts production: network hooks throw on unmocked requests;
file-backed SQLite lives under the OS temporary directory and uses only
synthetic fixtures. New test admission must be evidenced on the exact
pushed HEAD in CI and provider logs; local green alone is insufficient.
Do not mark Ready or merge without separate owner approval.
