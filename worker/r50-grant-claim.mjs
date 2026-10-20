// Separate, UNDEPLOYED local-only companion Worker for R50 single-use permits.
// Never modify the existing public event Worker to enable this path.
const PATH = '/r50/claim';
const DOMAIN = 'bitevo-r50-grant-claim-v1';
const SCOPED_KEY = /^bitevo-r50-v1:prj_U2iHyiwhJlO33r0u4uN65PpdzEiv:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNATURE = /^v1=([0-9a-f]{64})$/;
const SHA = /^[0-9a-f]{64}$/;
const MAX_BODY = 512;
const SKEW_MS = 30_000;
const MAX_WINDOW = 10 * 60_000;

// A single conditional UPDATE, not SELECT followed by UPDATE. Claim rows must
// already exist. No INSERT, UPSERT, reset, rearm, or grant issuance is provided.
export const R50_CONSUME_SQL = [
  'UPDATE bitevo_r50_operator_grants SET consumed_at_ms = ?',
  'WHERE claim_key = ? AND policy_digest = ?',
  'AND revoked_at_ms IS NULL AND consumed_at_ms IS NULL',
  'AND not_before_ms <= ? AND expires_at_ms = ? AND expires_at_ms > ?'
].join(' ');

function answer(status, data) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex',
      'X-Content-Type-Options': 'nosniff' }
  });
}
async function checkSignature(secret, message, received) {
  try {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const bytes = Uint8Array.from(received.match(/../g), s => parseInt(s, 16));
    return await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(message));
  } catch { return false; }
}

export async function handleR50GrantClaim(request, env = {}, now = Date.now()) {
  let url;
  try { url = new URL(request.url); } catch { return answer(404, { error: 'NOT_FOUND' }); }
  if (url.pathname !== PATH || url.search || url.hash || url.username || url.password)
    return answer(404, { error: 'NOT_FOUND' });
  if (env.BITEVO_R50_GRANT_RECEIVER_ENABLED !== 'true') return answer(404, { error: 'NOT_FOUND' });
  const secret = env.BITEVO_EVENT_COUNTER_SIGNING_SECRET;
  if (typeof secret !== 'string' || new TextEncoder().encode(secret).length < 32
    || typeof env.BITEVO_R50_GRANT_DB?.prepare !== 'function')
    return answer(503, { error: 'NOT_READY' });
  if (request.method !== 'POST') return answer(405, { error: 'METHOD_NOT_ALLOWED' });
  if (request.headers.get('content-type') !== 'application/json')
    return answer(415, { error: 'UNSUPPORTED_MEDIA' });
  const size = Number(request.headers.get('content-length') || 0);
  if (!Number.isSafeInteger(size) || size > MAX_BODY) return answer(413, { error: 'BODY_TOO_LARGE' });
  const timestamp = request.headers.get('x-bitevo-r50-claim-timestamp');
  const requestId = request.headers.get('x-bitevo-r50-claim-request-id');
  const signature = SIGNATURE.exec(request.headers.get('x-bitevo-r50-claim-signature') || '');
  if (!/^[0-9]{10}$/.test(timestamp || '') || !UUID.test(requestId || '')
    || !signature || !Number.isSafeInteger(now) || Math.abs(Number(timestamp) * 1000 - now) > SKEW_MS)
    return answer(401, { error: 'UNAUTHORIZED' });
  let body;
  try { body = await request.text(); } catch { return answer(400, { error: 'BAD_REQUEST' }); }
  if (new TextEncoder().encode(body).length > MAX_BODY) return answer(413, { error: 'BODY_TOO_LARGE' });
  if (!(await checkSignature(secret,
    DOMAIN + '.' + timestamp + '.' + requestId + '.' + body, signature[1]))) {
    return answer(401, { error: 'UNAUTHORIZED' });
  }
  let row;
  try { row = JSON.parse(body); } catch { return answer(400, { error: 'INVALID_JSON' }); }
  if (!row || typeof row !== 'object' || Array.isArray(row)
    || Object.keys(row).sort().join(',') !== 'claimKey,expiresAtMs,nowMs,policyDigest'
    || !SCOPED_KEY.test(row.claimKey) || !SHA.test(row.policyDigest)
    || !Number.isSafeInteger(row.nowMs) || !Number.isSafeInteger(row.expiresAtMs)
    || Math.abs(row.nowMs - now) > SKEW_MS
    || row.expiresAtMs <= row.nowMs || row.expiresAtMs - row.nowMs > MAX_WINDOW) {
    return answer(400, { error: 'INVALID_CLAIM' });
  }
  try {
    const result = await env.BITEVO_R50_GRANT_DB.prepare(R50_CONSUME_SQL)
      .bind(row.nowMs, row.claimKey, row.policyDigest, row.nowMs, row.expiresAtMs, row.nowMs)
      .run();
    if (result?.success !== true || result?.meta?.changes !== 1
      || result?.meta?.rows_written !== 1 || result?.meta?.changed_db !== true)
      return answer(409, { error: 'GRANT_UNAVAILABLE' });
  } catch {
    return answer(503, { error: 'GRANT_UNCONFIRMED' });
  }
  return answer(200, { outcome: 'consumed', claimKey: row.claimKey,
    policyDigest: row.policyDigest, consumedAtMs: row.nowMs });
}

export default {
  fetch(request, env) { return handleR50GrantClaim(request, env); }
};
