import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const en = await read('src/pages/entry-audit-vs-pentest-ai-security-grc.astro');
const ru = await read('src/pages/ru/entry-audit-vs-pentest-ai-security-grc.astro');
const enHtml = await read('dist/entry-audit-vs-pentest-ai-security-grc/index.html');
const ruHtml = await read('dist/ru/entry-audit-vs-pentest-ai-security-grc/index.html');
const registry = JSON.parse(await read('src/data/public-route-registry.json'));
const currentness = JSON.parse(await read('src/data/sitemap-currentness.json'));
const packageJson = JSON.parse(await read('package.json'));

const checked = '2026-10-05';
const ids = ['entry-audit','pentest','ai-security-platform','grc'];
const products = ['BitEvo Entry Audit','Cobalt Autonomous Pentest','Mindgard Platform','Secureframe Fundamentals'];
const prices = ['$1,500 fixed','$3,500 per test','Public list price not shown','Starting at $7,000/year'];
const sources = [
  'https://www.cobalt.io/platform/pricing',
  'https://mindgard.ai/',
  'https://mindgard.ai/demo',
  'https://secureframe.com/pricing'
];

for (const source of [en, ru]) {
  check(source.includes(checked), 'checked date present in source');
  for (const id of ids) check(source.includes("id: '"+id+"'"), id + ' row present');
  for (const product of products) check(source.includes(product), product + ' present');
  for (const price of prices) check(source.includes(price), price + ' present');
  for (const href of sources) check(source.includes(href), href + ' source bound');
  check(source.includes('2026-12-31'), 'Cobalt offer expiry explicitly dated');
}
for (const html of [enHtml, ruHtml]) {
  for (const id of ids) check(html.includes('data-comparison="'+id+'"'), id + ' rendered');
  for (const product of products) check(html.includes(product), product + ' rendered');
  for (const price of prices) check(html.includes(price), price + ' rendered');
  for (const href of sources) check(html.includes('href="'+href+'"'), href + ' rendered');
  equal((html.match(/data-comparison="/g) || []).length, 4, 'exact four comparison rows');
  check(html.includes(checked), 'checked date rendered');
}
check(en.includes('not market averages') && en.includes('does not claim feature equivalence'), 'EN anti-market-average boundary');
check(ru.includes('а не market averages') && ru.includes('не утверждает feature equivalence'), 'RU anti-market-average boundary');
check(en.includes('did not publish a list price') && ru.includes('не публикует list price'), 'no invented AI-security platform price');
check(en.includes('does not claim that an Entry Audit replaces penetration testing'), 'EN non-replacement boundary');
check(ru.includes('не утверждает, что Entry Audit заменяет penetration testing'), 'RU non-replacement boundary');
check(!en.includes('market average price') && !ru.includes('средняя цена рынка:'), 'no synthetic market price');
check(!en.includes('cheaper than') && !ru.includes('дешевле'), 'no unsupported cheaper-than claim');

const expectedRoutes = [
  ['/entry-audit-vs-pentest-ai-security-grc','en','/entry-audit'],
  ['/ru/entry-audit-vs-pentest-ai-security-grc','ru','/ru/entry-audit']
];
for (const [path,locale,parent] of expectedRoutes) {
  const row = registry.routes.find(item => item.path === path);
  check(row?.category === 'RESEARCH' && row?.indexable === true && row?.locale === locale && row?.parent === parent, path + ' registry binding exact');
  const current = currentness.routes.find(item => item.path === path);
  check(/^\d{4}-\d{2}-\d{2}$/.test(String(current?.lastmod || '')), path + ' currentness date valid');
  check(/^sha256:[0-9a-f]{64}$/.test(String(current?.fingerprint || '')), path + ' currentness fingerprint valid');
}
equal(registry.routes.filter(row => row.indexable).length, 127, 'indexable route count N11 baseline');
equal(registry.routes.filter(row => row.indexable && row.locale === 'en').length, 64, 'EN indexable route count N11 baseline');
equal(registry.routes.filter(row => row.indexable && row.locale === 'ru').length, 63, 'RU indexable route count N11 baseline');
equal(currentness.routes.length, 127, 'currentness route count N11 baseline');
check(packageJson.scripts?.['verify:core']?.includes('verify-n11-procurement-comparison-r1.mjs'), 'N11 verifier wired into verify:core');

console.log(
  'N11_PROCUREMENT_COMPARISON_R1_GATE=PASS checks=' + checks +
  ' rows=4 routes=2 checked=2026-10-05 indexable=127 en=64 ru=63' +
  ' cobalt_public_price=BOUND secureframe_public_price=BOUND mindgard_price=NOT_PUBLIC' +
  ' market_average_claim=0 replacement_claim=0'
);
