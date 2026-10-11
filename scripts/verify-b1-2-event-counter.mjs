import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const gitBase = path => execFileSync('git', ['show', 'HEAD:' + path], {
  cwd: new URL('../', import.meta.url), encoding: 'utf8', windowsHide: true
});
let checks = 0;
function expect(condition, message) {
  assert.ok(condition, message);
  checks++;
}

const [tracker, ingress, worker, sql, legacyTriage, layout, enIntake, ruIntake, wrangler, vercel] = await Promise.all([
  read('public/bitevo-event-counter.js'),
  read('api/event.ts'),
  read('worker/index.mjs'),
  read('schema/bitevo_public_event_daily.sql'),
  read('public/triage-click.js'),
  read('src/layouts/Layout.astro'),
  read('src/pages/audit-intake.astro'),
  read('src/pages/ru/audit-intake.astro'),
  read('wrangler.jsonc'),
  read('vercel.json')
]);

for (const event of ['triage_click','mailto_click','scope_generated','pilot_click']) {
  for (const [part, source] of [['client',tracker],['ingress',ingress],['worker',worker],['D1 schema',sql]]) {
    expect(source.includes(event), part + ' missing ' + event);
  }
}
for (const text of ['globalThis.dataLayer', 'new CustomEvent(EVENT', "const EVENT = 'triage_click'"]) {
  expect(legacyTriage.includes(text), 'original P29.1 tracker was modified');
}
expect(tracker.includes("getAttribute('data-bitevo-events') !== 'enabled'"), 'client must default to off');
expect(tracker.includes("credentials: 'omit'"), 'client must send no cookies');
expect(tracker.includes('keepalive: true'), 'navigation event must remain best effort');
expect(tracker.includes('body = JSON.stringify({ event, page, locale: locale() })'), 'client fields exactly event/page/locale');
expect(!/document\.cookie|localStorage|sessionStorage|sendBeacon|gtag|posthog|mixpanel/i.test(tracker), 'no user identifier collection');
expect(!tracker.includes('preventDefault'), 'no click navigation interference');

expect(ingress.includes("BITEVO_EVENT_COUNTER_ENABLED === 'true'"), 'ingress disabled by default');
expect(ingress.includes("BITEVO_EVENT_COUNTER_PROVIDER_READY !== 'true'"), 'provider readiness missing');
expect(ingress.includes("BITEVO_EVENT_COUNTER_ALLOWED_PROJECT_ID"), 'project pin missing');
expect(ingress.includes('CANONICAL_ORIGIN'), 'origin pin missing');
expect(ingress.includes("routeRegistry from '../src/data/public-route-registry.json'"), 'public path allowlist missing');
expect(ingress.includes("BITEVO_EVENT_COUNTER_SIGNING_SECRET"), 'ingress signing secret missing');
expect(ingress.includes("SIGNING_DOMAIN = 'bitevo-public-event-v1'"), 'HMAC domain mismatch');
expect(ingress.includes("BITEVO_EVENT_COUNTER_WORKER_URL"), 'worker endpoint config missing');

expect(worker.includes("BITEVO_EVENT_COUNTER_RECEIVER_ENABLED === 'true'"), 'receiver disabled by default');
expect(worker.includes("BITEVO_EVENT_COUNTER_REPORT_ENABLED === 'true'"), 'private report disabled by default');
expect(worker.includes('crypto.subtle.verify'), 'cryptographic HMAC verify missing');
expect(worker.includes('BITEVO_EVENT_RATE_LIMITER.limit'), 'distributed rate limit missing');
expect(worker.includes('BITEVO_EVENT_DB.prepare(UPSERT)'), 'D1 increment missing');
expect(worker.includes("if (path.startsWith('/guides/') && !canonicalGuides.has(path))"), 'guide routing changed');
expect(worker.includes("return env.ASSETS.fetch(request)"), 'static asset fallback changed');

const columnRows = sql.split(/\r?\n/).filter(line => /^  (day|event_name|page|locale|count) (TEXT|INTEGER) /.test(line));
const columns = columnRows.map(line => line.trim().split(' ')[0]);
expect(columns.join(',') === 'day,event_name,page,locale,count', 'D1 table must contain only five aggregate columns');
expect(sql.includes('PRIMARY KEY (day, event_name, page, locale)'), 'D1 aggregate primary key missing');
expect(!/^\s*(name|contact|email|ip_token|request_id|cookie|form_text)\s+(TEXT|INTEGER)/mi.test(sql), 'personal column forbidden');

const normalizeEol = value => value.replace(/\r\n/g, '\n');
for (const [path, current] of [
  ['public/triage-click.js', legacyTriage],
  ['src/pages/audit-intake.astro', enIntake],
  ['src/pages/ru/audit-intake.astro', ruIntake],
  ['wrangler.jsonc', wrangler],
  ['vercel.json', vercel]
]) {
  expect(normalizeEol(current) === normalizeEol(gitBase(path)),
    path + ' must remain unchanged in this local-only candidate');
}

const insertionAnchor = '    <script defer src="/_vercel/insights/script.js"></script>';
const disabledMount = '    {["/audit-intake", "/ru/audit-intake", "/phuket-ai-workflow"].includes(selfCanonicalPath) && <script is:inline src="/bitevo-event-counter.js" data-bitevo-events="disabled"></script>}';
const baselineLayout = normalizeEol(gitBase('src/layouts/Layout.astro'));
expect(baselineLayout.includes(insertionAnchor), 'source Layout mount anchor remains present');
expect(normalizeEol(layout) === baselineLayout.replace(insertionAnchor, insertionAnchor + '\n' + disabledMount),
  'Layout differs from reviewed base only by route-bound disabled counter script');
expect(!layout.includes('data-bitevo-events="enabled"'), 'Layout must never enable telemetry');

for (const [route, mounted] of [
  ['/audit-intake', true], ['/ru/audit-intake', true], ['/phuket-ai-workflow', true],
  ['/', false], ['/ru', false], ['/pricing', false], ['/ru/pricing', false],
  ['/entry-audit', false], ['/security', false]
]) {
  const html = await read(route === '/' ? 'dist/index.html' : 'dist' + route + '/index.html');
  const tags = [...html.matchAll(/<script\b[^>]*\bsrc="\/bitevo-event-counter\.js"[^>]*><\/script>/gi)];
  expect(tags.length === (mounted ? 1 : 0), route + ': exact reviewed counter mount count');
  if (mounted) expect(tags[0][0].includes('data-bitevo-events="disabled"'),
    route + ': script must be disabled in HTML');
}
expect(!wrangler.includes('BITEVO_EVENT_DB'), 'no provider D1 binding without approval');
expect(!vercel.includes('BITEVO_EVENT_COUNTER_ENABLED'), 'no Vercel provider activation without approval');

console.log('B1_2_LOCAL_STATIC_GATE_PASS checks=' + checks
  + ' events=4 D1_columns=5 personal_columns=0'
  + ' client_wired=PASSIVE_THREE_ROUTES events_enabled=NO provider_activation=NO production_writes=0');
