import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const text = async relative => readFile(new URL(relative, root), 'utf8');
const registry = JSON.parse(await text('src/data/verifier-release-manifest.json'));
const pkg = JSON.parse(await text('package.json'));
const workflow = await text('.github/workflows/mutation-lease-audit.yml');
const qualityWorkflow = await text('.github/workflows/quality-gate.yml');
const sourceBoundCheckerNormalized = (await text('scripts/verify-universe-locale-parity-r1.mjs')).replace(/\r\n/g, '\n').trim();
const git = (...args) => execFileSync('git', args, {
  cwd: root, encoding: 'utf8', windowsHide: true,
}).trim();
const head = git('rev-parse', 'HEAD');
const qualifiedSource = '6a0a965e094426b1165ff7fc199e1c969d7167e4';
const pinnedPackage = JSON.parse(git('show', qualifiedSource + ':package.json'));
const pinnedRegistry = JSON.parse(git('show', qualifiedSource + ':src/data/verifier-release-manifest.json'));
const baseline = registry.baselineMainSha;
const paths = (await readdir(new URL('scripts/', root)))
  .filter(name => /^verify-.*\.mjs$/.test(name)
    && name !== 'verify-universe-locale-parity-r1.mjs')
  .map(name => 'scripts/' + name).sort();
const byId = new Map(registry.verifiers.map(row => [row.id, row]));

function countBy(field) {
  const counts = {};
  for (const item of registry.verifiers) counts[item[field]] = (counts[item[field]] ?? 0) + 1;
  return counts;
}

test('manifest baseline is an ancestor of HEAD, not necessarily HEAD itself', () => {
  assert.equal(registry.schema, 'bitevo.verifier-release-manifest/v1');
  assert.equal(registry.authority, 'LOCAL_DRAFT_NOT_APPROVED');
  assert.match(baseline, /^[0-9a-f]{40}$/);
  assert.match(head, /^[0-9a-f]{40}$/);
  // Remains valid on a later feature commit or Draft PR checkout without falsifying provenance.
  assert.doesNotThrow(() => git('merge-base', '--is-ancestor', baseline, head));
  assert.equal(registry.verifiers.length, 80);
  assert.deepEqual(countBy('status'), registry.statusCounts);
  assert.deepEqual(countBy('stage'), registry.stageCounts);
  assert.deepEqual(registry.statusCounts, { CURRENT: 77, HISTORICAL: 2, UNRESOLVED: 1 });
  assert.ok(registry.verifiers.every(row =>
    row.requiredForMerge === null || row.requiredForMerge === false));
});

test('all 79 source verifiers and exactly one proposed parity verifier are represented', () => {
  const recorded = registry.verifiers.map(row => row.file);
  assert.equal(new Set(recorded).size, 80);
  assert.deepEqual(recorded.slice(0, 79).sort(), paths);
  assert.equal(recorded[79], 'scripts/verify-universe-locale-parity-r1.mjs');
  for (const row of registry.verifiers) {
    for (const field of ['id', 'file', 'sourceSha', 'manifestEvidence',
      'command', 'lastVerifiedSha', 'requiredForMerge',
      'status', 'releaseId', 'stage']) {
      assert.ok(Object.hasOwn(row, field), row.file + ' missing ' + field);
    }
    assert.equal(row.file, 'scripts/' + row.id + '.mjs');
    assert.ok(['CURRENT', 'HISTORICAL', 'UNRESOLVED'].includes(row.status));
    assert.equal(typeof row.releaseId, 'string');
    assert.ok(row.releaseId.length > 0);
    assert.equal(typeof row.stage, 'string');
    assert.ok(row.stage.length > 0);
    assert.equal(typeof row.command, 'string');
    assert.ok(row.command.length > 0);
    assert.ok(row.sourceSha === null || /^[0-9a-f]{40}$/.test(row.sourceSha));
    assert.ok(row.lastVerifiedSha === null || /^[0-9a-f]{40}$/.test(row.lastVerifiedSha));
    assert.ok(row.manifestEvidence === null ||
      typeof row.manifestEvidence === 'string' && row.manifestEvidence.length > 0);
    assert.ok(row.requiredForMerge === null || row.requiredForMerge === false);
  }
});

test('73 core verifier commands: 72 pinned baseline plus exact R3 Universe admission', () => {
  const allCommands = pkg.scripts['verify:core'].split(/\s*&&\s*/).map(s => s.trim());
  const commands = new Set(allCommands);
  const core = registry.verifiers.filter(row => row.stage === 'premerge_core');
  assert.equal(core.length, 73);
  assert.equal(allCommands.length, commands.size, 'core commands must be unique');
  for (const row of core) {
    assert.equal(row.status, 'CURRENT');
    assert.ok(commands.has(row.command), 'missing exact command ' + row.command);
    assert.equal(row.command, 'node ' + row.file);
    if (row.id !== 'verify-universe-locale-parity-r1') {
      assert.equal(row.sourceSha, baseline);
      assert.equal(row.lastVerifiedSha, baseline);
      assert.ok(row.manifestEvidence.includes('package.json:15@' + baseline));
    }
  }
  const universe = byId.get('verify-universe-locale-parity-r1');
  assert.equal(allCommands.filter(s => s === universe.command).length, 1);
  assert.equal(universe.sourceSha, qualifiedSource);
  assert.equal(universe.lastVerifiedSha, qualifiedSource);
  assert.equal(universe.requiredForMerge, null);
  assert.equal(universe.qualification, 'LOCAL_PASS_PENDING_EXACT_HEAD_CI_NO_DIRECT_REQUIRED_CONTEXT');
  assert.match(universe.lastVerifiedEvidence, /LOCAL_STANDALONE_ONLY/);
  assert.ok(universe.manifestEvidence.includes('package.json:15 R3_LOCAL_ONLY'));
  assert.ok(qualityWorkflow.includes('run: npm run build:core'));
});

test('R3 changes only verify:core in package, preserving all unrelated script contracts', () => {
  const anchor = 'node scripts/verify-p28-crypto-disclaimer-r1.mjs && ';
  const baselineCore = pinnedPackage.scripts['verify:core'];
  assert.equal(baselineCore.split(anchor).length, 2, 'qualifier insertion anchor exact once');
  const expectedCore = baselineCore.replace(
    anchor, anchor + 'node scripts/verify-universe-locale-parity-r1.mjs && ');
  assert.equal(pkg.scripts['verify:core'], expectedCore);
  assert.deepEqual(
    { ...pkg, scripts: { ...pkg.scripts, 'verify:core': baselineCore } },
    pinnedPackage);
});

test('R3 changes only Universe manifest row, scope counts and resolved-gap note', () => {
  assert.deepEqual(registry.verifiers.slice(0, 79), pinnedRegistry.verifiers.slice(0, 79));
  assert.equal(registry.baselineMainSha, pinnedRegistry.baselineMainSha);
  assert.equal(registry.authority, pinnedRegistry.authority);
  assert.equal(registry.provenance, pinnedRegistry.provenance);
  assert.equal(registry.requiredForMergeSemantics, pinnedRegistry.requiredForMergeSemantics);
  assert.ok(registry.navigationKnownGap.startsWith('RESOLVED_SOURCE: PR #240 merge ' + qualifiedSource));
  assert.equal(registry.stageCounts.premerge_core, 73);
  assert.equal(registry.stageCounts.local_candidate, undefined);
  assert.equal(registry.statusCounts.UNRESOLVED, 1);
  const checkerFromPinned = git('show', qualifiedSource + ':scripts/verify-universe-locale-parity-r1.mjs');
  assert.equal(checkerFromPinned, sourceBoundCheckerNormalized,
    'verifier source must match pinned SHA');
});

test('provider/CI gates are exactly bound without inventing independent PASS', () => {
  const vercel = byId.get('verify-vercel-policy');
  const cloudflare = byId.get('verify-cloudflare-policy');
  for (const [row, key] of [
    [vercel, 'verify:provider:vercel'],
    [cloudflare, 'verify:provider:cloudflare'],
  ]) {
    assert.equal(row.status, 'CURRENT');
    assert.equal(pkg.scripts[key].trim(), row.command);
    assert.equal(row.command, 'node ' + row.file);
    assert.equal(row.sourceSha, baseline);
  }
  assert.equal(vercel.lastVerifiedSha, baseline);
  assert.equal(cloudflare.lastVerifiedSha, null);
  const lease = byId.get('verify-mutation-lease-audit');
  assert.equal(lease.status, 'CURRENT');
  assert.equal(lease.stage, 'pull_request_target_ci');
  assert.equal(lease.sourceSha, baseline);
  assert.equal(lease.lastVerifiedSha, null);
  assert.ok(workflow.includes('scripts/verify-mutation-lease-audit.mjs'));
  assert.ok(lease.manifestEvidence.includes('.github/workflows/mutation-lease-audit.yml:31@' + baseline));
});

test('historical P30 snapshots preserved and B1.2 regression not qualified', () => {
  const a = byId.get('verify-p30-research-library-r1');
  const b = byId.get('verify-p30-research-library-r2');
  assert.equal(a.sourceSha, '8e4c72a4aea17b001ef746f3ecbf20a17d914d01');
  assert.equal(b.sourceSha, '2298fa935e23b235596bc1d32ebecb13ab032b63');
  for (const row of [a, b]) {
    assert.equal(row.status, 'HISTORICAL');
    assert.equal(row.stage, 'historical_snapshot_only');
    assert.equal(row.lastVerifiedSha, null);
    assert.equal(row.requiredForMerge, false);
  }
  const b12 = byId.get('verify-b1-2-event-counter');
  assert.equal(b12.status, 'UNRESOLVED');
  assert.equal(b12.stage, 'feature_regression_candidate');
  assert.equal(b12.sourceSha, baseline);
  assert.equal(b12.lastVerifiedSha, null);
  assert.equal(b12.requiredForMerge, false);
});

test('live header history remains untouched; Universe R3 is source-qualified, not provider-admitted', () => {
  const live = byId.get('verify-live-headers');
  assert.equal(live.status, 'CURRENT');
  assert.equal(live.stage, 'post_deploy_only');
  assert.equal(live.sourceSha, baseline);
  assert.equal(live.lastVerifiedSha, 'd2bad88c8e55bd42e0c115a6ac8d2a5164263650');
  assert.notEqual(live.lastVerifiedSha, baseline);
  assert.equal(live.requiredForMerge, false);
  assert.ok(live.precondition.includes('deployment SHA must equal checkout SHA'));
  assert.ok(live.lastVerifiedEvidence.includes('header_observations=798'));
  const universe = byId.get('verify-universe-locale-parity-r1');
  assert.equal(universe.status, 'CURRENT');
  assert.equal(universe.stage, 'premerge_core');
  assert.equal(universe.sourceSha, qualifiedSource);
  assert.equal(universe.evaluatedSnapshotSha, qualifiedSource);
  assert.equal(universe.lastVerifiedSha, qualifiedSource);
  assert.equal(universe.requiredForMerge, null);
  assert.equal(universe.knownFailure, undefined);
  assert.match(universe.lastVerifiedEvidence, /R3 prospective CI not run/);
  assert.ok(pkg.scripts['verify:core'].includes(universe.command));
  assert.ok(registry.navigationKnownGap.includes('pending exact-commit CI validation'));
});
