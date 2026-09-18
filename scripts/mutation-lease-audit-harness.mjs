#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  auditMutationLease,
  LEASE_REF,
  TARGET_REF,
  WORKFLOW_PATH,
  VERIFIER_PATH,
  COORDINATION_VERCEL_PATH,
} from './verify-mutation-lease-audit.mjs';

const BASE = '1111111111111111111111111111111111111111';
const HEAD = '2222222222222222222222222222222222222222';
const TREE = '3333333333333333333333333333333333333333';
const COORD = '4444444444444444444444444444444444444444';
const PREDECESSOR = '5555555555555555555555555555555555555555';
const OTHER = '6666666666666666666666666666666666666666';
const FEATURE_REF = 'refs/heads/agent/test-lease-audit';
const NOW = Date.parse('2029-01-01T00:00:00.000Z');
const COORDINATION_VERCEL = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  git: { deploymentEnabled: false },
};

class FakeApi {
  constructor(fixture) {
    this.fixture = fixture;
  }
  async fileExists(commitSha, path) {
    return this.fixture.baseFiles.has(`${commitSha}:${path}`) || this.fixture.files.has(`${commitSha}:${path}`);
  }
  async getFileText(commitSha, path) {
    const value = this.fixture.files.get(`${commitSha}:${path}`);
    if (value === undefined) throw new Error(`missing fixture file ${commitSha}:${path}`);
    return value;
  }
  async getRef(fullRef) {
    return this.fixture.refs.has(fullRef) ? this.fixture.refs.get(fullRef) : null;
  }
  async getCommit(sha) {
    const value = this.fixture.commits.get(sha);
    if (!value) throw new Error(`missing fixture commit ${sha}`);
    return structuredClone(value);
  }
}

function makeFixture({ baseImplementation = 'both' } = {}) {
  const context = {
    repository: 'bitmaster162/bitevo-agent-site',
    baseRef: 'main',
    baseSha: BASE,
    headRef: 'agent/test-lease-audit',
    headSha: HEAD,
    headRepository: 'bitmaster162/bitevo-agent-site',
  };
  const lease = {
    schemaVersion: 1,
    kind: 'bitevo-site-mutation-lease',
    state: 'SEALED',
    repositoryRemote: 'https://github.com/bitmaster162/bitevo-agent-site.git',
    targetRef: TARGET_REF,
    baseSha: BASE,
    expiresAt: '2029-01-02T00:00:00.000Z',
    sealedHead: HEAD,
    sealedTree: TREE,
    featureRef: FEATURE_REF,
    predecessor: PREDECESSOR,
  };
  const baseFiles = new Set();
  if (baseImplementation === 'both' || baseImplementation === 'workflow') {
    baseFiles.add(`${BASE}:${WORKFLOW_PATH}`);
  }
  if (baseImplementation === 'both' || baseImplementation === 'verifier') {
    baseFiles.add(`${BASE}:${VERIFIER_PATH}`);
  }
  const fixture = {
    context,
    lease,
    baseFiles,
    refs: new Map([
      [TARGET_REF, BASE],
      [LEASE_REF, COORD],
      [FEATURE_REF, HEAD],
    ]),
    commits: new Map([
      [COORD, { sha: COORD, treeSha: OTHER, parents: [PREDECESSOR] }],
      [HEAD, { sha: HEAD, treeSha: TREE, parents: [BASE] }],
    ]),
    files: new Map(),
  };
  syncLease(fixture);
  fixture.files.set(`${COORD}:${COORDINATION_VERCEL_PATH}`, JSON.stringify(COORDINATION_VERCEL));
  return fixture;
}

function syncLease(fixture) {
  fixture.files.set(`${COORD}:lease.json`, JSON.stringify(fixture.lease));
}

async function run(fixture) {
  return auditMutationLease(fixture.context, new FakeApi(fixture), { nowMs: NOW });
}
let assertions = 0;

async function expectPass(label, mutate = () => {}, expectedStatus = 'PASS') {
  const fixture = makeFixture();
  await mutate(fixture);
  const result = await run(fixture);
  assert.equal(result.status, expectedStatus, label);
  assertions += 1;
}

async function expectReject(label, mutate, pattern) {
  const fixture = makeFixture();
  await mutate(fixture);
  await assert.rejects(() => run(fixture), pattern, label);
  assertions += 1;
}

await expectPass('canonical SEALED lease passes');

{
  const fixture = makeFixture({ baseImplementation: 'none' });
  fixture.refs.set(LEASE_REF, null);
  const result = await run(fixture);
  assert.equal(result.status, 'PASS_BOOTSTRAP');
  assertions += 1;
}

await expectReject('partial implementation fails closed', fixture => {
  fixture.baseFiles.delete(`${BASE}:${VERIFIER_PATH}`);
}, /implementation is incomplete/);

await expectReject('missing canonical coordination ref fails', fixture => {
  fixture.refs.set(LEASE_REF, null);
}, /coordination ref missing/);
await expectReject('missing coordination Vercel suppression fails', fixture => {
  fixture.files.delete(`${COORD}:${COORDINATION_VERCEL_PATH}`);
}, /suppression config missing/);
await expectReject('coordination Vercel suppression must disable deployments', fixture => {
  fixture.files.set(`${COORD}:${COORDINATION_VERCEL_PATH}`, JSON.stringify({
    $schema: 'https://openapi.vercel.sh/vercel.json',
    git: { deploymentEnabled: true },
  }));
}, /must disable Git deployments/);
await expectReject('schema mismatch fails', fixture => {
  fixture.lease.schemaVersion = 2; syncLease(fixture);
}, /schemaVersion/);
await expectReject('kind mismatch fails', fixture => {
  fixture.lease.kind = 'self-asserted'; syncLease(fixture);
}, /lease kind/);
await expectReject('non-SEALED state fails', fixture => {
  fixture.lease.state = 'ACTIVE'; syncLease(fixture);
}, /must be SEALED/);
await expectReject('expired lease fails', fixture => {
  fixture.lease.expiresAt = '2028-12-31T23:59:59.000Z'; syncLease(fixture);
}, /expired/);
await expectReject('remote main drift fails', fixture => {
  fixture.refs.set(TARGET_REF, OTHER);
}, /remote main drift/);
await expectReject('lease base mismatch fails', fixture => {
  fixture.lease.baseSha = OTHER; syncLease(fixture);
}, /baseSha mismatch/);
await expectReject('feature ref mismatch fails', fixture => {
  fixture.lease.featureRef = 'refs/heads/agent/other'; syncLease(fixture);
}, /featureRef mismatch/);
await expectReject('remote feature drift fails', fixture => {
  fixture.refs.set(FEATURE_REF, OTHER);
}, /remote feature drift/);
await expectReject('sealed head mismatch fails', fixture => {
  fixture.lease.sealedHead = OTHER; syncLease(fixture);
}, /sealedHead mismatch/);
await expectReject('sealed tree mismatch fails', fixture => {
  fixture.lease.sealedTree = OTHER; syncLease(fixture);
}, /sealedTree mismatch/);
await expectReject('predecessor mismatch fails', fixture => {
  fixture.lease.predecessor = OTHER; syncLease(fixture);
}, /predecessor mismatch/);
await expectReject('repository identity mismatch fails', fixture => {
  fixture.lease.repositoryRemote = 'https://github.com/other/repository.git'; syncLease(fixture);
}, /repository identity mismatch/);
await expectReject('head repository mismatch fails', fixture => {
  fixture.context.headRepository = 'attacker/fork';
}, /head repository must equal/);
await expectReject('base ref mismatch fails', fixture => {
  fixture.context.baseRef = 'release';
}, /base ref must be main/);
await expectReject('PR body cannot substitute canonical lease', fixture => {
  fixture.context.body = JSON.stringify(fixture.lease);
  fixture.context.comments = [{ body: JSON.stringify(fixture.lease) }];
  fixture.refs.set(LEASE_REF, null);
}, /coordination ref missing/);
await expectReject('malformed canonical lease fails', fixture => {
  fixture.files.set(`${COORD}:lease.json`, '{not-json');
}, /invalid lease JSON/);
await expectReject('SEALED coordination commit must be linear', fixture => {
  fixture.commits.set(COORD, { sha: COORD, treeSha: OTHER, parents: [PREDECESSOR, BASE] });
}, /exactly one parent/);
await expectPass('SSH GitHub remote normalizes to repository identity', fixture => {
  fixture.lease.repositoryRemote = 'git@github.com:BitMaster162/bitevo-agent-site.git';
  syncLease(fixture);
});
await expectReject('invalid head SHA fails before server reads', fixture => {
  fixture.context.headSha = 'not-a-sha';
}, /headSha must be a full lowercase SHA-1/);

assert.equal(assertions, 25);
console.log(`MUTATION_LEASE_AUDIT_HARNESS=PASS assertions=${assertions}`);
