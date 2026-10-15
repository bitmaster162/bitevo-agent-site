import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import coverage from '../src/data/bitevo-event-coverage.json' with { type: 'json' };
import registry from '../src/data/public-route-registry.json' with { type: 'json' };

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
  ['vercel.json', vercel]
]) {
  expect(normalizeEol(current) === normalizeEol(gitBase(path)),
    path + ' must remain unchanged in this local-only candidate');
}

// R46: permit only the two exact Worker-first paths against the pinned R45
// Wrangler preimage. Supports both pre-commit and post-commit HEAD baselines.
const r46LegacyRunFirst = "    \"run_worker_first\": [\n      \"/guides/*\",";
const r46ExactRunFirst = "    \"run_worker_first\": [\n      \"/b1-2/event\",\n      \"/b1-2/event-report\",\n      \"/guides/*\",";
const r46WranglerBaselineSha256 = 'c007f33f3d8e1826cab703998fb5117c0a571ad3f4a86e96364b53dc3054d677';
function sourceBoundR46WorkerFirst(candidate, sourceBaseline) {
  let original = normalizeEol(sourceBaseline);
  const count = (source, value) => source.split(value).length - 1;
  if (count(original, r46ExactRunFirst) === 1 && count(original, r46LegacyRunFirst) === 0) {
    original = original.replace(r46ExactRunFirst, r46LegacyRunFirst);
  }
  if (count(original, r46LegacyRunFirst) !== 1 || count(original, r46ExactRunFirst) !== 0
    || createHash('sha256').update(original, 'utf8').digest('hex') !== r46WranglerBaselineSha256) return false;
  return normalizeEol(candidate) === original.replace(r46LegacyRunFirst, r46ExactRunFirst);
}
// R48: preserve R45/R46 source pin while allowing only the exact reviewed bindings.
const r48D1 = [{ binding: 'BITEVO_EVENT_DB', database_name: 'bitevo-events-b12',
  database_id: 'b533a76e-ddd0-406b-9449-94e878bc2c50' }];
const r48Limits = [{ name: 'BITEVO_EVENT_RATE_LIMITER', namespace_id: '1001',
  simple: { limit: 10, period: 60 } }];
const r48Vars = { BITEVO_EVENT_COUNTER_RECEIVER_ENABLED: 'true' };
const r48TopKeys = '$schema,name,compatibility_date,main,workers_dev,assets,d1_databases,ratelimits,vars';
const r48Canonical = value => JSON.stringify(value, null, 2) + '\n';
function sourceBoundR48Config(candidate, baseline) {
  let conf, prior;
  try {
    conf = JSON.parse(normalizeEol(candidate));
    prior = JSON.parse(normalizeEol(baseline));
  } catch { return false; }
  if (normalizeEol(candidate) !== r48Canonical(conf)) return false;
  if (Object.keys(conf).join(',') !== r48TopKeys) return false;
  if (JSON.stringify(conf.d1_databases) !== JSON.stringify(r48D1)
    || JSON.stringify(conf.ratelimits) !== JSON.stringify(r48Limits)
    || JSON.stringify(conf.vars) !== JSON.stringify(r48Vars)) return false;
  const withoutR48 = value => {
    const stripped = { ...value };
    delete stripped.d1_databases;
    delete stripped.ratelimits;
    delete stripped.vars;
    return r48Canonical(stripped);
  };
  return sourceBoundR46WorkerFirst(withoutR48(conf), withoutR48(prior));
}

const r46WranglerBase = gitBase('wrangler.jsonc');
expect(sourceBoundR48Config(wrangler, r46WranglerBase), 'R46 Wrangler exact two-route change only');
expect(sourceBoundR48Config(wrangler, wrangler), 'R46 post-commit pinned Wrangler baseline accepted');
const r46WranglerLF = normalizeEol(wrangler);
for (const [label, altered] of [
  ['missing event route', r46WranglerLF.replace('      "/b1-2/event",\n', '')],
  ['missing report route', r46WranglerLF.replace('      "/b1-2/event-report",\n', '')],
  ['wildcard route', r46WranglerLF.replace('"/b1-2/event",', '"/b1-2/*",')],
  ['extra route', r46WranglerLF.replace('"/b1-2/event-report",', '"/b1-2/event-report",\n      "/b1-2/other",')],
  ['guide deny removed', r46WranglerLF.replace('"!/guides/security-sandboxing"', '"/guides/security-sandboxing"')],
  ['404 handling changed', r46WranglerLF.replace('"not_found_handling": "404-page"', '"not_found_handling": "none"')],
  ['unrelated source change', r46WranglerLF + '\n// unexpected']
]) {
  expect(altered !== r46WranglerLF, 'R46 negative mutation anchor exists: ' + label);
  expect(!sourceBoundR48Config(altered, r46WranglerBase), 'R46 rejects unrelated Wrangler change: ' + label);
  expect(!sourceBoundR48Config(altered, altered), 'R46 rejects changed post-commit baseline: ' + label);
}
const r48Reviewed = JSON.parse(r46WranglerLF);
for (const [label, mutate] of [
  ['missing D1', x => { delete x.d1_databases; }],
  ['wrong D1 binding', x => { x.d1_databases[0].binding = 'OTHER_DB'; }],
  ['wrong D1 name', x => { x.d1_databases[0].database_name = 'other-db'; }],
  ['wrong D1 ID', x => { x.d1_databases[0].database_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; }],
  ['second D1', x => { x.d1_databases.push({ ...x.d1_databases[0] }); }],
  ['missing limiter', x => { delete x.ratelimits; }],
  ['wrong limiter name', x => { x.ratelimits[0].name = 'WRONG'; }],
  ['namespace collision', x => { x.ratelimits[0].namespace_id = '1535251417'; }],
  ['wrong limit', x => { x.ratelimits[0].simple.limit = 11; }],
  ['wrong period', x => { x.ratelimits[0].simple.period = 10; }],
  ['second limiter', x => { x.ratelimits.push({ ...x.ratelimits[0] }); }],
  ['missing vars', x => { delete x.vars; }],
  ['receiver OFF', x => { x.vars.BITEVO_EVENT_COUNTER_RECEIVER_ENABLED = 'false'; }],
  ['report ON', x => { x.vars.BITEVO_EVENT_COUNTER_REPORT_ENABLED = 'true'; }],
  ['secret inserted', x => { x.vars.BITEVO_EVENT_COUNTER_SIGNING_SECRET = 'not-allowed'; }],
  ['unexpected key', x => { x.extra_feature = true; }]
]) {
  const altered = structuredClone(r48Reviewed);
  mutate(altered);
  const changed = r48Canonical(altered);
  expect(changed !== r46WranglerLF, 'R48 mutation anchor: ' + label);
  expect(!sourceBoundR48Config(changed, r46WranglerBase), 'R48 rejects: ' + label);
  expect(!sourceBoundR48Config(changed, changed), 'R48 post-commit rejects: ' + label);
}
const r48Duplicate = r46WranglerLF.replace('  "vars": {', '  "vars": {},\\n  "vars": {');
expect(r48Duplicate !== r46WranglerLF && !sourceBoundR48Config(r48Duplicate, r46WranglerBase),
  'R48 duplicate-key source must fail closed');

const insertionAnchor = '    <script defer src="/_vercel/insights/script.js"></script>';
const registryImport = "import routeRegistry from '../data/public-route-registry.json';";
const coverageImport = "import eventCoverage from '../data/bitevo-event-coverage.json';";
const pathAnchor = "const selfCanonicalPath = path === '/' ? '/' : path.replace(/\\/+$/, '');";
const coverageLookup = 'const counterCoverage = eventCoverage.routes.find(route => route.path === selfCanonicalPath && route.locale === lang);';
const originalMount = '    {["/audit-intake", "/ru/audit-intake", "/phuket-ai-workflow"].includes(selfCanonicalPath) && <script is:inline src="/bitevo-event-counter.js" data-bitevo-events="disabled"></script>}';
const disabledMount = '    {counterCoverage && <script is:inline src="/bitevo-event-counter.js" data-bitevo-events="disabled" data-bitevo-event-schema={eventCoverage.schema} data-bitevo-event-coverage={JSON.stringify(counterCoverage)}></script>}';
// R47A: allow only the exact two new privacy footer links.
const r47aLayoutSha = '31f57341c144f9df53e6c14b45eabda678278fe13b3bf1526e5d9f671cf3668b';
const r47aEnBase = "  ['Security', '/security'],\n";
const r47aEnNew = r47aEnBase + "  ['Site data & events', '/privacy'],\n";
const r47aRuBase = "  ['Безопасность', '/ru/security'],\n";
const r47aRuNew = r47aRuBase + "  ['Данные сайта и счётчик', '/ru/privacy'],\n";
function stripR47aFooter(value, requirePair) {
  const s = normalizeEol(value);
  const en = s.split(r47aEnNew).length - 1, ru = s.split(r47aRuNew).length - 1;
  if (requirePair ? en !== 1 || ru !== 1 : !((en === 0 && ru === 0) || (en === 1 && ru === 1))) return null;
  return s.replace(r47aEnNew, r47aEnBase).replace(r47aRuNew, r47aRuBase);
}

function sourceBoundLayout(candidate, sourceBaseline) {
  let reviewed = stripR47aFooter(sourceBaseline, false);
  const candidateR46 = stripR47aFooter(candidate, true);
  if (reviewed === null || candidateR46 === null) return false;
  if (createHash('sha256').update(candidateR46, 'utf8').digest('hex') !== r47aLayoutSha) return false;
  const count = (source, value) => source.split(value).length - 1;
  if (count(reviewed, registryImport) !== 1 || count(reviewed, pathAnchor) !== 1 || count(reviewed, insertionAnchor) !== 1) return false;
  if (!reviewed.includes(coverageImport)) reviewed = reviewed.replace(registryImport, registryImport + '\n' + coverageImport);
  if (!reviewed.includes(coverageLookup)) reviewed = reviewed.replace(pathAnchor, pathAnchor + '\n' + coverageLookup);
  if (count(reviewed, originalMount) === 1) reviewed = reviewed.replace(originalMount, disabledMount);
  if (count(reviewed, coverageImport) !== 1 || count(reviewed, coverageLookup) !== 1
    || count(reviewed, disabledMount) !== 1 || count(reviewed, originalMount) !== 0) return false;
  const tags = [...reviewed.matchAll(/<script\b[^>]*\bsrc="\/bitevo-event-counter\.js"[^>]*><\/script>/gi)];
  return tags.length === 1 && !reviewed.includes('data-bitevo-events="enabled"')
    && candidateR46 === reviewed;
}
const baselineLayout = gitBase('src/layouts/Layout.astro');
expect(sourceBoundLayout(layout, baselineLayout), 'Layout is only the exact coverage import, lookup and OFF mount change');
expect(sourceBoundLayout(layout, layout), 'post-commit reviewed baseline remains accepted');
expect(!sourceBoundLayout(layout + '\n' + disabledMount, baselineLayout), 'duplicate counter mount rejected');
expect(!sourceBoundLayout(layout.replace('data-bitevo-events="disabled"', 'data-bitevo-events="enabled"'), baselineLayout), 'enabled counter mount rejected');
expect(!sourceBoundLayout(layout.replace('JSON.stringify(counterCoverage)', 'JSON.stringify({})'), baselineLayout), 'unreviewed policy substitution rejected');
expect(!sourceBoundLayout(layout.replace(insertionAnchor, '    <script defer src="/_vercel/insights/altered.js"></script>'), baselineLayout), 'changed analytics anchor rejected');
expect(!sourceBoundLayout(layout + '\n<!-- unrelated Layout change -->', baselineLayout), 'unrelated Layout edit rejected');
expect(!layout.includes('data-bitevo-events="enabled"'), 'telemetry must stay OFF');
expect(coverage.schema === 'bitevo.event-coverage/v1' && coverage.defaultMode === 'disabled', 'coverage mode and schema exact');
const expectedRows = [{"path":"/","locale":"en","events":["triage_click"]},{"path":"/start","locale":"en","events":["pilot_click"]},{"path":"/pricing","locale":"en","events":["triage_click","mailto_click","pilot_click"]},{"path":"/agent-authority-audit","locale":"en","events":["mailto_click"]},{"path":"/entry-audit","locale":"en","events":["triage_click","mailto_click"]},{"path":"/control-validation","locale":"en","events":["mailto_click"]},{"path":"/build/exception-workflow-diagnostic","locale":"en","events":["mailto_click"]},{"path":"/build/hr-workflow-diagnostic","locale":"en","events":["mailto_click"]},{"path":"/build/workflow-value-example","locale":"en","events":["mailto_click"]},{"path":"/phuket-ai-workflow","locale":"en","events":["mailto_click","pilot_click"]},{"path":"/mapper","locale":"en","events":["mailto_click"]},{"path":"/diagnostic","locale":"en","events":["mailto_click"]},{"path":"/audit-intake","locale":"en","events":["mailto_click","scope_generated"]},{"path":"/agent-incidents","locale":"en","events":["mailto_click"]},{"path":"/ru","locale":"ru","events":["triage_click"]},{"path":"/ru/pricing","locale":"ru","events":["mailto_click"]},{"path":"/ru/agent-authority-audit","locale":"ru","events":["mailto_click"]},{"path":"/ru/mapper","locale":"ru","events":["mailto_click"]},{"path":"/ru/diagnostic","locale":"ru","events":["mailto_click"]},{"path":"/ru/audit-intake","locale":"ru","events":["mailto_click","scope_generated"]},{"path":"/ru/universe","locale":"ru","events":["pilot_click"]},{"path":"/ru/entry-audit","locale":"ru","events":["mailto_click"]},{"path":"/ru/control-validation","locale":"ru","events":["mailto_click"]},{"path":"/ru/build/exception-workflow-diagnostic","locale":"ru","events":["mailto_click"]}];
expect(JSON.stringify(coverage.routes) === JSON.stringify(expectedRows), 'exact approved 24-page event matrix');
expect(coverage.routes.length === 24 && new Set(coverage.routes.map(row => row.path)).size === 24, '24 unique covered pages');
const byPath = new Map(coverage.routes.map(row => [row.path, row]));
const publicRows = registry.routes.filter(row => row.indexable);
expect(publicRows.length === 131, '131 indexable routes preserved');
expect(coverage.routes.every(row => publicRows.some(p => p.path === row.path && p.locale === row.locale)), 'coverage registry and locale parity');
expect(ingress.includes('COVERAGE_PATHS.get(row.page)') && ingress.includes('coverage.events.includes(row.event)'), 'ingress enforces approved event per page');
expect(tracker.includes('pageEvents.has(event)') && tracker.includes("'events,locale,path'"), 'client enforces exact per-page metadata');
function attribute(tag, name) {
  const value = new RegExp('\\b' + name + '="([^"]*)"').exec(tag)?.[1];
  return value?.replace(/&quot;|&#34;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&');
}
for (const route of publicRows) {
  const html = await read(route.path === '/' ? 'dist/index.html' : 'dist' + route.path + '/index.html');
  const tags = [...html.matchAll(/<script\b[^>]*\bsrc="\/bitevo-event-counter\.js"[^>]*><\/script>/gi)];
  const row = byPath.get(route.path);
  expect(tags.length === (row ? 1 : 0), route.path + ': exact counter mount count');
  if (row) {
    const tag = tags[0][0];
    expect(attribute(tag, 'data-bitevo-events') === 'disabled', route.path + ': OFF');
    expect(attribute(tag, 'data-bitevo-event-schema') === coverage.schema, route.path + ': schema');
    expect(JSON.stringify(JSON.parse(attribute(tag, 'data-bitevo-event-coverage'))) === JSON.stringify(row), route.path + ': exact row embedded');
  }
}
// R45: accept only the exact receipt guard change on the reviewed Worker.
// Pin the LF-normalized legacy source so an unrelated post-commit baseline
// cannot silently authorize a changed receiver, signature, SQL or route.
const receiptLegacyGuard = '    if (!result || result.success === false) {';
const receiptStrictGuard = '    if (result?.success !== true || result?.meta?.changes !== 1) {';
const receiptWorkerBaselineSha256 = '522a3476c8a3aa76d0bcd6d60c19c036ae83bc7ab27e8ded9c66bc227571993f';
function sourceBoundWriteReceipt(candidate, sourceBaseline) {
  let original = normalizeEol(sourceBaseline);
  const count = (source, value) => source.split(value).length - 1;
  if (count(original, receiptStrictGuard) === 1 && count(original, receiptLegacyGuard) === 0) {
    original = original.replace(receiptStrictGuard, receiptLegacyGuard);
  }
  if (count(original, receiptLegacyGuard) !== 1 || count(original, receiptStrictGuard) !== 0
    || createHash('sha256').update(original, 'utf8').digest('hex') !== receiptWorkerBaselineSha256) return false;
  return normalizeEol(candidate) === original.replace(receiptLegacyGuard, receiptStrictGuard);
}
const receiptWorkerBaseline = gitBase('worker/index.mjs');
expect(sourceBoundWriteReceipt(worker, receiptWorkerBaseline), 'R45 exact strict single-write receipt change only');
expect(sourceBoundWriteReceipt(worker, worker), 'R45 reviewed post-commit Worker baseline remains accepted');
expect(!sourceBoundWriteReceipt(worker.replace(receiptStrictGuard, receiptLegacyGuard), receiptWorkerBaseline),
  'R45 weak legacy receipt must not be accepted');
for (const [label, from, to] of [
  ['success coercion', 'result?.success !== true', 'result?.success === false'],
  ['changes coercion', 'result?.meta?.changes !== 1', 'result?.meta?.changes != 1'],
  ['unexpected write count', 'result?.meta?.changes !== 1', 'result?.meta?.changes !== 2'],
  ['signature bypass', 'if (!verified)', 'if (false)'],
  ['SQL change', 'DO UPDATE SET count = count + 1', 'DO UPDATE SET count = count + 2'],
  ['routing change', "return Response.redirect(new URL('/guides', url), 302);", "return Response.redirect(new URL('/guides', url), 301);"],
  ['receiver activation', "env?.BITEVO_EVENT_COUNTER_RECEIVER_ENABLED !== 'true'", 'false']
]) {
  expect(worker.includes(from), 'R45 negative mutation anchor exists: ' + label);
  const mutated = worker.replace(from, to);
  expect(!sourceBoundWriteReceipt(mutated, receiptWorkerBaseline), 'R45 rejects unrelated Worker change: ' + label);
  expect(!sourceBoundWriteReceipt(mutated, mutated), 'R45 rejects changed post-commit baseline: ' + label);
}
expect(!sourceBoundWriteReceipt(worker + '\n// unrelated change', receiptWorkerBaseline), 'R45 rejects appended Worker content');
expect(!sourceBoundWriteReceipt(worker + '\n' + receiptStrictGuard, receiptWorkerBaseline), 'R45 rejects duplicate receipt guard');
expect(normalizeEol(sql) === normalizeEol(gitBase('schema/bitevo_public_event_daily.sql')),
  'schema/bitevo_public_event_daily.sql: receiver/storage not changed');

expect(sourceBoundR48Config(wrangler, r46WranglerBase), 'R48 exact bounded binding only');
expect(!wrangler.includes('BITEVO_EVENT_COUNTER_SIGNING_SECRET'), 'R48 secret not written in source');
expect(!wrangler.includes('BITEVO_EVENT_COUNTER_REPORT_ENABLED'), 'R48 report remains OFF');
expect(!vercel.includes('BITEVO_EVENT_COUNTER_ENABLED'), 'no Vercel provider activation without approval');

console.log('B1_2_LOCAL_STATIC_GATE_PASS checks=' + checks
  + ' events=4 D1_columns=5 personal_columns=0'
  + ' client_wired=PASSIVE_24_REVIEWED_ROUTES events_enabled=NO receiver_flag=TRUE secret_provisioning=NOT_IN_SOURCE production_writes=0');
