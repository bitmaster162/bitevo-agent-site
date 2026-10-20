import { createHash, timingSafeEqual } from 'node:crypto';

// R50-B local qualification only. No provider storage adapter is wired here.
// A compliant adapter must atomically consume a pre-provisioned durable grant;
// a per-process Map, a rate limiter, or a caller assertion is NOT sufficient.
export type R50Policy = Readonly<{
  claimKey: string;
  policyDigest: string;
  trialId: string;
  approvedSha: string;
  notBeforeMs: number;
  expiresAtMs: number;
  day: string;
}>;
export type R50GrantClaim = Readonly<{
  claimKey: string;
  policyDigest: string;
  nowMs: number;
  expiresAtMs: number;
}>;
export interface R50GrantStore {
  // Must reject absent, revoked, expired, mismatched, or already-consumed grants.
  // Never create/rearm a grant as a side effect of this method. Never retry a
  // claim whose result is uncertain. The caller does not restore spent grants.
  consumeOnce(claim: R50GrantClaim): Promise<unknown>;
}
type Env = Record<string, string | undefined>;
type Denied = { kind: 'denied'; status: number; error: string };
export type R50Admission = Denied | { kind: 'legacy' } | { kind: 'trial'; policy: R50Policy };
const PROJECT = 'prj_U2iHyiwhJlO33r0u4uN65PpdzEiv';
const RECEIVER = 'https://bitevo-agent-site.mirokonkr.workers.dev/b1-2/event';
const URL = 'https://bitevo.work/api/event';
const TOKEN_HEADER = 'x-bitevo-r50-operator-token';
const ID_HEADER = 'x-bitevo-r50-trial-id';
const SHA256 = /^[0-9a-f]{64}$/;
const SHA1 = /^[0-9a-f]{40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PREFIX = 'BITEVO_EVENT_COUNTER_R50_';
const KEYS = new Set(['MODE', 'TRIAL_ID', 'OPERATOR_TOKEN_SHA256', 'APPROVED_SHA', 'NOT_BEFORE', 'EXPIRES_AT'].map(k => PREFIX + k));
const hash = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const denied = (status: number, error: string): Denied => ({ kind: 'denied', status, error });
function isoMs(value: string | undefined): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const n = Date.parse(value);
  return Number.isSafeInteger(n) && new Date(n).toISOString() === value ? n : null;
}
export function r50WindowOpen(policy: R50Policy, nowMs: number): boolean {
  return Number.isSafeInteger(nowMs) && nowMs >= policy.notBeforeMs && nowMs < policy.expiresAtMs;
}

export function inspectR50Admission(
  request: Request, env: Env, publicClientMode: unknown, nowMs: number,
  store?: R50GrantStore
): R50Admission {
  const suppliedKeys = Object.keys(env).filter(k => k.startsWith(PREFIX) && env[k] !== undefined);
  const hasHeaders = request.headers.has(TOKEN_HEADER) || request.headers.has(ID_HEADER);
  // Preserve the pre-existing non-R50 contract; partial R50 config cannot fall
  // through to it. Production remains OFF in the checked-in source/config.
  if (suppliedKeys.length === 0 && !hasHeaders) return { kind: 'legacy' };
  if (env.BITEVO_EVENT_COUNTER_R50_MODE !== 'operator-only'
    || suppliedKeys.length !== KEYS.size || suppliedKeys.some(k => !KEYS.has(k))
    || publicClientMode !== 'disabled'
    || env.BITEVO_EVENT_COUNTER_ENABLED !== 'true'
    || env.BITEVO_EVENT_COUNTER_PROVIDER_READY !== 'true'
    || env.VERCEL !== '1' || env.VERCEL_ENV !== 'production'
    || env.VERCEL_TARGET_ENV !== 'production'
    || env.VERCEL_PROJECT_ID !== PROJECT
    || env.BITEVO_EVENT_COUNTER_ALLOWED_PROJECT_ID !== PROJECT
    || env.BITEVO_EVENT_COUNTER_WORKER_URL !== RECEIVER
    || !store || typeof store.consumeOnce !== 'function') {
    return denied(503, 'R50_NOT_READY');
  }
  const trialId = env.BITEVO_EVENT_COUNTER_R50_TRIAL_ID || '';
  const approvedSha = env.BITEVO_EVENT_COUNTER_R50_APPROVED_SHA || '';
  const digest = env.BITEVO_EVENT_COUNTER_R50_OPERATOR_TOKEN_SHA256 || '';
  const secret = env.BITEVO_EVENT_COUNTER_SIGNING_SECRET || '';
  const start = isoMs(env.BITEVO_EVENT_COUNTER_R50_NOT_BEFORE);
  const end = isoMs(env.BITEVO_EVENT_COUNTER_R50_EXPIRES_AT);
  if (!UUID.test(trialId) || !SHA1.test(approvedSha) || /^0+$/.test(approvedSha)
    || env.VERCEL_GIT_COMMIT_SHA !== approvedSha
    || !SHA256.test(digest) || /^0+$/.test(digest)
    || Buffer.byteLength(secret, 'utf8') < 32 || digest === hash(secret)
    || start === null || end === null || start >= end
    || new Date(start).toISOString().slice(0, 10) !== new Date(end).toISOString().slice(0, 10)) {
    return denied(503, 'R50_NOT_READY');
  }
  if (!Number.isSafeInteger(nowMs) || nowMs < start || nowMs >= end) {
    return denied(403, 'R50_WINDOW_CLOSED');
  }
  if (request.method !== 'POST' || request.url !== URL
    || request.headers.get('origin') !== 'https://bitevo.work'
    || request.headers.get(ID_HEADER) !== trialId) return denied(403, 'R50_OPERATOR_REJECTED');
  const token = request.headers.get(TOKEN_HEADER) || '';
  if (!SHA256.test(token) || token === secret
    || !timingSafeEqual(Buffer.from(hash(token), 'hex'), Buffer.from(digest, 'hex'))) {
    return denied(403, 'R50_OPERATOR_REJECTED');
  }
  // The consumption key is stable across token rotation/expiry changes. Those
  // changes must not create a fresh allowance for the same trial identity.
  const claimKey = 'bitevo-r50-v1:' + PROJECT + ':' + trialId;
  const day = new Date(start).toISOString().slice(0, 10);
  const policyDigest = hash(JSON.stringify([
    claimKey, approvedSha, start, end, digest, RECEIVER,
    'triage_click', '/agent-authority-audit', 'en', day
  ]));
  const policy = Object.freeze({ claimKey, policyDigest, trialId, approvedSha, notBeforeMs: start, expiresAtMs: end, day });
  return { kind: 'trial', policy };
}

export function r50ExactEvent(value: { event: string; page: string; locale: string }): boolean {
  return value.event === 'triage_click' && value.page === '/agent-authority-audit' && value.locale === 'en';
}

export async function consumeR50Admission(
  policy: R50Policy, store: R50GrantStore | undefined, nowMs: number
): Promise<boolean> {
  if (!store || typeof store.consumeOnce !== 'function' || !r50WindowOpen(policy, nowMs)) return false;
  try {
    const result = await store.consumeOnce(Object.freeze({
      claimKey: policy.claimKey, policyDigest: policy.policyDigest,
      nowMs, expiresAtMs: policy.expiresAtMs
    }));
    if (!result || typeof result !== 'object' || Array.isArray(result)) return false;
    const row = result as Record<string, unknown>;
    return Object.keys(row).sort().join(',') === 'claimKey,consumedAtMs,outcome,policyDigest'
      && row.outcome === 'consumed' && row.claimKey === policy.claimKey
      && row.policyDigest === policy.policyDigest
      && typeof row.consumedAtMs === 'number'
      && row.consumedAtMs >= nowMs && r50WindowOpen(policy, row.consumedAtMs);
  } catch {
    // Failure/timeout may occur AFTER consumption. Do not release or retry.
    return false;
  }
}
