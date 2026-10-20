import { createHmac, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { inspectR50Admission, consumeR50Admission, r50ExactEvent, r50WindowOpen } from '../src/lib/b1-2/r50-operator-admission.ts';
import type { R50GrantStore } from '../src/lib/b1-2/r50-operator-admission.ts';
import { createR50DurableGrantStore } from '../src/lib/b1-2/r50-durable-grant-transport.ts';
import routeRegistry from '../src/data/public-route-registry.json' with { type: 'json' };
import eventCoverage from '../src/data/bitevo-event-coverage.json' with { type: 'json' };

type RuntimeEnv = Record<string, string | undefined>;
type Dependencies = {
  clientIp?: (request: Request) => string | null | Promise<string | null>;
  send?: typeof fetch;
  now?: () => number;
  uuid?: () => string;
  // No production grant-store adapter is installed by R50-B. Missing means deny.
  r50GrantStore?: R50GrantStore;
};

const SCHEMA = 'bitevo.public-event.v1';
const SIGNING_DOMAIN = 'bitevo-public-event-v1';
const CANONICAL_ORIGIN = 'https://bitevo.work';
const MAX_BODY_BYTES = 2_000;
const MIN_SECRET_BYTES = 32;
const ALLOWED_EVENTS = new Set([
  'triage_click', 'mailto_click', 'scope_generated', 'pilot_click'
]);
const PUBLIC_PATHS = new Map(
  (routeRegistry.routes || [])
    .filter((route: { path: string; locale: string; indexable: boolean }) => route.indexable)
    .map((route: { path: string; locale: string }) => [route.path, route.locale])
);

const COVERAGE_PATHS = new Map(
  (eventCoverage.schema === 'bitevo.event-coverage/v1'
    && (eventCoverage.defaultMode === 'disabled' || eventCoverage.defaultMode === 'enabled')
    ? eventCoverage.routes : [])
    .map((row: { path: string; locale: string; events: string[] }) => [row.path, row] as const)
);

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function receiverUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev')
      || url.username || url.password || url.port || url.search || url.hash
      || url.pathname !== '/b1-2/event') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function enabled(env: RuntimeEnv) {
  return env.BITEVO_EVENT_COUNTER_ENABLED === 'true';
}

function configured(env: RuntimeEnv) {
  const secret = env.BITEVO_EVENT_COUNTER_SIGNING_SECRET || '';
  const project = env.BITEVO_EVENT_COUNTER_ALLOWED_PROJECT_ID || '';
  const endpoint = receiverUrl(env.BITEVO_EVENT_COUNTER_WORKER_URL);
  if (env.BITEVO_EVENT_COUNTER_PROVIDER_READY !== 'true'
    || env.VERCEL !== '1'
    || env.VERCEL_ENV !== 'production'
    || env.VERCEL_TARGET_ENV !== 'production'
    || !project || project !== env.VERCEL_PROJECT_ID
    || Buffer.byteLength(secret, 'utf8') < MIN_SECRET_BYTES
    || !endpoint) return null;
  return { endpoint, secret };
}

function validatedPayload(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  if (Object.keys(row).sort().join(',') !== 'event,locale,page') return null;
  if (typeof row.event !== 'string' || !ALLOWED_EVENTS.has(row.event)) return null;
  if (row.locale !== 'ru' && row.locale !== 'en') return null;
  if (typeof row.page !== 'string' || row.page.length > 180
    || !/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/.test(row.page)) return null;
  if (PUBLIC_PATHS.get(row.page) !== row.locale) return null;
  const coverage = COVERAGE_PATHS.get(row.page);
  if (!coverage || coverage.locale !== row.locale || !coverage.events.includes(row.event)) return null;
  return { event: row.event, locale: row.locale, page: row.page };
}

async function platformIp(request: Request): Promise<string | null> {
  const mod = await import('@vercel/functions');
  return mod.ipAddress(request) || null;
}

export async function handleBitEvoPublicEvent(
  request: Request,
  env: RuntimeEnv = process.env,
  dependencies: Dependencies = {}
): Promise<Response> {
  if (!enabled(env)) return respond(404, { ok: false, error: 'NOT_FOUND' });
  if (request.method !== 'POST') return respond(405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  const config = configured(env);
  if (!config) return respond(503, { ok: false, error: 'COUNTER_NOT_READY' });
  if (request.headers.get('origin') !== CANONICAL_ORIGIN) {
    return respond(403, { ok: false, error: 'ORIGIN_REJECTED' });
  }
  // R50 can use the separately configured durable claim service only when
  // operator mode is explicitly authorized. Public event mounts stay OFF.
  const grantStore = dependencies.r50GrantStore
    ?? createR50DurableGrantStore(env);
  const r50 = inspectR50Admission(request, env, eventCoverage.defaultMode,
    dependencies.now ? dependencies.now() : Date.now(), grantStore);
  if (r50.kind === 'denied') return respond(r50.status, { ok: false, error: r50.error });
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
    return respond(415, { ok: false, error: 'UNSUPPORTED_MEDIA' });
  }
  const declared = Number(request.headers.get('content-length') || 0);
  if (!Number.isFinite(declared) || declared > MAX_BODY_BYTES) {
    return respond(413, { ok: false, error: 'BODY_TOO_LARGE' });
  }
  let bytes: Buffer;
  try {
    bytes = Buffer.from(await request.arrayBuffer());
  } catch {
    return respond(400, { ok: false, error: 'BAD_REQUEST' });
  }
  if (bytes.length > MAX_BODY_BYTES) return respond(413, { ok: false, error: 'BODY_TOO_LARGE' });
  let data: unknown;
  try {
    data = JSON.parse(bytes.toString('utf8'));
  } catch {
    return respond(400, { ok: false, error: 'INVALID_JSON' });
  }
  const safe = validatedPayload(data);
  if (!safe) return respond(400, { ok: false, error: 'INVALID_EVENT' });
  if (r50.kind === 'trial' && !r50ExactEvent(safe)) {
    return respond(403, { ok: false, error: 'R50_SCOPE_REJECTED' });
  }

  let ip: string | null;
  try {
    ip = await (dependencies.clientIp ? dependencies.clientIp(request) : platformIp(request));
  } catch {
    return respond(503, { ok: false, error: 'COUNTER_NOT_READY' });
  }
  if (!ip || !isIP(ip)) return respond(503, { ok: false, error: 'COUNTER_NOT_READY' });

  const ipToken = createHmac('sha256', config.secret)
    .update('bitevo-event-ip-v1:' + ip).digest('hex');
  const requestId = dependencies.uuid ? dependencies.uuid() : randomUUID();
  const nowMs = dependencies.now ? dependencies.now() : Date.now();
  if (r50.kind === 'trial' && !r50WindowOpen(r50.policy, nowMs)) {
    return respond(403, { ok: false, error: 'R50_WINDOW_CLOSED' });
  }
  const occurredAt = new Date(nowMs).toISOString();
  const body = JSON.stringify({
    schema: SCHEMA, requestId, occurredAt,
    event: safe.event, page: safe.page, locale: safe.locale, ipToken
  });
  const timestamp = String(Math.floor(nowMs / 1000));
  const signature = createHmac('sha256', config.secret)
    .update(SIGNING_DOMAIN + '.' + timestamp + '.' + requestId + '.' + body)
    .digest('hex');

  if (r50.kind === 'trial') {
    const consumed = await consumeR50Admission(r50.policy, grantStore, nowMs);
    if (!consumed) return respond(503, { ok: false, error: 'R50_GRANT_UNCONFIRMED' });
    const afterClaim = dependencies.now ? dependencies.now() : Date.now();
    if (!r50WindowOpen(r50.policy, afterClaim)) {
      return respond(403, { ok: false, error: 'R50_WINDOW_CLOSED' });
    }
    // The grant remains consumed on every downstream outcome, including timeout.
  }

  try {
    const send = dependencies.send || fetch;
    const downstream = await send(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BitEvo-Event-Timestamp': timestamp,
        'X-BitEvo-Event-Request-Id': requestId,
        'X-BitEvo-Event-Signature': 'v1=' + signature
      },
      body,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000)
    });
    if (!downstream.ok) return respond(502, { ok: false, error: 'COUNTER_UNAVAILABLE' });
    const receipt = await downstream.json() as Record<string, unknown>;
    if (receipt.ok !== true || receipt.counted !== true) {
      return respond(502, { ok: false, error: 'COUNTER_UNCONFIRMED' });
    }
  } catch {
    return respond(502, { ok: false, error: 'COUNTER_UNAVAILABLE' });
  }
  return respond(200, { ok: true, counted: true });
}

export default {
  fetch(request: Request): Promise<Response> {
    return handleBitEvoPublicEvent(request);
  }
};
