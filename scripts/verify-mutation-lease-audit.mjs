#!/usr/bin/env node
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { pathToFileURL } from 'node:url';

export const LEASE_REF = 'refs/heads/coordination/site-mutation-lease';
export const TARGET_REF = 'refs/heads/main';
export const WORKFLOW_PATH = '.github/workflows/mutation-lease-audit.yml';
export const VERIFIER_PATH = 'scripts/verify-mutation-lease-audit.mjs';
export const COORDINATION_VERCEL_PATH = 'vercel.json';
const COORDINATION_VERCEL_SCHEMA = 'https://openapi.vercel.sh/vercel.json';
const SCHEMA_VERSION = 1;
const KIND = 'bitevo-site-mutation-lease';
const CHECK_NAME = 'mutation-lease-audit';

export class AuditError extends Error {}

function fail(message) {
  throw new AuditError(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertSha(value, label) {
  assert(typeof value === 'string' && /^[0-9a-f]{40}$/.test(value), `${label} must be a full lowercase SHA-1`);
  return value;
}

function assertCoordinationVercelConfig(raw) {
  let config;
  try {
    config = JSON.parse(raw);
  } catch {
    fail('coordination vercel.json must be valid JSON');
  }
  assert(config?.$schema === COORDINATION_VERCEL_SCHEMA, 'coordination vercel.json schema mismatch');
  assert(config?.git?.deploymentEnabled === false, 'coordination vercel.json must disable Git deployments');
  assert(Object.keys(config).length === 2, 'coordination vercel.json must contain only $schema and git');
  assert(config.git && Object.keys(config.git).length === 1, 'coordination vercel.json git block must contain only deploymentEnabled');
}
export function normalizeRepositoryIdentity(remote) {
  assert(typeof remote === 'string' && remote.trim(), 'repositoryRemote must be a non-empty string');
  const value = remote.trim();
  let host;
  let pathname;
  if (/^[^@]+@[^:]+:.+$/.test(value)) {
    const match = value.match(/^[^@]+@([^:]+):(.+)$/);
    host = match?.[1];
    pathname = match?.[2];
  } else {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      fail(`unsupported repositoryRemote: ${value}`);
    }
    host = parsed.hostname;
    pathname = parsed.pathname.replace(/^\//, '');
  }
  assert(host?.toLowerCase() === 'github.com', `repositoryRemote host must be github.com: ${host || 'missing'}`);
  const identity = pathname.replace(/\.git$/i, '').replace(/^\//, '').replace(/\/$/, '').toLowerCase();
  assert(/^[^/]+\/[^/]+$/.test(identity), `invalid repository identity: ${identity}`);
  return identity;
}

function requireContext(context) {
  const repository = String(context.repository || '').toLowerCase();
  assert(/^[^/]+\/[^/]+$/.test(repository), 'repository must be owner/name');
  assert(context.baseRef === 'main', `base ref must be main; actual=${context.baseRef || 'missing'}`);
  assert(String(context.headRepository || '').toLowerCase() === repository, 'head repository must equal audited repository');
  assertSha(context.baseSha, 'baseSha');
  assertSha(context.headSha, 'headSha');
  assert(typeof context.headRef === 'string' && context.headRef && !context.headRef.startsWith('refs/'), 'headRef must be a branch name');
  return { ...context, repository };
}
export async function auditMutationLease(contextInput, api, { nowMs = Date.now() } = {}) {
  const context = requireContext(contextInput);
  const workflowAtBase = await api.fileExists(context.baseSha, WORKFLOW_PATH);
  const verifierAtBase = await api.fileExists(context.baseSha, VERIFIER_PATH);

  if (!workflowAtBase && !verifierAtBase) {
    return {
      status: 'PASS_BOOTSTRAP',
      reason: 'audit_implementation_absent_from_exact_pr_base',
      baseSha: context.baseSha,
      headSha: context.headSha,
    };
  }
  assert(workflowAtBase && verifierAtBase, 'audit implementation is incomplete at exact PR base');

  const remoteMain = await api.getRef(TARGET_REF);
  assert(remoteMain === context.baseSha, `remote main drift: expected PR base ${context.baseSha}, actual ${remoteMain || 'missing'}`);

  const coordinationSha = await api.getRef(LEASE_REF);
  assert(coordinationSha, `canonical coordination ref missing: ${LEASE_REF}`);
  assertSha(coordinationSha, 'coordinationSha');
  const coordinationCommit = await api.getCommit(coordinationSha);
  assert(Array.isArray(coordinationCommit.parents) && coordinationCommit.parents.length === 1,
    `SEALED coordination commit must have exactly one parent; actual=${coordinationCommit.parents?.length ?? 'missing'}`);

  const suppressionExists = await api.fileExists(coordinationSha, COORDINATION_VERCEL_PATH);
  assert(suppressionExists, `coordination suppression config missing: ${COORDINATION_VERCEL_PATH}`);
  const rawSuppression = await api.getFileText(coordinationSha, COORDINATION_VERCEL_PATH);
  assertCoordinationVercelConfig(rawSuppression);

  const rawLease = await api.getFileText(coordinationSha, 'lease.json');
  let lease;
  try {
    lease = JSON.parse(rawLease);
  } catch {
    fail(`invalid lease JSON at coordination commit ${coordinationSha}`);
  }
  assert(lease?.schemaVersion === SCHEMA_VERSION, `unsupported lease schemaVersion: ${lease?.schemaVersion}`);
  assert(lease?.kind === KIND, `unsupported lease kind: ${lease?.kind || 'missing'}`);
  assert(lease?.state === 'SEALED', `lease state must be SEALED; actual=${lease?.state || 'missing'}`);
  const expiryMs = new Date(lease.expiresAt).getTime();
  assert(Number.isFinite(expiryMs), `lease expiresAt is invalid: ${lease.expiresAt}`);
  assert(expiryMs > nowMs, `lease expired at ${lease.expiresAt}`);
  assert(lease.targetRef === TARGET_REF, `lease targetRef mismatch: ${lease.targetRef || 'missing'}`);
  assert(lease.baseSha === context.baseSha, `lease baseSha mismatch: expected=${context.baseSha} actual=${lease.baseSha || 'missing'}`);
  assert(normalizeRepositoryIdentity(lease.repositoryRemote) === context.repository,
    `repository identity mismatch: lease=${normalizeRepositoryIdentity(lease.repositoryRemote)} audited=${context.repository}`);

  const expectedFeatureRef = `refs/heads/${context.headRef}`;
  assert(lease.featureRef === expectedFeatureRef,
    `featureRef mismatch: expected=${expectedFeatureRef} actual=${lease.featureRef || 'missing'}`);
  const remoteFeature = await api.getRef(expectedFeatureRef);
  assert(remoteFeature === context.headSha,
    `remote feature drift: expected=${context.headSha} actual=${remoteFeature || 'missing'}`);
  assert(lease.sealedHead === context.headSha,
    `sealedHead mismatch: expected=${context.headSha} actual=${lease.sealedHead || 'missing'}`);

  const headCommit = await api.getCommit(context.headSha);
  assertSha(headCommit.treeSha, 'head tree');
  assert(lease.sealedTree === headCommit.treeSha,
    `sealedTree mismatch: expected=${headCommit.treeSha} actual=${lease.sealedTree || 'missing'}`);

  const coordinationParent = coordinationCommit.parents[0];
  assert(lease.predecessor === coordinationParent,
    `predecessor mismatch: expected=${coordinationParent} actual=${lease.predecessor || 'missing'}`);
  return {
    status: 'PASS',
    coordinationSha,
    predecessor: coordinationParent,
    baseSha: context.baseSha,
    headSha: context.headSha,
    headTree: headCommit.treeSha,
    featureRef: expectedFeatureRef,
  };
}

function encodePath(value) {
  return String(value).split('/').map(encodeURIComponent).join('/');
}

export class GitHubServerApi {
  constructor({ token, repository, serverUrl = 'https://github.com', apiUrl = 'https://api.github.com' }) {
    assert(token, 'GITHUB_TOKEN is required');
    assert(/^[^/]+\/[^/]+$/.test(repository), 'repository must be owner/name');
    this.token = token;
    this.repository = repository;
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.apiBase = `${apiUrl.replace(/\/$/, '')}/repos/${repository}`;
  }

  async request(path, { method = 'GET', body, allow404 = false } = {}) {
    const response = await fetch(`${this.apiBase}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'bitevo-mutation-lease-audit',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (allow404 && response.status === 404) return null;
    if (!response.ok) fail(`GitHub API ${method} ${path} failed: HTTP ${response.status}`);
    return response.status === 204 ? null : response.json();
  }
  async fileExists(commitSha, path) {
    const result = await this.request(`/contents/${encodePath(path)}?ref=${encodeURIComponent(commitSha)}`, { allow404: true });
    return result !== null;
  }

  async getFileText(commitSha, path) {
    const result = await this.request(`/contents/${encodePath(path)}?ref=${encodeURIComponent(commitSha)}`);
    assert(result?.encoding === 'base64' && typeof result.content === 'string', `unexpected content response for ${path}`);
    return Buffer.from(result.content.replace(/\n/g, ''), 'base64').toString('utf8');
  }

  async getRef(fullRef) {
    assert(fullRef.startsWith('refs/'), `invalid full ref: ${fullRef}`);
    const shortRef = fullRef.slice('refs/'.length);
    const result = await this.request(`/git/ref/${encodePath(shortRef)}`, { allow404: true });
    return result?.object?.sha || null;
  }

  async getCommit(sha) {
    assertSha(sha, 'commit sha');
    const result = await this.request(`/git/commits/${sha}`);
    return {
      sha: result.sha,
      treeSha: result?.tree?.sha,
      parents: Array.isArray(result?.parents) ? result.parents.map(parent => parent.sha) : [],
    };
  }

  async publishCheck(headSha, { conclusion, title, summary, runId }) {
    assertSha(headSha, 'headSha');
    return this.request('/check-runs', {
      method: 'POST',
      body: {
        name: CHECK_NAME,
        head_sha: headSha,
        status: 'completed',
        conclusion,
        details_url: runId ? `${this.serverUrl}/${this.repository}/actions/runs/${runId}` : undefined,
        output: { title, summary },
      },
    });
  }
}
function envContext() {
  assert(process.env.GITHUB_EVENT_NAME === 'pull_request_target',
    `workflow event must be pull_request_target; actual=${process.env.GITHUB_EVENT_NAME || 'missing'}`);
  return {
    repository: process.env.AUDIT_REPOSITORY || process.env.GITHUB_REPOSITORY,
    baseSha: process.env.AUDIT_BASE_SHA,
    headSha: process.env.AUDIT_HEAD_SHA,
    headRef: process.env.AUDIT_HEAD_REF,
    baseRef: process.env.AUDIT_BASE_REF,
    headRepository: process.env.AUDIT_HEAD_REPOSITORY,
  };
}

async function runCli() {
  const context = envContext();
  const api = new GitHubServerApi({
    token: process.env.GITHUB_TOKEN,
    repository: context.repository,
    serverUrl: process.env.GITHUB_SERVER_URL || 'https://github.com',
    apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
  });
  let result;
  let error;
  try {
    result = await auditMutationLease(context, api);
  } catch (caught) {
    error = caught instanceof Error ? caught : new Error(String(caught));
  }

  if (process.env.REPORT_CHECK === '1') {
    const success = !error;
    const summary = success
      ? `${result.status}: base=${context.baseSha} head=${context.headSha}${result.coordinationSha ? ` coordination=${result.coordinationSha}` : ''}`
      : `FAIL: ${error.message}`;
    await api.publishCheck(context.headSha, {
      conclusion: success ? 'success' : 'failure',
      title: success ? `Mutation lease audit ${result.status}` : 'Mutation lease audit failed',
      summary,
      runId: process.env.GITHUB_RUN_ID,
    });
  }

  if (error) {
    console.error(`MUTATION_LEASE_AUDIT=FAIL reason=${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`MUTATION_LEASE_AUDIT=${result.status} base=${result.baseSha} head=${result.headSha}${result.coordinationSha ? ` coordination=${result.coordinationSha}` : ''}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
