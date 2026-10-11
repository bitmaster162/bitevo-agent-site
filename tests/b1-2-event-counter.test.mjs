import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import { handleBitEvoPublicEvent } from '../api/event.ts';
import worker, { handleBitEvoWorkerEvent, handleBitEvoWorkerReport } from '../worker/index.mjs';

const secret = 'test-only-bitevo-b1-2-hmac-secret-00000000000000';
const reportSecret = 'test-only-bitevo-b1-2-report-secret-0000000000';
const dateNow = Date.now();
const requestId = '11111111-2222-4333-8444-555555555555';

const ingressEnv = {
  BITEVO_EVENT_COUNTER_ENABLED: 'true',
  BITEVO_EVENT_COUNTER_PROVIDER_READY: 'true',
  BITEVO_EVENT_COUNTER_SIGNING_SECRET: secret,
  BITEVO_EVENT_COUNTER_WORKER_URL: 'https://bitevo-event-receiver.workers.dev/b1-2/event',
  BITEVO_EVENT_COUNTER_ALLOWED_PROJECT_ID: 'prj_bitevo_local_only',
  VERCEL: '1',
  VERCEL_ENV: 'production',
  VERCEL_TARGET_ENV: 'production',
  VERCEL_PROJECT_ID: 'prj_bitevo_local_only'
};
const sendData = { event: 'triage_click', page: '/pricing', locale: 'en' };
function eventRequest(body = sendData, origin = 'https://bitevo.work') {
  return new Request('https://bitevo.work/api/event', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body)
  });
}
function dbFake() {
  const state = { inserted: [], sql: [], reports: [] };
  state.prepare = sql => {
    state.sql.push(sql);
    if (sql.startsWith('SELECT')) {
      return { all: async () => ({ results: state.reports }) };
    }
    return {
      bind(...values) {
        return {
          run: async () => {
            state.inserted.push(values);
            return { success: true, meta: { changes: 1 } };
          }
        };
      }
    };
  };
  return state;
}
function workerEnv(db = dbFake(), limitOk = true) {
  return {
    BITEVO_EVENT_COUNTER_RECEIVER_ENABLED: 'true',
    BITEVO_EVENT_COUNTER_SIGNING_SECRET: secret,
    BITEVO_EVENT_RATE_LIMITER: {
      calls: [],
      async limit(input) {
        this.calls.push(input);
        return { success: limitOk };
      }
    },
    BITEVO_EVENT_DB: db
  };
}
const hooks = {
  clientIp: async () => '203.0.113.17',
  now: () => dateNow,
  uuid: () => requestId
};

test('disabled Vercel ingress never touches network', async () => {
  let called = 0;
  const r = await handleBitEvoPublicEvent(eventRequest(), {}, {
    ...hooks, send: async () => { called += 1; throw Error('unexpected fetch'); }
  });
  assert.equal(r.status, 404);
  assert.equal(called, 0);
});

test('ingress fails closed without platform pin, secret, worker or origin', async () => {
  for (const env of [
    { ...ingressEnv, BITEVO_EVENT_COUNTER_PROVIDER_READY: 'false' },
    { ...ingressEnv, BITEVO_EVENT_COUNTER_SIGNING_SECRET: 'short' },
    { ...ingressEnv, BITEVO_EVENT_COUNTER_WORKER_URL: 'http://localhost/b1-2/event' },
    { ...ingressEnv, VERCEL_PROJECT_ID: 'prj_wrong' },
    { ...ingressEnv, VERCEL_ENV: 'preview' }
  ]) {
    const r = await handleBitEvoPublicEvent(eventRequest(), env, hooks);
    assert.equal(r.status, 503);
  }
  assert.equal(
    (await handleBitEvoPublicEvent(eventRequest(sendData, 'https://example.org'), ingressEnv, hooks)).status,
    403
  );
});

test('ingress validates exact three keys, public registry route and matching locale', async () => {
  for (const data of [
    { ...sendData, contact: 'someone@example.com' },
    { ...sendData, cookie: 'identifier' },
    { ...sendData, page: '/pricing?contact=x' },
    { ...sendData, page: '/private/email' },
    { ...sendData, event: 'lead_submit_ok' },
    { ...sendData, locale: 'ru' },
    { ...sendData, page: '//pricing' }
  ]) {
    assert.equal((await handleBitEvoPublicEvent(eventRequest(data), ingressEnv, hooks)).status, 400);
  }
});

test('real HMAC envelope increments fake D1 aggregate with exactly four values', async () => {
  const db = dbFake();
  const env = workerEnv(db);
  const calls = [];
  const r = await handleBitEvoPublicEvent(eventRequest(), ingressEnv, {
    ...hooks,
    send: async (url, options) => {
      calls.push({ url, options });
      return worker.fetch(new Request(url, options), env);
    }
  });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, counted: true });
  assert.equal(calls.length, 1);
  const forwarded = JSON.parse(calls[0].options.body);
  assert.deepEqual(Object.keys(forwarded).sort(),
    ['schema', 'requestId', 'occurredAt', 'event', 'page', 'locale', 'ipToken'].sort());
  assert.equal(forwarded.event, 'triage_click');
  assert.equal(forwarded.page, '/pricing');
  assert.equal(forwarded.locale, 'en');
  assert.equal(forwarded.schema, 'bitevo.public-event.v1');
  assert.equal(forwarded.ipToken,
    createHmac('sha256', secret).update('bitevo-event-ip-v1:203.0.113.17').digest('hex'));
  assert.equal(calls[0].options.body.includes('203.0.113.17'), false);
  assert.deepEqual(db.inserted,
    [[new Date(dateNow).toISOString().slice(0, 10), 'triage_click', '/pricing', 'en']]);
  assert.equal(env.BITEVO_EVENT_RATE_LIMITER.calls.length, 1);
  assert.equal(env.BITEVO_EVENT_RATE_LIMITER.calls[0].key.includes('203.0.113.17'), false);
});

test('four events supported via same audited ingress/receiver contract', async () => {
  for (const event of ['triage_click', 'mailto_click', 'scope_generated', 'pilot_click']) {
    const db = dbFake();
    const env = workerEnv(db);
    const r = await handleBitEvoPublicEvent(
      eventRequest({ event, page: '/pricing', locale: 'en' }), ingressEnv,
      { ...hooks, send: async (url, options) => worker.fetch(new Request(url, options), env) }
    );
    assert.equal(r.status, 200, event);
    assert.equal(db.inserted[0][1], event);
  }
});

test('receiver fails closed, rejects tampering and blocks missing rate limiter', async () => {
  const db = dbFake();
  const env = workerEnv(db);
  const receipt = [];
  const r = await handleBitEvoPublicEvent(eventRequest(), ingressEnv, {
    ...hooks, send: async (url, init) => {
      receipt.push({ url, init });
      return Response.json({ ok: true, counted: true });
    }
  });
  assert.equal(r.status, 200);
  const { url, init } = receipt[0];
  const disabled = await handleBitEvoWorkerEvent(new Request(url, init), {});
  assert.equal(disabled.status, 404);

  const broken = JSON.parse(init.body);
  broken.event = 'mailto_click';
  const forgedRequest = new Request(url, { ...init, body: JSON.stringify(broken) });
  assert.equal((await handleBitEvoWorkerEvent(forgedRequest, env, dateNow)).status, 401);
  assert.equal(db.inserted.length, 0);
  const noLimiter = { ...env, BITEVO_EVENT_RATE_LIMITER: undefined };
  assert.equal((await handleBitEvoWorkerEvent(new Request(url, init), noLimiter, dateNow)).status, 503);
  assert.equal(db.inserted.length, 0);
  const limited = workerEnv(db, false);
  assert.equal((await handleBitEvoWorkerEvent(new Request(url, init), limited, dateNow)).status, 429);
  assert.equal(db.inserted.length, 0);
});

test('report is private and reports aggregates only after a signed GET', async () => {
  const db = dbFake();
  db.reports = [{
    day: '2026-10-11', event: 'triage_click', page: '/pricing', locale: 'en', count: 2
  }];
  const url = 'https://bitevo-event-receiver.workers.dev/b1-2/event-report';
  assert.equal((await handleBitEvoWorkerReport(new Request(url), { BITEVO_EVENT_DB: db })).status, 404);
  const timestamp = String(Math.floor(dateNow / 1_000));
  const signature = createHmac('sha256', reportSecret)
    .update('bitevo-event-report-v1.' + timestamp + '.' + requestId).digest('hex');
  const request = new Request(url, {
    headers: {
      'X-BitEvo-Report-Timestamp': timestamp,
      'X-BitEvo-Report-Request-Id': requestId,
      'X-BitEvo-Report-Signature': 'v1=' + signature
    }
  });
  const response = await handleBitEvoWorkerReport(request, {
    BITEVO_EVENT_COUNTER_REPORT_ENABLED: 'true',
    BITEVO_EVENT_COUNTER_REPORT_SECRET: reportSecret,
    BITEVO_EVENT_DB: db
  }, dateNow);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data, { ok: true, rows: db.reports });
  assert.deepEqual(Object.keys(data.rows[0]).sort(), ['day','event','page','locale','count'].sort());
});

test('original guide routing and asset delivery remain unchanged', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset', { status: 200 }) } };
  const guide = await worker.fetch(new Request('https://bitevo.work/guides/before-write-access'), env);
  const unknown = await worker.fetch(new Request('https://bitevo.work/guides/unlisted-private'), env);
  const redirect = await worker.fetch(new Request('https://bitevo.work/guides/ai-agent-reliability-audit'), env);
  assert.equal(guide.status, 200);
  assert.equal(unknown.status, 302);
  assert.equal(redirect.status, 301);
});

async function mockBrowser(enabled = true) {
  const src = await readFile(new URL('../public/bitevo-event-counter.js', import.meta.url), 'utf8');
  const documentHandlers = new Map();
  const globalHandlers = new Map();
  const messages = [];
  const raf = [];
  const dom = {};
  const document = {
    currentScript: { getAttribute: key => key === 'data-bitevo-events' ? (enabled ? 'enabled' : 'disabled') : null },
    documentElement: { lang: 'en' },
    getElementById: id => dom[id],
    addEventListener: (type, fn) => documentHandlers.set(type, fn)
  };
  const fake = {
    document, location: { pathname: '/pricing' },
    addEventListener: (type, fn) => globalHandlers.set(type, fn),
    fetch: async (url, options) => {
      messages.push({ url, options });
      return new Response('{}');
    },
    requestAnimationFrame: callback => raf.push(callback)
  };
  fake.globalThis = fake;
  vm.runInNewContext(src, fake, { filename: 'bitevo-event-counter.js' });
  return { documentHandlers, globalHandlers, messages, raf, dom, fake, document };
}

test('browser tracker starts disabled, never reads storage, and posts only event/page/locale', async () => {
  const off = await mockBrowser(false);
  assert.equal(off.documentHandlers.size, 0);
  assert.equal(off.globalHandlers.size, 0);
  assert.equal(off.messages.length, 0);
  const on = await mockBrowser(true);
  on.globalHandlers.get('triage_click')({});
  assert.equal(on.messages.length, 1);
  assert.equal(on.messages[0].url, '/api/event');
  assert.equal(on.messages[0].options.credentials, 'omit');
  assert.deepEqual(JSON.parse(on.messages[0].options.body),
    { event: 'triage_click', page: '/pricing', locale: 'en' });
});

test('browser captures mailto and pilot intent without interrupting navigation', async () => {
  const state = await mockBrowser(true);
  state.fake.location.pathname = '/phuket-ai-workflow';
  const mail = 'mailto:robert@bitevo.work?subject=Phuket%20AI%20Workflow%20Setup';
  state.documentHandlers.get('click')({
    target: { closest: () => ({ getAttribute: () => mail }) }
  });
  assert.deepEqual(state.messages.map(m => JSON.parse(m.options.body).event),
    ['mailto_click', 'pilot_click']);
  for (const msg of state.messages) {
    const payload = JSON.parse(msg.options.body);
    assert.deepEqual(Object.keys(payload).sort(), ['event', 'locale', 'page'].sort());
    assert.equal(payload.page, '/phuket-ai-workflow');
  }
  state.fake.location.pathname = '/pricing';
  state.documentHandlers.get('click')({
    target: { closest: () => ({ getAttribute: () => '/phuket-ai-workflow' }) }
  });
  assert.equal(JSON.parse(state.messages[2].options.body).event, 'pilot_click');
});

test('scope_generated only after successful fresh local brief; no form content transmitted', async () => {
  const browser = await mockBrowser(true);
  browser.fake.location.pathname = '/ru/audit-intake';
  browser.document.documentElement.lang = 'ru';
  browser.dom.briefText = { value: '' };
  browser.dom.state = { textContent: 'Not generated' };
  const valid = { id: 'ruIntake', checkValidity: () => true };
  browser.documentHandlers.get('submit')({ target: valid });
  assert.equal(browser.messages.length, 0);
  browser.dom.briefText.value = 'PRIVATE GENERATED LOCAL BRIEF';
  browser.dom.state.textContent = 'Ready to review';
  browser.raf.shift()();
  assert.equal(browser.messages.length, 1);
  const sent = JSON.parse(browser.messages[0].options.body);
  assert.deepEqual(sent, { event: 'scope_generated', page: '/ru/audit-intake', locale: 'ru' });
  assert.equal(browser.messages[0].options.body.includes('PRIVATE'), false);
  browser.documentHandlers.get('submit')({ target: valid });
  browser.raf.shift()();
  assert.equal(browser.messages.length, 1, 'unchanged local brief is not counted twice');
  const invalid = { id: 'ruIntake', checkValidity: () => false };
  browser.documentHandlers.get('submit')({ target: invalid });
  assert.equal(browser.raf.length, 0);
});
