import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const data = await read('src/data/glossary.ts');
const en = await read('src/pages/glossary.astro');
const ru = await read('src/pages/ru/glossary.astro');
const enHtml = await read('dist/glossary/index.html');
const ruHtml = await read('dist/ru/glossary/index.html');
const registry = JSON.parse(await read('src/data/public-route-registry.json'));
const currentness = JSON.parse(await read('src/data/sitemap-currentness.json'));
const packageJson = JSON.parse(await read('package.json'));

const terms = [
  'Authority Budget',
  'Evidence Before Effect',
  'False Green',
  'Object binding',
  'Authority owner',
  'Freshness',
  'External confirmation',
  'Recovery state',
  'Idempotency',
  'Confused deputy',
  'Consequential action',
  'Authority Ledger',
  'Evidence Contract',
  'Finding Record',
  'Decision Memo'
];

equal((data.match(/slug: '/g) || []).length, 15, 'exact 15 glossary terms in shared data');
for (const term of terms) {
  check(data.includes(`term: '${term}'`), term + ' present in shared data');
  check(enHtml.includes(`>${term}<`) || enHtml.includes(`#${term}`), term + ' rendered EN');
  check(ruHtml.includes(`>${term}<`) || ruHtml.includes(`#${term}`), term + ' rendered RU');
}
check(data.includes('BitEvo terminology for an operational evidence mismatch'), 'False Green definition grounded to doctrine boundary');
check(data.includes('system uses authority it legitimately has'), 'confused deputy bounded definition present');
check(data.includes('internal completion flag or tool acknowledgement alone is not that confirmation'), 'external confirmation boundary present');
check(data.includes('does not create an unintended additional external effect'), 'idempotency definition bounded to duplicate effect');
check(en.includes('does not claim ownership of industry terms or redefine external standards'), 'EN working-vocabulary boundary explicit');
check(ru.includes('не заявляет права на отраслевые термины и не переопределяет внешние стандарты'), 'RU working-vocabulary boundary explicit');
check(!en.includes('<script src=') && !ru.includes('<script src='), 'no page-specific executable JS added');
check(!data.includes('guarantee') && !data.includes('certification claim'), 'no invented guarantee or certification claim');

const parseDefinedTermSet = html => {
  const match = html.match(/<script[^>]*data-defined-term-set[^>]*>([\s\S]*?)<\/script>/i);
  check(Boolean(match), 'DefinedTermSet script rendered');
  return JSON.parse(match[1]);
};
for (const [locale, html, expectedUrl] of [
  ['en', enHtml, 'https://bitevo.work/glossary'],
  ['ru', ruHtml, 'https://bitevo.work/ru/glossary']
]) {
  const schema = parseDefinedTermSet(html);
  equal(schema['@context'], 'https://schema.org', locale + ' schema context');
  equal(schema['@type'], 'DefinedTermSet', locale + ' schema type');
  equal(schema.url, expectedUrl, locale + ' schema canonical URL');
  equal(schema.hasDefinedTerm?.length, 15, locale + ' hasDefinedTerm count');
  for (const term of schema.hasDefinedTerm || []) {
    equal(term['@type'], 'DefinedTerm', locale + ' child type');
    check(typeof term.name === 'string' && terms.includes(term.name), locale + ' child name canonical');
    check(typeof term.description === 'string' && term.description.length > 40, locale + ' child definition substantive');
    check(typeof term.inDefinedTermSet === 'string' && term.inDefinedTermSet.endsWith('#term-set'), locale + ' child set binding');
  }
}

const routes = [
  ['/glossary','en','/doctrine'],
  ['/ru/glossary','ru','/ru/doctrine']
];
for (const [path, locale, parent] of routes) {
  const row = registry.routes.find(item => item.path === path);
  check(row?.category === 'CONTEXT' && row?.indexable === true && row?.locale === locale && row?.parent === parent, path + ' registry binding exact');
  const current = currentness.routes.find(item => item.path === path);
  check(/^\d{4}-\d{2}-\d{2}$/.test(String(current?.lastmod || '')), path + ' currentness date valid');
  check(/^sha256:[0-9a-f]{64}$/.test(String(current?.fingerprint || '')), path + ' currentness fingerprint valid');
}
equal(registry.routes.filter(row => row.indexable).length, 125, 'indexable route count N20 baseline');
equal(registry.routes.filter(row => row.indexable && row.locale === 'en').length, 63, 'EN indexable route count N20 baseline');
equal(registry.routes.filter(row => row.indexable && row.locale === 'ru').length, 62, 'RU indexable route count N20 baseline');
equal(currentness.routes.length, 125, 'currentness route count N20 baseline');
check(packageJson.scripts?.['verify:core']?.includes('verify-n20-glossary-r1.mjs'), 'N20 verifier wired into verify:core');

console.log(
  'N20_GLOSSARY_R1_GATE=PASS checks=' + checks +
  ' routes=2 terms=15 schema=DefinedTermSet defined_terms=30 shared_data=1 client_js_added=0' +
  ' working_definition_boundary=PASS indexable=125 en=63 ru=62'
);
