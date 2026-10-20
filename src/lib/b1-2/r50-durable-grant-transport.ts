import { createHmac, randomUUID } from 'node:crypto';
import type { R50GrantClaim, R50GrantStore } from './r50-operator-admission.ts';

// Not a credential. This path and HMAC domain are protocol constants.
// This adapter has exactly ONE claim attempt; uncertain results are never retried.
export const R50_CLAIM_PATH = '/r50/claim';
export const R50_CLAIM_DOMAIN = 'bitevo-r50-grant-claim-v1';
const MIN_SECRET_BYTES = 32;
const MAX_RECEIPT_BYTES = 512;
const MAX_CLAIM_BYTES = 512;
const EXACT_RECEIPT_KEYS = 'claimKey,consumedAtMs,outcome,policyDigest';
const SHA = /^[0-9a-f]{64}$/;
const KEY = /^bitevo-r50-v1:prj_U2iHyiwhJlO33r0u4uN65PpdzEiv:[0-9a-f-]{36}$/i;

type RuntimeEnv = Record<string, string | undefined>;

export function createR50DurableGrantStore(
  env: RuntimeEnv, send: typeof fetch = fetch
): R50GrantStore | undefined {
  if (env.BITEVO_EVENT_COUNTER_R50_MODE !== 'operator-only'
    || env.BITEVO_EVENT_COUNTER_ENABLED !== 'true'
    || env.BITEVO_EVENT_COUNTER_PROVIDER_READY !== 'true') return undefined;

  const secret = env.BITEVO_EVENT_COUNTER_SIGNING_SECRET || '';
  const rawUrl = env.BITEVO_EVENT_GRANT_CLAIM_URL;
  if (Buffer.byteLength(secret, 'utf8') < MIN_SECRET_BYTES || !rawUrl) return undefined;
  let claimUrl: URL;
  try { claimUrl = new URL(rawUrl); } catch { return undefined; }
  if (claimUrl.protocol !== 'https:' || !claimUrl.hostname.endsWith('.workers.dev')
    || claimUrl.hostname === 'bitevo-agent-site.mirokonkr.workers.dev'
    || claimUrl.username || claimUrl.password || claimUrl.port || claimUrl.hash
    || claimUrl.search || claimUrl.pathname !== R50_CLAIM_PATH) return undefined;

  return {
    async consumeOnce(claim: R50GrantClaim): Promise<unknown> {
      if (!claim || !KEY.test(claim.claimKey) || !SHA.test(claim.policyDigest)
        || !Number.isSafeInteger(claim.nowMs) || !Number.isSafeInteger(claim.expiresAtMs)
        || claim.expiresAtMs <= claim.nowMs) return null;
      const body = JSON.stringify({
        claimKey: claim.claimKey,
        policyDigest: claim.policyDigest,
        nowMs: claim.nowMs,
        expiresAtMs: claim.expiresAtMs
      });
      if (Buffer.byteLength(body, 'utf8') > MAX_CLAIM_BYTES) return null;
      const requestId = randomUUID();
      const timestamp = String(Math.floor(claim.nowMs / 1000));
      const signature = createHmac('sha256', secret)
        .update(R50_CLAIM_DOMAIN + '.' + timestamp + '.' + requestId + '.' + body)
        .digest('hex');
      try {
        const response = await send(claimUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-BitEvo-R50-Claim-Timestamp': timestamp,
            'X-BitEvo-R50-Claim-Request-Id': requestId,
            'X-BitEvo-R50-Claim-Signature': 'v1=' + signature
          },
          body, redirect: 'error', credentials: 'omit',
          cache: 'no-store', signal: AbortSignal.timeout(4_000)
        });
        if (response.status !== 200 || !response.ok
          || Number(response.headers.get('content-length') || 0) > MAX_RECEIPT_BYTES) return null;
        const text = await response.text();
        if (Buffer.byteLength(text, 'utf8') > MAX_RECEIPT_BYTES) return null;
        const result: unknown = JSON.parse(text);
        if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
        const row = result as Record<string, unknown>;
        if (Object.keys(row).sort().join(',') !== EXACT_RECEIPT_KEYS
          || row.outcome !== 'consumed' || row.claimKey !== claim.claimKey
          || row.policyDigest !== claim.policyDigest || row.consumedAtMs !== claim.nowMs) return null;
        return row;
      } catch {
        // Response loss may follow a successful atomic consume. No retry/refund.
        return null;
      }
    }
  };
}
