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
