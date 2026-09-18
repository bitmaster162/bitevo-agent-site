#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const LEASE_REF = 'refs/heads/coordination/site-mutation-lease';
const TARGET_REF = 'refs/heads/main';
const SCHEMA_VERSION = 1;
const COORDINATION_VERCEL_CONFIG = Object.freeze({
  $schema: 'https://openapi.vercel.sh/vercel.json',
  git: { deploymentEnabled: false },
});
const ACTIVE = 'ACTIVE';
const SEALED = 'SEALED';
const RELEASED = 'RELEASED';

function fail(message, code = 2) {
  console.error(`LEASE_FAIL ${message}`);
  process.exit(code);
}

function git(args, { cwd = process.cwd(), input, allowFailure = false, env = {} } = {}) {
  const result = spawnSync('git', args, {
    cwd,
    input,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result;
}

function gitText(args, options = {}) {
  return git(args, options).stdout.trim();
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) fail(`unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = rest[i + 1];
    if (!value || value.startsWith('--')) fail(`missing value for --${key}`);
    args[key] = value;
    i += 1;
  }
  return args;
}

function required(args, key) {
  const value = args[key];
  if (!value) fail(`missing --${key}`);
  return value;
}

function normalizedWorktree(input = process.cwd()) {
  let value = path.resolve(input).replaceAll('\\', '/');
  if (process.platform === 'win32') value = value.toLowerCase();
  return value.replace(/\/$/, '');
}

function isoNow() {
  return new Date().toISOString();
}

function parseExpiry(value, { mustBeFuture = true } = {}) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) fail(`invalid expires-at: ${value}`);
  if (mustBeFuture && parsed.getTime() <= Date.now()) fail(`expires-at must be in the future: ${value}`);
  return parsed.toISOString();
}

function currentRepo() {
  return normalizedWorktree(gitText(['rev-parse', '--show-toplevel']));
}

function currentHead() {
  return gitText(['rev-parse', 'HEAD']);
}

function currentTree() {
  return gitText(['rev-parse', 'HEAD^{tree}']);
}

function currentBranch() {
  const branch = gitText(['branch', '--show-current']);
  if (!branch) fail('detached HEAD is not allowed');
  return branch;
}

function remoteUrl(remote) {
  return gitText(['remote', 'get-url', remote]);
}

function remoteRefSha(remote, ref) {
  const result = git(['ls-remote', '--refs', remote, ref], { allowFailure: true });
  if (result.status !== 0) fail(`cannot read ${remote} ${ref}: ${result.stderr.trim()}`);
  const line = result.stdout.trim();
  return line ? line.split(/\s+/)[0] : null;
}

function fetchObservedRef(remote, ref, observedSha) {
  if (!observedSha) return null;
  git(['fetch', '--no-tags', '--quiet', remote, ref]);
  const fetched = gitText(['rev-parse', 'FETCH_HEAD']);
  if (fetched !== observedSha) {
    fail(`coordination ref changed during snapshot: observed=${observedSha} fetched=${fetched}`);
  }
  return fetched;
}

function readLease(remote) {
  const sha = remoteRefSha(remote, LEASE_REF);
  if (!sha) return { sha: null, lease: null };
  fetchObservedRef(remote, LEASE_REF, sha);
  const raw = gitText(['show', `${sha}:lease.json`]);
  let lease;
  try {
    lease = JSON.parse(raw);
  } catch {
    fail(`invalid lease JSON at ${sha}`);
  }
  if (lease.schemaVersion !== SCHEMA_VERSION || lease.kind !== 'bitevo-site-mutation-lease') {
    fail(`unsupported lease schema at ${sha}`);
  }
  return { sha, lease };
}

function buildLeaseCommit(lease, parentSha, message) {
  const json = `${JSON.stringify(lease, null, 2)}\n`;
  const blob = gitText(['hash-object', '-w', '--stdin'], { input: json });
  const vercelJson = `${JSON.stringify(COORDINATION_VERCEL_CONFIG, null, 2)}\n`;
  const vercelBlob = gitText(['hash-object', '-w', '--stdin'], { input: vercelJson });
  const tree = gitText(['mktree'], {
    input: `100644 blob ${blob}\tlease.json\n100644 blob ${vercelBlob}\tvercel.json\n`,
  });
  const args = ['commit-tree', tree, '-m', message];
  if (parentSha) args.push('-p', parentSha);
  const identity = {
    GIT_AUTHOR_NAME: 'BitEvo Mutation Lease',
    GIT_AUTHOR_EMAIL: 'lease@local.invalid',
    GIT_COMMITTER_NAME: 'BitEvo Mutation Lease',
    GIT_COMMITTER_EMAIL: 'lease@local.invalid',
  };
  return gitText(args, { env: identity });
}

function pushLeaseCommit(remote, commitSha) {
  const delay = Number(process.env.BITEVO_LEASE_TEST_DELAY_MS || '0');
  if (Number.isFinite(delay) && delay > 0) {
    const until = Date.now() + delay;
    while (Date.now() < until) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.min(50, until - Date.now()));
  }
  const result = git(['push', '--porcelain', remote, `${commitSha}:${LEASE_REF}`], { allowFailure: true });
  if (result.status !== 0) {
    fail(`atomic lease update rejected (possible concurrent writer): ${(result.stderr || result.stdout).trim()}`, 3);
  }
}

function assertRemoteMain(remote, expectedBase) {
  const actual = remoteRefSha(remote, TARGET_REF);
  if (actual !== expectedBase) fail(`main drift: expected=${expectedBase} actual=${actual || 'missing'}`);
  return actual;
}

function assertNotExpired(lease) {
  const expiry = new Date(lease.expiresAt).getTime();
  if (!Number.isFinite(expiry)) fail(`lease has invalid expiresAt: ${lease.expiresAt}`);
  if (expiry <= Date.now()) fail(`lease expired at ${lease.expiresAt}`);
}

function assertOwnerContext(lease, args) {
  const owner = required(args, 'owner');
  const nonce = required(args, 'nonce');
  const worktree = normalizedWorktree(args.worktree || currentRepo());
  if (lease.owner !== owner) fail(`owner mismatch: expected=${lease.owner} actual=${owner}`);
  if (lease.nonce !== nonce) fail('lease token mismatch');
  if (normalizedWorktree(lease.worktree) !== worktree) {
    fail(`worktree mismatch: expected=${lease.worktree} actual=${worktree}`);
  }
}

function assertRepository(lease, remote) {
  const actual = remoteUrl(remote);
  if (lease.repositoryRemote !== actual) {
    fail(`repository remote mismatch: expected=${lease.repositoryRemote} actual=${actual}`);
  }
}

function assertPhaseState(lease, phase) {
  if (['work', 'push', 'update-branch'].includes(phase)) {
    if (lease.state !== ACTIVE) fail(`${phase} requires ACTIVE lease; actual=${lease.state}`);
    return;
  }
  if (['ready', 'merge'].includes(phase)) {
    if (lease.state !== SEALED) fail(`${phase} requires SEALED lease; actual=${lease.state}`);
    return;
  }
  fail(`unsupported check phase: ${phase}`);
}

function assertSealedCandidate(lease) {
  if (currentHead() !== lease.sealedHead) {
    fail(`sealed head mismatch: expected=${lease.sealedHead} actual=${currentHead()}`);
  }
  if (currentTree() !== lease.sealedTree) {
    fail(`sealed tree mismatch: expected=${lease.sealedTree} actual=${currentTree()}`);
  }
}

function emit(event, lease, extra = {}) {
  console.log(`${event} ${JSON.stringify({ ...extra, lease })}`);
}

function writeLeaseMutation(remote, priorSha, lease, action) {
  const commitSha = buildLeaseCommit(lease, priorSha, `site mutation lease: ${action}`);
  pushLeaseCommit(remote, commitSha);
  const observed = remoteRefSha(remote, LEASE_REF);
  if (observed !== commitSha) fail(`lease readback mismatch: expected=${commitSha} actual=${observed || 'missing'}`);
  return commitSha;
}

function commonContext(args) {
  const remote = args.remote || 'origin';
  return {
    remote,
    repositoryRemote: remoteUrl(remote),
    worktree: normalizedWorktree(args.worktree || currentRepo()),
  };
}

function requireLease(remote) {
  const snapshot = readLease(remote);
  if (!snapshot.lease) fail('coordination lease does not exist');
  return snapshot;
}

function ensureLeaseUsable(lease, args, remote) {
  assertRepository(lease, remote);
  assertOwnerContext(lease, args);
  assertNotExpired(lease);
  assertRemoteMain(remote, lease.baseSha);
}

function acquire(args) {
  const { remote, repositoryRemote, worktree } = commonContext(args);
  const baseSha = required(args, 'base-sha');
  const owner = required(args, 'owner');
  const session = required(args, 'session');
  const expiresAt = parseExpiry(required(args, 'expires-at'));
  assertRemoteMain(remote, baseSha);
  const prior = readLease(remote);
  if (prior.lease && prior.lease.state !== RELEASED) {
    const expired = new Date(prior.lease.expiresAt).getTime() <= Date.now();
    if (!expired) fail(`lease already held by ${prior.lease.owner} until ${prior.lease.expiresAt}`);
  }
  const now = isoNow();
  const lease = {
    schemaVersion: SCHEMA_VERSION,
    kind: 'bitevo-site-mutation-lease',
    leaseId: args['lease-id'] || randomUUID(),
    nonce: args.nonce || randomUUID(),
    state: ACTIVE,
    repositoryRemote,
    targetRef: TARGET_REF,
    baseSha,
    owner,
    session,
    worktree,
    acquiredAt: now,
    updatedAt: now,
    expiresAt,
    sealedHead: null,
    sealedTree: null,
    featureRef: null,
    predecessor: prior.sha,
  };
  const commitSha = writeLeaseMutation(remote, prior.sha, lease, 'acquire');
  emit('LEASE_ACQUIRED', lease, { commitSha });
}

function check(args) {
  const { remote } = commonContext(args);
  const phase = required(args, 'phase');
  const { sha, lease } = requireLease(remote);
  ensureLeaseUsable(lease, args, remote);
  assertPhaseState(lease, phase);
  if (lease.state === SEALED) assertSealedCandidate(lease);
  if (lease.featureRef && lease.state === SEALED) {
    const remoteFeature = remoteRefSha(remote, lease.featureRef);
    if (remoteFeature !== lease.sealedHead) {
      fail(`remote feature drift: expected=${lease.sealedHead} actual=${remoteFeature || 'missing'}`);
    }
  }
  emit('LEASE_CHECK_PASS', lease, { commitSha: sha, phase });
}

function seal(args) {
  const { remote } = commonContext(args);
  const prior = requireLease(remote);
  ensureLeaseUsable(prior.lease, args, remote);
  if (prior.lease.state !== ACTIVE) fail(`seal requires ACTIVE lease; actual=${prior.lease.state}`);
  const featureRef = args['feature-ref'] || `refs/heads/${currentBranch()}`;
  const head = currentHead();
  const tree = currentTree();
  const remoteFeature = remoteRefSha(remote, featureRef);
  if (remoteFeature !== head) {
    fail(`feature ref must already point at local HEAD before seal: ref=${featureRef} local=${head} remote=${remoteFeature || 'missing'}`);
  }
  const lease = {
    ...prior.lease,
    state: SEALED,
    updatedAt: isoNow(),
    sealedHead: head,
    sealedTree: tree,
    featureRef,
    predecessor: prior.sha,
  };
  const commitSha = writeLeaseMutation(remote, prior.sha, lease, 'seal');
  emit('LEASE_SEALED', lease, { commitSha });
}

function release(args) {
  const { remote } = commonContext(args);
  const prior = requireLease(remote);
  assertRepository(prior.lease, remote);
  assertOwnerContext(prior.lease, args);
  if (prior.lease.state === RELEASED) fail('lease already RELEASED');
  const lease = {
    ...prior.lease,
    state: RELEASED,
    updatedAt: isoNow(),
    releasedAt: isoNow(),
    releaseReason: args.reason || 'owner_release',
    predecessor: prior.sha,
  };
  const commitSha = writeLeaseMutation(remote, prior.sha, lease, 'release');
  emit('LEASE_RELEASED', lease, { commitSha });
}

function transfer(args) {
  const { remote } = commonContext(args);
  const prior = requireLease(remote);
  ensureLeaseUsable(prior.lease, args, remote);
  if (prior.lease.state === RELEASED) fail('cannot transfer RELEASED lease');
  const nextOwner = required(args, 'next-owner');
  const nextSession = required(args, 'next-session');
  const nextWorktree = normalizedWorktree(required(args, 'next-worktree'));
  const nextExpiresAt = parseExpiry(required(args, 'next-expires-at'));
  const lease = {
    ...prior.lease,
    owner: nextOwner,
    session: nextSession,
    worktree: nextWorktree,
    nonce: args['next-nonce'] || randomUUID(),
    state: ACTIVE,
    updatedAt: isoNow(),
    expiresAt: nextExpiresAt,
    sealedHead: null,
    sealedTree: null,
    featureRef: null,
    transferredFrom: prior.lease.owner,
    predecessor: prior.sha,
  };
  const commitSha = writeLeaseMutation(remote, prior.sha, lease, 'transfer');
  emit('LEASE_TRANSFERRED', lease, { commitSha });
}

function status(args) {
  const remote = args.remote || 'origin';
  const snapshot = readLease(remote);
  emit('LEASE_STATUS', snapshot.lease, { commitSha: snapshot.sha });
}

const args = parseArgs(process.argv.slice(2));
try {
  switch (args.command) {
    case 'acquire':
      acquire(args);
      break;
    case 'check':
      check(args);
      break;
    case 'seal':
      seal(args);
      break;
    case 'release':
      release(args);
      break;
    case 'transfer':
      transfer(args);
      break;
    case 'status':
      status(args);
      break;
    default:
      fail('usage: site-mutation-lease.mjs <acquire|check|seal|release|transfer|status> [options]');
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
