const canonicalGuides = new Set([
  '/guides/security-sandboxing',
  '/guides/fleet-coordinator-drift-monitoring',
  '/guides/d3-tool-io-bridge-contract',
  '/guides/before-write-access',
  '/guides/mcp-server-authority-review',
  '/guides/bitget-authority-after-orchestration-compromise'
]);

const EVENT_PATH = '/b1-2/event';
const REPORT_PATH = '/b1-2/event-report';
const EVENT_SCHEMA = 'bitevo.public-event.v1';
const EVENT_HMAC_DOMAIN = 'bitevo-public-event-v1';
const REPORT_HMAC_DOMAIN = 'bitevo-event-report-v1';
const EVENTS = new Set([
  'triage_click', 'mailto_click', 'scope_generated', 'pilot_click'
]);
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNATURE = /^v1=([0-9a-f]{64})$/;
const MAX_BODY = 2_000;
const SKEW_MS = 120_000;
const UPSERT = [
  'INSERT INTO bitevo_public_event_daily (day, event_name, page, locale, count)',
  'VALUES (?, ?, ?, ?, 1)',
  'ON CONFLICT(day, event_name, page, locale)',
  'DO UPDATE SET count = count + 1'
].join(' ');
const REPORT = [
  'SELECT day, event_name AS event, page, locale, count',
  'FROM bitevo_public_event_daily',
  'ORDER BY day DESC, event_name, page, locale',
  'LIMIT 500'
].join(' ');

function json(status, payload, extra = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
      ...extra
    }
  });
}

function ready(env) {
  return env?.BITEVO_EVENT_COUNTER_RECEIVER_ENABLED === 'true'
    && typeof env?.BITEVO_EVENT_COUNTER_SIGNING_SECRET === 'string'
    && new TextEncoder().encode(env.BITEVO_EVENT_COUNTER_SIGNING_SECRET).length >= 32
    && typeof env?.BITEVO_EVENT_DB?.prepare === 'function'
    && typeof env?.BITEVO_EVENT_RATE_LIMITER?.limit === 'function';
}

function reportReady(env) {
  return env?.BITEVO_EVENT_COUNTER_REPORT_ENABLED === 'true'
    && typeof env?.BITEVO_EVENT_COUNTER_REPORT_SECRET === 'string'
    && new TextEncoder().encode(env.BITEVO_EVENT_COUNTER_REPORT_SECRET).length >= 32
    && typeof env?.BITEVO_EVENT_DB?.prepare === 'function';
}

async function validSignature(secret, message, signatureHex) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const bytes = Uint8Array.from(signatureHex.match(/../g), value => parseInt(value, 16));
  return crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(message));
}

function headerAuth(request, domain, nowMs) {
  const timestamp = request.headers.get('x-bitevo-event-timestamp');
  const requestId = request.headers.get('x-bitevo-event-request-id');
  const rawSignature = request.headers.get('x-bitevo-event-signature') || '';
  const signature = SIGNATURE.exec(rawSignature);
  if (!/^[0-9]{10}$/.test(timestamp || '') || !UUID_V4.test(requestId || '')
    || !signature || Math.abs(Number(timestamp) * 1_000 - nowMs) > SKEW_MS) return null;
  return { timestamp, requestId, signature: signature[1], domain };
}

function validateRow(input, authorizedRequestId, nowMs) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const keys = Object.keys(input).sort().join(',');
  if (keys !== 'event,ipToken,locale,occurredAt,page,requestId,schema') return null;
  if (input.schema !== EVENT_SCHEMA || input.requestId !== authorizedRequestId) return null;
  if (!EVENTS.has(input.event) || !['ru', 'en'].includes(input.locale)) return null;
  if (typeof input.page !== 'string' || input.page.length > 180
    || !/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/.test(input.page)) return null;
  if (typeof input.ipToken !== 'string' || !/^[0-9a-f]{64}$/.test(input.ipToken)) return null;
  if (typeof input.occurredAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.occurredAt)) return null;
  const at = Date.parse(input.occurredAt);
  if (!Number.isFinite(at) || Math.abs(at - nowMs) > SKEW_MS) return null;
  if (new Date(at).toISOString() !== input.occurredAt) return null;
  return {
    day: input.occurredAt.slice(0, 10),
    event: input.event,
    page: input.page,
    locale: input.locale,
    ipToken: input.ipToken
  };
}

export async function handleBitEvoWorkerEvent(request, env = {}, nowMs = Date.now()) {
  if (env?.BITEVO_EVENT_COUNTER_RECEIVER_ENABLED !== 'true') {
    return json(404, { ok: false, error: 'NOT_FOUND' });
  }
  if (!ready(env)) return json(503, { ok: false, error: 'COUNTER_NOT_READY' });
  if (request.method !== 'POST') {
    return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
  }
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
    return json(415, { ok: false, error: 'UNSUPPORTED_MEDIA' });
  }
  const declared = Number(request.headers.get('content-length') || 0);
  if (!Number.isFinite(declared) || declared > MAX_BODY) {
    return json(413, { ok: false, error: 'BODY_TOO_LARGE' });
  }
  const auth = headerAuth(request, EVENT_HMAC_DOMAIN, nowMs);
  if (!auth) return json(401, { ok: false, error: 'UNAUTHORIZED' });
  let body;
  try {
    const raw = await request.arrayBuffer();
    if (raw.byteLength > MAX_BODY) return json(413, { ok: false, error: 'BODY_TOO_LARGE' });
    body = new TextDecoder().decode(raw);
  } catch {
    return json(400, { ok: false, error: 'BAD_REQUEST' });
  }
  const message = auth.domain + '.' + auth.timestamp + '.' + auth.requestId + '.' + body;
  const verified = await validSignature(env.BITEVO_EVENT_COUNTER_SIGNING_SECRET, message, auth.signature);
  if (!verified) return json(401, { ok: false, error: 'UNAUTHORIZED' });
  let input;
  try {
    input = JSON.parse(body);
  } catch {
    return json(400, { ok: false, error: 'INVALID_JSON' });
  }
  const row = validateRow(input, auth.requestId, nowMs);
  if (!row) return json(400, { ok: false, error: 'INVALID_EVENT' });

  try {
    const limit = await env.BITEVO_EVENT_RATE_LIMITER.limit({ key: 'event:' + row.ipToken });
    if (!limit || limit.success !== true) return json(429, { ok: false, error: 'RATE_LIMITED' });
  } catch {
    return json(503, { ok: false, error: 'RATE_LIMIT_UNAVAILABLE' });
  }
  try {
    const result = await env.BITEVO_EVENT_DB.prepare(UPSERT)
      .bind(row.day, row.event, row.page, row.locale).run();
    if (result?.success !== true || result?.meta?.changes !== 1) {
      return json(503, { ok: false, error: 'COUNTER_WRITE_UNCONFIRMED' });
    }
  } catch {
    return json(503, { ok: false, error: 'COUNTER_WRITE_UNCONFIRMED' });
  }
  return json(200, { ok: true, counted: true });
}

export async function handleBitEvoWorkerReport(request, env = {}, nowMs = Date.now()) {
  if (env?.BITEVO_EVENT_COUNTER_REPORT_ENABLED !== 'true') {
    return json(404, { ok: false, error: 'NOT_FOUND' });
  }
  if (!reportReady(env)) return json(503, { ok: false, error: 'REPORT_NOT_READY' });
  if (request.method !== 'GET') return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  const timestamp = request.headers.get('x-bitevo-report-timestamp');
  const requestId = request.headers.get('x-bitevo-report-request-id');
  const signature = SIGNATURE.exec(request.headers.get('x-bitevo-report-signature') || '');
  if (!/^[0-9]{10}$/.test(timestamp || '') || !UUID_V4.test(requestId || '')
    || !signature || Math.abs(Number(timestamp) * 1_000 - nowMs) > SKEW_MS) {
    return json(401, { ok: false, error: 'UNAUTHORIZED' });
  }
  const message = REPORT_HMAC_DOMAIN + '.' + timestamp + '.' + requestId;
  const verified = await validSignature(env.BITEVO_EVENT_COUNTER_REPORT_SECRET, message, signature[1]);
  if (!verified) return json(401, { ok: false, error: 'UNAUTHORIZED' });
  try {
    const result = await env.BITEVO_EVENT_DB.prepare(REPORT).all();
    if (!result || !Array.isArray(result.results)) {
      return json(503, { ok: false, error: 'REPORT_UNCONFIRMED' });
    }
    return json(200, { ok: true, rows: result.results });
  } catch {
    return json(503, { ok: false, error: 'REPORT_UNAVAILABLE' });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    if (path === EVENT_PATH) return handleBitEvoWorkerEvent(request, env);
    if (path === REPORT_PATH) return handleBitEvoWorkerReport(request, env);

    if (path === '/guides/ai-agent-reliability-audit') {
      return Response.redirect(new URL('/agent-authority-audit', url), 301);
    }
    if (path === '/ru/guides/ai-agent-reliability-audit') {
      return Response.redirect(new URL('/ru/agent-authority-audit', url), 301);
    }

    if (path.startsWith('/guides/') && !canonicalGuides.has(path)) {
      return Response.redirect(new URL('/guides', url), 302);
    }

    return env.ASSETS.fetch(request);
  }
};
