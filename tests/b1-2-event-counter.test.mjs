import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test, after } from 'node:test';
import vm from 'node:vm';
import coverage from '../src/data/bitevo-event-coverage.json' with { type: 'json' };
import registry from '../src/data/public-route-registry.json' with { type: 'json' };
let directNetworkCalls = 0;
globalThis.fetch = async () => { directNetworkCalls++; throw new Error('outgoing network forbidden in offline tests'); };
after(() => assert.equal(directNetworkCalls, 0, 'offline suite attempted real network'));
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
      eventRequest({ event, page: event === 'scope_generated' ? '/audit-intake' : '/pricing', locale: 'en' }), ingressEnv,
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

async function mockBrowser(enabled = true, path = '/pricing', attributes = {}) {
  const src = await readFile(new URL('../public/bitevo-event-counter.js', import.meta.url), 'utf8');
  const documentHandlers = new Map();
  const globalHandlers = new Map();
  const messages = [];
  const raf = [];
  const dom = {};
  const row = coverage.routes.find(item => item.path === path);
  const attrs = {
    'data-bitevo-events': enabled ? 'enabled' : 'disabled',
    'data-bitevo-event-schema': coverage.schema,
    'data-bitevo-event-coverage': JSON.stringify(row || null),
    ...attributes
  };
  const document = {
    currentScript: { getAttribute: key => attrs[key] ?? null },
    documentElement: { lang: path === '/ru' || path.startsWith('/ru/') ? 'ru' : 'en' },
    getElementById: id => dom[id],
    addEventListener: (type, fn) => documentHandlers.set(type, fn)
  };
  const fake = {
    document, URL, location: { pathname: path },
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
  const state = await mockBrowser(true, '/phuket-ai-workflow');
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
  const pricing = await mockBrowser(true, '/pricing');
  pricing.documentHandlers.get('click')({
    target: { closest: () => ({ getAttribute: () => '/phuket-ai-workflow' }) }
  });
  assert.equal(pricing.messages.length, 1);
  assert.equal(JSON.parse(pricing.messages[0].options.body).event, 'pilot_click');
});

test('scope_generated only after successful fresh local brief; no form content transmitted', async () => {
  const browser = await mockBrowser(true, '/ru/audit-intake');
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


const REVIEWED_ROWS = [{"path":"/","locale":"en","events":["triage_click"]},{"path":"/start","locale":"en","events":["pilot_click"]},{"path":"/pricing","locale":"en","events":["triage_click","mailto_click","pilot_click"]},{"path":"/agent-authority-audit","locale":"en","events":["mailto_click"]},{"path":"/entry-audit","locale":"en","events":["triage_click","mailto_click"]},{"path":"/control-validation","locale":"en","events":["mailto_click"]},{"path":"/build/exception-workflow-diagnostic","locale":"en","events":["mailto_click"]},{"path":"/build/hr-workflow-diagnostic","locale":"en","events":["mailto_click"]},{"path":"/build/workflow-value-example","locale":"en","events":["mailto_click"]},{"path":"/phuket-ai-workflow","locale":"en","events":["mailto_click","pilot_click"]},{"path":"/mapper","locale":"en","events":["mailto_click"]},{"path":"/diagnostic","locale":"en","events":["mailto_click"]},{"path":"/audit-intake","locale":"en","events":["mailto_click","scope_generated"]},{"path":"/agent-incidents","locale":"en","events":["mailto_click"]},{"path":"/ru","locale":"ru","events":["triage_click"]},{"path":"/ru/pricing","locale":"ru","events":["mailto_click"]},{"path":"/ru/agent-authority-audit","locale":"ru","events":["mailto_click"]},{"path":"/ru/mapper","locale":"ru","events":["mailto_click"]},{"path":"/ru/diagnostic","locale":"ru","events":["mailto_click"]},{"path":"/ru/audit-intake","locale":"ru","events":["mailto_click","scope_generated"]},{"path":"/ru/universe","locale":"ru","events":["pilot_click"]},{"path":"/ru/entry-audit","locale":"ru","events":["mailto_click"]},{"path":"/ru/control-validation","locale":"ru","events":["mailto_click"]},{"path":"/ru/build/exception-workflow-diagnostic","locale":"ru","events":["mailto_click"]}];

test('R44 exact 24-page coverage, 30 page-event pairs, OFF and registry parity', () => {
  assert.equal(coverage.schema, 'bitevo.event-coverage/v1');
  assert.equal(coverage.defaultMode, 'disabled');
  assert.deepEqual(coverage.routes, REVIEWED_ROWS);
  assert.equal(coverage.routes.length, 24);
  assert.equal(new Set(coverage.routes.map(row => row.path)).size, 24);
  assert.equal(coverage.routes.reduce((n, row) => n + row.events.length, 0), 30);
  for (const row of coverage.routes) {
    const known = registry.routes.find(item => item.path === row.path);
    assert.ok(known?.indexable); assert.equal(known.locale, row.locale);
    assert.equal(new Set(row.events).size, row.events.length);
  }
});

test('R44 OFF on all 24 pages registers no listeners and emits no requests', async () => {
  for (const row of REVIEWED_ROWS) {
    const off = await mockBrowser(false, row.path);
    assert.equal(off.messages.length, 0, row.path);
    assert.equal(off.globalHandlers.size, 0, row.path);
    assert.equal(off.documentHandlers.size, 0, row.path);
  }
});

test('R44 ingress accepts only the exact approved page-event-locale matrix', async () => {
  for (const row of REVIEWED_ROWS) {
    for (const event of ['triage_click','mailto_click','scope_generated','pilot_click']) {
      let called = 0;
      const response = await handleBitEvoPublicEvent(eventRequest({ event, page: row.path, locale: row.locale }), ingressEnv, {
        ...hooks, send: async () => { called++; return Response.json({ ok: true, counted: true }); }
      });
      assert.equal(response.status, row.events.includes(event) ? 200 : 400, row.path + ':' + event);
      assert.equal(called, row.events.includes(event) ? 1 : 0);
    }
    const wrong = await handleBitEvoPublicEvent(eventRequest({ event: row.events[0], page: row.path, locale: row.locale === 'en' ? 'ru' : 'en' }), ingressEnv, hooks);
    assert.equal(wrong.status, 400);
  }
  for (const page of ['/security','/ru/start','/ru/phuket-ai-workflow','/not-registered']) {
    const response = await handleBitEvoPublicEvent(eventRequest({ event: 'mailto_click', page, locale: page.startsWith('/ru') ? 'ru' : 'en' }), ingressEnv, hooks);
    assert.equal(response.status, 400, page);
  }
});

test('R44 malformed, missing or mismatched client policy fails closed', async () => {
  const valid = REVIEWED_ROWS.find(row => row.path === '/pricing');
  for (const attrs of [
    { 'data-bitevo-event-schema': null },
    { 'data-bitevo-event-schema': 'unexpected' },
    { 'data-bitevo-event-coverage': null },
    { 'data-bitevo-event-coverage': '{broken' },
    ...[[], null, { ...valid, path: '/start' }, { ...valid, locale: 'ru' },
      { ...valid, enabled: true }, { ...valid, events: [] },
      { ...valid, events: ['unknown'] }, { ...valid, events: ['mailto_click','mailto_click'] }
    ].map(row => ({ 'data-bitevo-event-coverage': JSON.stringify(row) }))
  ]) {
    const state = await mockBrowser(true, '/pricing', attrs);
    assert.equal(state.messages.length, 0);
    assert.equal(state.documentHandlers.size, 0);
    assert.equal(state.globalHandlers.size, 0);
  }
  const unknown = await mockBrowser(true, '/security');
  assert.equal(unknown.documentHandlers.size, 0);
});

function click(state, href) {
  state.documentHandlers.get('click')({ target: { closest: () => ({ getAttribute: () => href }) } });
}

test('R44 per-page client triage and business-mailto coverage; no private recipient data', async () => {
  for (const row of REVIEWED_ROWS) {
    const state = await mockBrowser(true, row.path);
    state.globalHandlers.get('triage_click')({});
    click(state, 'mailto:robert@bitevo.work?subject=PRIVATE_SUBJECT&body=PRIVATE_BODY');
    click(state, 'mailto:someone@example.com?body=PRIVATE_BODY');
    click(state, 'mailto:robert@bitevo.work.attacker.example');
    const expected = ['triage_click','mailto_click'].filter(event => row.events.includes(event));
    assert.deepEqual(state.messages.map(m => JSON.parse(m.options.body).event), expected, row.path);
    for (const message of state.messages) {
      assert.equal(message.options.credentials, 'omit');
      assert.deepEqual(Object.keys(JSON.parse(message.options.body)).sort(), ['event','locale','page']);
      assert.equal(message.options.body.includes('PRIVATE'), false);
    }
  }
});

test('R44 pilot URL normalization supports RU and excludes offsite and language switches', async () => {
  for (const page of ['/start','/pricing','/ru/universe']) {
    for (const href of ['/phuket-ai-workflow','/phuket-ai-workflow/','/ru/phuket-ai-workflow','https://bitevo.work/ru/phuket-ai-workflow/']) {
      const state = await mockBrowser(true, page); click(state, href);
      assert.deepEqual(state.messages.map(m => JSON.parse(m.options.body).event), ['pilot_click'], page + ' ' + href);
    }
    for (const href of ['https://attacker.example/phuket-ai-workflow','/phuket-ai-workflow?x=private','/phuket-ai-workflow#locale','https://user@bitevo.work/phuket-ai-workflow']) {
      const state = await mockBrowser(true, page); click(state, href);
      assert.equal(state.messages.length, 0, href);
    }
  }
  const pilot = await mockBrowser(true, '/phuket-ai-workflow');
  click(pilot, '/ru/phuket-ai-workflow'); click(pilot, '/phuket-ai-workflow/');
  assert.equal(pilot.messages.length, 0, 'language/self links are not commercial pilot intent');
  for (const page of ['/audit-intake','/ru/pricing']) {
    const state = await mockBrowser(true, page); click(state, '/phuket-ai-workflow');
    assert.equal(state.messages.length, 0, 'page without pilot permission');
  }
});

test('R44 scope-generated exact EN/RU form binding and fresh output only', async () => {
  for (const [path, id, briefId, statusId] of [
    ['/audit-intake','audit-intake','brief','briefState'],
    ['/ru/audit-intake','ruIntake','briefText','state']
  ]) {
    const state = await mockBrowser(true, path);
    state.dom[briefId] = { value: '' }; state.dom[statusId] = { textContent: 'Not generated' };
    const handler = state.documentHandlers.get('submit');
    handler({ target: { id, checkValidity: () => false } });
    handler({ target: { id } });
    handler({ target: { id: 'wrongForm', checkValidity: () => true } });
    assert.equal(state.raf.length, 0);
    handler({ target: { id, checkValidity: () => true } });
    state.dom[briefId].value = 'PRIVATE_BRIEF'; state.dom[statusId].textContent = 'Ready to review';
    state.raf.shift()(); assert.equal(state.messages.length, 1);
    assert.equal(JSON.parse(state.messages[0].options.body).event, 'scope_generated');
    assert.equal(state.messages[0].options.body.includes('PRIVATE'), false);
    handler({ target: { id, checkValidity: () => true } }); state.raf.shift()();
    assert.equal(state.messages.length, 1, 'unchanged output not counted twice');
  }
});

test('R44 policy cannot be reused after path or locale changes', async () => {
  const state = await mockBrowser(true, '/pricing');
  state.fake.location.pathname = '/start'; state.globalHandlers.get('triage_click')({});
  state.fake.location.pathname = '/pricing'; state.document.documentElement.lang = 'ru';
  state.globalHandlers.get('triage_click')({}); assert.equal(state.messages.length, 0);
});


// R45 synthetic receipt cases: no real Worker, provider binding or D1 writes.
function r45SignedEvent(nowMs = dateNow) {
  const timestamp = String(Math.floor(nowMs / 1_000));
  const body = JSON.stringify({
    schema: 'bitevo.public-event.v1', requestId,
    occurredAt: new Date(nowMs).toISOString(), ...sendData,
    ipToken: 'a'.repeat(64)
  });
  const signature = createHmac('sha256', secret)
    .update('bitevo-public-event-v1.' + timestamp + '.' + requestId + '.' + body).digest('hex');
  return new Request('https://bitevo-event-receiver.workers.dev/b1-2/event', {
    method: 'POST', body,
    headers: {
      'Content-Type': 'application/json',
      'X-BitEvo-Event-Timestamp': timestamp,
      'X-BitEvo-Event-Request-Id': requestId,
      'X-BitEvo-Event-Signature': 'v1=' + signature
    }
  });
}
function r45ReceiptDb(receipt, failAt = '') {
  const state = { sql: [], bound: [], runCalls: 0 };
  state.prepare = sql => {
    state.sql.push(sql);
    if (failAt === 'prepare') throw new Error('synthetic prepare failure');
    return {
      bind(...values) {
        state.bound.push(values);
        if (failAt === 'bind') throw new Error('synthetic bind failure');
        return { async run() {
          state.runCalls++;
          if (failAt === 'run') throw new Error('synthetic run failure');
          return receipt;
        } };
      }
    };
  };
  return state;
}
function r45AssertSingleAttempt(db) {
  assert.equal(db.sql.length, 1);
  assert.equal(db.sql[0], 'INSERT INTO bitevo_public_event_daily (day, event_name, page, locale, count) '
    + 'VALUES (?, ?, ?, ?, 1) ON CONFLICT(day, event_name, page, locale) DO UPDATE SET count = count + 1');
  assert.deepEqual(db.bound, [[new Date(dateNow).toISOString().slice(0, 10), 'triage_click', '/pricing', 'en']]);
  assert.equal(db.runCalls, 1, 'unconfirmed receipt must not trigger an implicit retry');
}
const r45InvalidReceipts = [
  ['undefined', undefined], ['null', null], ['false', false], ['true', true],
  ['number', 1], ['string', 'ok'], ['array', []], ['empty object', {}],
  ['missing success', { meta: { changes: 1 } }],
  ['false success', { success: false, meta: { changes: 1 } }],
  ['numeric success', { success: 1, meta: { changes: 1 } }],
  ['string success', { success: 'true', meta: { changes: 1 } }],
  ['missing meta', { success: true }], ['null meta', { success: true, meta: null }],
  ['missing changes', { success: true, meta: {} }],
  ['zero changes', { success: true, meta: { changes: 0 } }],
  ['two changes', { success: true, meta: { changes: 2 } }],
  ['negative changes', { success: true, meta: { changes: -1 } }],
  ['fractional changes', { success: true, meta: { changes: 1.5 } }],
  ['string changes', { success: true, meta: { changes: '1' } }],
  ['boolean changes', { success: true, meta: { changes: true } }],
  ['NaN changes', { success: true, meta: { changes: NaN } }],
  ['infinite changes', { success: true, meta: { changes: Infinity } }],
  ['bigint changes', { success: true, meta: { changes: 1n } }]
];
for (const [label, receipt] of r45InvalidReceipts) {
  test('R45 receipt rejects ' + label + ' without counted acknowledgement or retry', async () => {
    const db = r45ReceiptDb(receipt);
    const env = workerEnv(db);
    const response = await handleBitEvoWorkerEvent(r45SignedEvent(), env, dateNow);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, error: 'COUNTER_WRITE_UNCONFIRMED' });
    r45AssertSingleAttempt(db);
    assert.equal(env.BITEVO_EVENT_RATE_LIMITER.calls.length, 1);
  });
}
for (const phase of ['prepare', 'bind', 'run']) {
  test('R45 D1 ' + phase + ' exception remains unconfirmed and is never retried', async () => {
    const db = r45ReceiptDb({ success: true, meta: { changes: 1 } }, phase);
    const response = await handleBitEvoWorkerEvent(r45SignedEvent(), workerEnv(db), dateNow);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, error: 'COUNTER_WRITE_UNCONFIRMED' });
    assert.equal(db.sql.length, 1);
    assert.equal(db.bound.length, phase === 'prepare' ? 0 : 1);
    assert.equal(db.runCalls, phase === 'run' ? 1 : 0);
  });
}
test('R45 explicit single-change receipt is acknowledged, with optional provider metadata', async () => {
  for (const receipt of [
    { success: true, meta: { changes: 1 } },
    { success: true, meta: { changes: 1, duration: 0.5, rows_written: 2 }, results: [] }
  ]) {
    const db = r45ReceiptDb(receipt);
    const response = await handleBitEvoWorkerEvent(r45SignedEvent(), workerEnv(db), dateNow);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, counted: true });
    r45AssertSingleAttempt(db);
  }
});
test('R45 receipt metadata exception fails closed', async () => {
  const receipt = { success: true, get meta() { throw new Error('synthetic metadata failure'); } };
  const db = r45ReceiptDb(receipt);
  const response = await handleBitEvoWorkerEvent(r45SignedEvent(), workerEnv(db), dateNow);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: 'COUNTER_WRITE_UNCONFIRMED' });
  r45AssertSingleAttempt(db);
});
test('R45 unconfirmed Worker receipt propagates through signed ingress without false success', async () => {
  for (const receipt of [undefined, {}, { success: true, meta: { changes: 0 } }]) {
    const db = r45ReceiptDb(receipt);
    let forwards = 0;
    const response = await handleBitEvoPublicEvent(eventRequest(), ingressEnv, {
      ...hooks, send: async (url, options) => {
        forwards++;
        return handleBitEvoWorkerEvent(new Request(url, options), workerEnv(db), dateNow);
      }
    });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { ok: false, error: 'COUNTER_UNAVAILABLE' });
    assert.equal(forwards, 1);
    r45AssertSingleAttempt(db);
  }
});
test('R45 disabled receiver and invalid signature never attempt a receipt write', async () => {
  const db = r45ReceiptDb({ success: true, meta: { changes: 1 } });
  const env = workerEnv(db);
  const off = await handleBitEvoWorkerEvent(r45SignedEvent(), {
    ...env, BITEVO_EVENT_COUNTER_RECEIVER_ENABLED: 'false'
  }, dateNow);
  assert.equal(off.status, 404);
  const bad = r45SignedEvent();
  bad.headers.set('x-bitevo-event-signature', 'v1=' + '0'.repeat(64));
  const rejected = await handleBitEvoWorkerEvent(bad, env, dateNow);
  assert.equal(rejected.status, 401);
  assert.equal(db.sql.length, 0);
  assert.equal(db.runCalls, 0);
  assert.equal(env.BITEVO_EVENT_RATE_LIMITER.calls.length, 0);
});

// R46: Worker-first routing must be two explicit paths, never a B1.2 wildcard.
const r46Wrangler = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const r46ExpectedRunFirst = [
  '/b1-2/event',
  '/b1-2/event-report',
  '/guides/*',
  '/ru/guides/ai-agent-reliability-audit',
  '!/guides/security-sandboxing',
  '!/guides/fleet-coordinator-drift-monitoring',
  '!/guides/d3-tool-io-bridge-contract'
];
const r46RoutingMatches = routes => Array.isArray(routes)
  && JSON.stringify(routes) === JSON.stringify(r46ExpectedRunFirst);
test('R46 exact Worker-first API and guide routes, with no wildcard or global override', () => {
  assert.equal(r46Wrangler.assets.not_found_handling, '404-page');
  assert.equal(r46Wrangler.assets.html_handling, 'drop-trailing-slash');
  assert.equal(r46RoutingMatches(r46Wrangler.assets.run_worker_first), true);
  assert.equal(r46Wrangler.assets.run_worker_first.includes('/b1-2/*'), false);
  assert.equal(r46Wrangler.assets.run_worker_first.includes('/*'), false);
});
test('R46 configuration gate rejects missing, extra, wildcard and weakened guide exceptions', () => {
  for (const routes of [
    true,
    [...r46ExpectedRunFirst.slice(1)],
    r46ExpectedRunFirst.filter(route => route !== '/b1-2/event-report'),
    [...r46ExpectedRunFirst, '/b1-2/*'],
    [...r46ExpectedRunFirst, '/b1-2/other'],
    r46ExpectedRunFirst.map(route => route === '/b1-2/event' ? '/b1-2/*' : route),
    r46ExpectedRunFirst.filter(route => route !== '!/guides/security-sandboxing'),
    [...r46ExpectedRunFirst].reverse()
  ]) assert.equal(r46RoutingMatches(routes), false);
});
test('R46 disabled Worker event route returns 404 JSON without D1, rate limit or asset fallback', async () => {
  const calls = { assets: 0, db: 0, limiter: 0 };
  const env = {
    ASSETS: { fetch: async () => { calls.assets++; throw Error('unexpected asset fallback'); } },
    BITEVO_EVENT_DB: { prepare: () => { calls.db++; throw Error('unexpected DB'); } },
    BITEVO_EVENT_RATE_LIMITER: { limit: async () => { calls.limiter++; throw Error('unexpected limiter'); } }
  };
  const response = await worker.fetch(new Request('https://bitevo.work/b1-2/event'), env);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { ok: false, error: 'NOT_FOUND' });
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(calls, { assets: 0, db: 0, limiter: 0 });
});
test('R46 disabled Worker report route returns 404 JSON without D1 or asset fallback', async () => {
  let assets = 0, db = 0;
  const env = {
    ASSETS: { fetch: async () => { assets++; throw Error('unexpected asset fallback'); } },
    BITEVO_EVENT_DB: { prepare: () => { db++; throw Error('unexpected DB'); } }
  };
  const response = await worker.fetch(new Request('https://bitevo.work/b1-2/event-report'), env);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { ok: false, error: 'NOT_FOUND' });
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(assets, 0);
  assert.equal(db, 0);
});
test('R46 unrelated paths retain the unchanged static asset fallback', async () => {
  const paths = ['/pricing', '/b1-2/other', '/b1-2/event-extra', '/api/event'];
  const calls = [];
  const env = { ASSETS: { fetch: async request => {
    calls.push(new URL(request.url).pathname);
    return new Response('STATIC_ONLY', { status: 202 });
  } } };
  for (const path of paths) {
    const response = await worker.fetch(new Request('https://bitevo.work' + path), env);
    assert.equal(response.status, 202);
    assert.equal(await response.text(), 'STATIC_ONLY');
  }
  assert.deepEqual(calls, paths);
});
test('R46 legacy guide redirects remain distinct from new API routing', async () => {
  const cases = [
    ['/guides/ai-agent-reliability-audit', 301, '/agent-authority-audit'],
    ['/ru/guides/ai-agent-reliability-audit', 301, '/ru/agent-authority-audit'],
    ['/guides/unreviewed', 302, '/guides']
  ];
  for (const [path, status, target] of cases) {
    const response = await worker.fetch(new Request('https://bitevo.work' + path), {});
    assert.equal(response.status, status);
    assert.equal(new URL(response.headers.get('location')).pathname, target);
  }
});


// R49 Draft: prove future mode admission without activating the live browser client.
test('R49 synthetic enabled-mode coverage admits reviewed pairs without production IO', async () => {
  const originalMode = coverage.defaultMode;
  let forwarded = 0;
  try {
    coverage.defaultMode = 'enabled';
    const { handleBitEvoPublicEvent: futureIngress } =
      await import('../api/event.ts?r49-future-enabled-mode-v1');
    const safeHooks = {
      ...hooks,
      send: async () => {
        forwarded++;
        return Response.json({ ok: true, counted: true });
      }
    };
    const valid = await futureIngress(eventRequest({
      event: 'triage_click', page: '/pricing', locale: 'en'
    }), ingressEnv, safeHooks);
    assert.equal(valid.status, 200, 'future mode must retain the existing reviewed event');
    assert.deepEqual(await valid.json(), { ok: true, counted: true });

    for (const invalid of [
      { event: 'pilot_click', page: '/agent-authority-audit', locale: 'en' },
      { event: 'triage_click', page: '/ru/pricing', locale: 'ru' },
      { event: 'mailto_click', page: '/private', locale: 'en' },
      { event: 'triage_click', page: '/pricing', locale: 'ru' }
    ]) {
      const rejected = await futureIngress(eventRequest(invalid), ingressEnv, safeHooks);
      assert.equal(rejected.status, 400, JSON.stringify(invalid));
      assert.deepEqual(await rejected.json(), { ok: false, error: 'INVALID_EVENT' });
    }
    assert.equal(forwarded, 1, 'only reviewed event may reach the synthetic receiver');
  } finally {
    coverage.defaultMode = originalMode;
  }
  assert.equal(coverage.defaultMode, 'disabled', 'shipped mode remains OFF');
});

test('R49 unreviewed default mode rejects even reviewed event pairs', async () => {
  const originalMode = coverage.defaultMode;
  let forwarded = 0;
  try {
    coverage.defaultMode = 'unreviewed-mode';
    const { handleBitEvoPublicEvent: invalidModeIngress } =
      await import('../api/event.ts?r49-invalid-mode-v1');
    const denied = await invalidModeIngress(eventRequest(), ingressEnv, {
      ...hooks,
      send: async () => {
        forwarded++;
        return Response.json({ ok: true, counted: true });
      }
    });
    assert.equal(denied.status, 400);
    assert.deepEqual(await denied.json(), { ok: false, error: 'INVALID_EVENT' });
    assert.equal(forwarded, 0, 'invalid mode must not forward events');
  } finally {
    coverage.defaultMode = originalMode;
  }
  assert.equal(coverage.defaultMode, 'disabled');
});
