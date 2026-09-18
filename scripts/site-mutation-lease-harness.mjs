#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const leaseCli = path.join(here, 'site-mutation-lease.mjs');
const root = mkdtempSync(path.join(tmpdir(), 'bitevo-lease-harness-'));
const remote = path.join(root, 'remote.git');
const seed = path.join(root, 'seed');
const writerA = path.join(root, 'writer-a');
const writerB = path.join(root, 'writer-b');
let assertions = 0;

function run(command, args, { cwd = root, env = {}, allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function git(cwd, ...args) {
  return run('git', args, { cwd }).stdout.trim();
}

function configure(cwd, name) {
  git(cwd, 'config', 'user.name', name);
  git(cwd, 'config', 'user.email', `${name.toLowerCase().replaceAll(' ', '-')}@local.invalid`);
}

function expect(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(`ASSERT_FAIL ${message}`);
}

function future(ms = 300_000) {
  return new Date(Date.now() + ms).toISOString();
}

function leaseCall(cwd, args, { allowFailure = false, env = {} } = {}) {
  return run(process.execPath, [leaseCli, ...args], { cwd, allowFailure, env });
}

function parseEvent(result, event) {
  const line = result.stdout.trim().split(/\r?\n/).find(entry => entry.startsWith(`${event} `));
  if (!line) throw new Error(`missing ${event} in output: ${result.stdout}`);
  return JSON.parse(line.slice(event.length + 1));
}

function readCoordinationFile(cwd, filePath) {
  git(cwd, 'fetch', '--no-tags', '--quiet', 'origin', 'refs/heads/coordination/site-mutation-lease');
  return git(cwd, 'show', `FETCH_HEAD:${filePath}`);
}

function expectCoordinationVercelSuppression(cwd, label) {
  const config = JSON.parse(readCoordinationFile(cwd, 'vercel.json'));
  expect(config.$schema === 'https://openapi.vercel.sh/vercel.json', `${label}: coordination Vercel schema is exact`);
  expect(config.git?.deploymentEnabled === false, `${label}: coordination Git deployments are disabled`);
}

function leaseCallAsync(cwd, args, env = {}) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [leaseCli, ...args], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

function acquireArgs(baseSha, owner, session, nonce, expiresAt = future()) {
  return [
    'acquire', '--remote', 'origin', '--base-sha', baseSha,
    '--owner', owner, '--session', session, '--nonce', nonce,
    '--expires-at', expiresAt,
  ];
}

function checkArgs(owner, nonce, phase = 'work') {
  return ['check', '--remote', 'origin', '--owner', owner, '--nonce', nonce, '--phase', phase];
}

function releaseArgs(owner, nonce, reason = 'harness') {
  return ['release', '--remote', 'origin', '--owner', owner, '--nonce', nonce, '--reason', reason];
}

async function main() {
  run('git', ['init', '--bare', '--initial-branch=main', remote]);
  run('git', ['init', '--initial-branch=main', seed]);
  configure(seed, 'Seed Writer');
  writeFileSync(path.join(seed, 'seed.txt'), 'base\n');
  git(seed, 'add', 'seed.txt');
  git(seed, 'commit', '-m', 'baseline');
  git(seed, 'remote', 'add', 'origin', remote);
  git(seed, 'push', '-u', 'origin', 'main');
  const base = git(seed, 'rev-parse', 'HEAD');

  run('git', ['clone', remote, writerA]);
  run('git', ['clone', remote, writerB]);
  configure(writerA, 'Writer A');
  configure(writerB, 'Writer B');
  expect(git(writerA, 'rev-parse', 'HEAD') === base, 'writer A starts at baseline');
  expect(git(writerB, 'rev-parse', 'HEAD') === base, 'writer B starts at baseline');

  const delayEnv = { BITEVO_LEASE_TEST_DELAY_MS: '600' };
  const [raceA, raceB] = await Promise.all([
    leaseCallAsync(writerA, acquireArgs(base, 'writer-a', 'race-a', 'race-nonce-a'), delayEnv),
    leaseCallAsync(writerB, acquireArgs(base, 'writer-b', 'race-b', 'race-nonce-b'), delayEnv),
  ]);
  const winners = [raceA, raceB].filter(result => result.status === 0);
  expect(winners.length === 1, `exactly one writer wins acquire race; statuses=${raceA.status},${raceB.status}`);
  const winnerIsA = raceA.status === 0;
  const winnerDir = winnerIsA ? writerA : writerB;
  const winnerOwner = winnerIsA ? 'writer-a' : 'writer-b';
  const winnerNonce = winnerIsA ? 'race-nonce-a' : 'race-nonce-b';
  const loser = winnerIsA ? raceB : raceA;
  expect(loser.status !== 0, 'losing writer is rejected');
  expect(/atomic lease update rejected|lease already held/.test(loser.stderr), 'race loser fails closed');
  expectCoordinationVercelSuppression(winnerDir, 'acquire');
  leaseCall(winnerDir, releaseArgs(winnerOwner, winnerNonce, 'race-complete'));
  expectCoordinationVercelSuppression(winnerDir, 'release');

  const acquired = leaseCall(writerA, acquireArgs(base, 'writer-a', 'transfer-source', 'transfer-nonce-a'));
  const acquiredLease = parseEvent(acquired, 'LEASE_ACQUIRED').lease;
  expect(acquiredLease.state === 'ACTIVE', 'acquire creates ACTIVE lease');
  expect(acquiredLease.baseSha === base, 'lease binds exact base SHA');
  expect(acquiredLease.worktree.replaceAll('\\', '/').toLowerCase() === writerA.replaceAll('\\', '/').toLowerCase(), 'lease binds worktree');
  leaseCall(writerA, checkArgs('writer-a', 'transfer-nonce-a', 'work'));

  const wrongToken = leaseCall(writerA, checkArgs('writer-a', 'wrong-token', 'work'), { allowFailure: true });
  expect(wrongToken.status !== 0 && /token mismatch/.test(wrongToken.stderr), 'wrong token is rejected');
  const wrongWorktree = leaseCall(writerB, checkArgs('writer-a', 'transfer-nonce-a', 'work'), { allowFailure: true });
  expect(wrongWorktree.status !== 0 && /worktree mismatch/.test(wrongWorktree.stderr), 'wrong worktree is rejected');

  const transferred = leaseCall(writerA, [
    'transfer', '--remote', 'origin', '--owner', 'writer-a', '--nonce', 'transfer-nonce-a',
    '--next-owner', 'writer-b', '--next-session', 'transfer-target', '--next-worktree', writerB,
    '--next-nonce', 'transfer-nonce-b', '--next-expires-at', future(),
  ]);
  const transferredLease = parseEvent(transferred, 'LEASE_TRANSFERRED').lease;
  expect(transferredLease.owner === 'writer-b' && transferredLease.state === 'ACTIVE', 'transfer rotates owner and returns ACTIVE');
  const oldOwnerCheck = leaseCall(writerA, checkArgs('writer-a', 'transfer-nonce-a', 'work'), { allowFailure: true });
  expect(oldOwnerCheck.status !== 0, 'old owner loses authority after transfer');
  leaseCall(writerB, checkArgs('writer-b', 'transfer-nonce-b', 'work'));
  leaseCall(writerB, releaseArgs('writer-b', 'transfer-nonce-b', 'transfer-complete'));

  const expiryAt = future(900);
  leaseCall(writerA, acquireArgs(base, 'writer-a', 'expiry', 'expiry-nonce', expiryAt));
  await new Promise(resolve => setTimeout(resolve, 1100));
  const expiredCheck = leaseCall(writerA, checkArgs('writer-a', 'expiry-nonce', 'work'), { allowFailure: true });
  expect(expiredCheck.status !== 0 && /expired/.test(expiredCheck.stderr), 'expired lease fails closed');
  leaseCall(writerA, releaseArgs('writer-a', 'expiry-nonce', 'expired-cleanup'));

  leaseCall(writerA, acquireArgs(base, 'writer-a', 'main-drift', 'drift-nonce'));
  appendFileSync(path.join(seed, 'seed.txt'), 'advance-main\n');
  git(seed, 'add', 'seed.txt');
  git(seed, 'commit', '-m', 'advance main');
  git(seed, 'push', 'origin', 'main');
  const advancedBase = git(seed, 'rev-parse', 'HEAD');
  const driftCheck = leaseCall(writerA, checkArgs('writer-a', 'drift-nonce', 'work'), { allowFailure: true });
  expect(driftCheck.status !== 0 && /main drift/.test(driftCheck.stderr), 'main drift invalidates lease');
  leaseCall(writerA, releaseArgs('writer-a', 'drift-nonce', 'drift-cleanup'));

  git(writerA, 'fetch', '--no-tags', 'origin', 'main');
  git(writerA, 'checkout', '-B', 'lease-feature', 'origin/main');
  leaseCall(writerA, acquireArgs(advancedBase, 'writer-a', 'seal-remote-drift', 'seal-nonce-a'));
  writeFileSync(path.join(writerA, 'feature.txt'), 'candidate-one\n');
  git(writerA, 'add', 'feature.txt');
  git(writerA, 'commit', '-m', 'candidate one');
  leaseCall(writerA, checkArgs('writer-a', 'seal-nonce-a', 'push'));

  const prematureSeal = leaseCall(writerA, [
    'seal', '--remote', 'origin', '--owner', 'writer-a', '--nonce', 'seal-nonce-a',
    '--feature-ref', 'refs/heads/lease-feature',
  ], { allowFailure: true });
  expect(prematureSeal.status !== 0 && /must already point at local HEAD/.test(prematureSeal.stderr), 'seal requires remote feature publication first');
  git(writerA, 'push', 'origin', 'HEAD:refs/heads/lease-feature');

  const sealed = leaseCall(writerA, [
    'seal', '--remote', 'origin', '--owner', 'writer-a', '--nonce', 'seal-nonce-a',
    '--feature-ref', 'refs/heads/lease-feature',
  ]);
  const sealedLease = parseEvent(sealed, 'LEASE_SEALED').lease;
  expect(sealedLease.state === 'SEALED', 'seal transitions ACTIVE to SEALED');
  expect(sealedLease.sealedHead === git(writerA, 'rev-parse', 'HEAD'), 'seal binds exact head');
  expect(sealedLease.sealedTree === git(writerA, 'rev-parse', 'HEAD^{tree}'), 'seal binds exact tree');
  leaseCall(writerA, checkArgs('writer-a', 'seal-nonce-a', 'ready'));
  leaseCall(writerA, checkArgs('writer-a', 'seal-nonce-a', 'merge'));

  git(writerB, 'fetch', '--no-tags', 'origin', 'refs/heads/lease-feature');
  git(writerB, 'checkout', '-B', 'lease-feature-hijack', 'FETCH_HEAD');
  writeFileSync(path.join(writerB, 'hijack.txt'), 'external-drift\n');
  git(writerB, 'add', 'hijack.txt');
  git(writerB, 'commit', '-m', 'external feature drift');
  git(writerB, 'push', 'origin', 'HEAD:refs/heads/lease-feature');
  const remoteFeatureDrift = leaseCall(writerA, checkArgs('writer-a', 'seal-nonce-a', 'ready'), { allowFailure: true });
  expect(remoteFeatureDrift.status !== 0 && /remote feature drift/.test(remoteFeatureDrift.stderr), 'remote feature drift invalidates sealed lease');
  leaseCall(writerA, releaseArgs('writer-a', 'seal-nonce-a', 'remote-feature-drift-complete'));

  git(writerA, 'checkout', '-B', 'lease-feature-local-head', 'origin/main');
  leaseCall(writerA, acquireArgs(advancedBase, 'writer-a', 'seal-local-drift', 'seal-nonce-b'));
  writeFileSync(path.join(writerA, 'candidate-two.txt'), 'candidate-two\n');
  git(writerA, 'add', 'candidate-two.txt');
  git(writerA, 'commit', '-m', 'candidate two');
  leaseCall(writerA, checkArgs('writer-a', 'seal-nonce-b', 'push'));
  git(writerA, 'push', 'origin', 'HEAD:refs/heads/lease-feature-local-head');
  leaseCall(writerA, [
    'seal', '--remote', 'origin', '--owner', 'writer-a', '--nonce', 'seal-nonce-b',
    '--feature-ref', 'refs/heads/lease-feature-local-head',
  ]);
  git(writerA, 'commit', '--allow-empty', '-m', 'local head drift after seal');
  const localHeadDrift = leaseCall(writerA, checkArgs('writer-a', 'seal-nonce-b', 'ready'), { allowFailure: true });
  expect(localHeadDrift.status !== 0 && /sealed head mismatch/.test(localHeadDrift.stderr), 'local head drift invalidates sealed lease');
  leaseCall(writerA, releaseArgs('writer-a', 'seal-nonce-b', 'local-head-drift-complete'));

  const finalAcquire = leaseCall(writerB, acquireArgs(advancedBase, 'writer-b', 'final-reacquire', 'final-nonce'));
  const finalLease = parseEvent(finalAcquire, 'LEASE_ACQUIRED').lease;
  expect(finalLease.state === 'ACTIVE' && finalLease.owner === 'writer-b', 'released lease can be reacquired by next writer');
  leaseCall(writerB, checkArgs('writer-b', 'final-nonce', 'update-branch'));
  leaseCall(writerB, releaseArgs('writer-b', 'final-nonce', 'harness-terminal'));
  const finalStatus = leaseCall(writerB, ['status', '--remote', 'origin']);
  const statusLease = parseEvent(finalStatus, 'LEASE_STATUS').lease;
  expect(statusLease.state === 'RELEASED', 'harness ends with released lease');
}

main()
  .then(() => {
    console.log(`SITE_MUTATION_LEASE_HARNESS=PASS assertions=${assertions}`);
    if (process.env.BITEVO_LEASE_KEEP_HARNESS === '1') {
      console.log(`HARNESS_ROOT=${root}`);
    } else {
      rmSync(root, { recursive: true, force: true });
    }
  })
  .catch(error => {
    console.error(`SITE_MUTATION_LEASE_HARNESS=FAIL ${error instanceof Error ? error.stack : String(error)}`);
    console.error(`HARNESS_ROOT=${root}`);
    process.exitCode = 1;
  });
