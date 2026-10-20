# R50-E — function packaging repair after PR #242 rollback

Specification: Draft. Implementation: local candidate; not deployed.
Baseline: fe69379a6cf4e8e8876130d3b60c9ddc2d643c36.
Public Vercel production is intentionally restored to b34f31a984efa26676c00deae16b904c42fb29c8.
No push, commit, PR, provider settings, D1 operation or live event is authorized in this local step.

## Confirmed failure and bounded repair

Vercel's deployed api/event.js imported r50-operator-admission.ts, but the
Node function artifact contained r50-operator-admission.js. Module loading
failed before the existing OFF handler could return 404. The old tests imported
TypeScript source directly and did not execute the emitted JavaScript package.

The repair sets compilerOptions.rewriteRelativeImportExtensions=true in the
root tsconfig.json used by the Node builder. It rewrites relative .ts specifiers
to matching .js paths during emit. It does not rename source files, add public
routes, alter authentication, enable telemetry, modify the grant protocol or
include secret files. No change to vercel.json/includeFiles is required.

Primary compiler reference:
https://www.typescriptlang.org/tsconfig/rewriteRelativeImportExtensions.html
Vercel Node configuration reference:
https://vercel.com/docs/functions/runtimes/node-js

## Two distinct evidence levels

1. Required offline CI: b1-2-r50-package-runtime.test.mjs compiles the actual
three function-source modules with the project's pinned TypeScript and root
configuration, moves only emitted JS and required JSON into a separate package,
and starts a clean Node subprocess with TypeScript loading disabled. It checks
404 for default OFF GET/POST, 503 for incomplete enablement, and zero network
attempts. It rejects the original no-rewrite output, missing direct/transitive
modules, missing coverage JSON, escaping handler paths and TS entrypoints.
This is COMPILER_DERIVED packaging evidence, not provider deployment evidence.

2. Local actual builder: the installed, unmodified @vercel/node 5.9.0 and
TypeScript 5.9.3 were invoked without deployment, account settings or npm install.
Its returned NodejsLambda files were materialized in an isolated directory.
The baseline reproduced ERR_MODULE_NOT_FOUND; the candidate artifact imported
successfully and returned OFF 404. The same standalone smoke checker accepts
that real artifact with --artifact-root. This is LOCAL_BUILDER evidence, not
an assertion that a fresh Vercel deployment has passed runtime verification.

The exact R50-D command suffix now includes the third packaging test suite.
The two pre-existing package-contract tests permit only that reviewed addition;
all original protected-file SHA-256 pins and release-manifest data remain intact.

## Commands and next release gate

node --test --test-reporter=tap tests/b1-2-r50-package-runtime.test.mjs
node scripts/r50-function-artifact-smoke.mjs --artifact-root PATH_TO_EXTRACTED_FUNCTION
npm run build:core

The compiler test uses the declared TypeScript devDependency. A local offline
BITEVO_R50E_TYPESCRIPT_PATH override is accepted only at that exact pinned version.
It is not a production environment variable and is not needed by installed CI.
Temporary test directories are uniquely created and removed; existing worktrees
and prior evidence are not reset or deleted.

Before any production publication: independently build a new Preview, invoke
its actual packaged /api/event with a read-only GET, confirm exact SHA and OFF
404, then seek a separate normal-merge/release approval. A green build badge or
source-only test is insufficient. Do not promote the previously broken release.
The grant Worker, D1 table/grants, operator-browser live flow and one-event trial
remain unpublished/unqualified and require separate authorization.
