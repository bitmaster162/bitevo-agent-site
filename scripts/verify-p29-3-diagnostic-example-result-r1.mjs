import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };
const sha = value => createHash('sha256').update(value, 'utf8').digest('hex');
const root = new URL('../', import.meta.url);

const assignment = 'Authority Budget=YES|Object binding=YES|Authority owner=YES|Evidence Before Effect=UNKNOWN|Freshness=UNKNOWN|External confirmation=NO|Recovery=UNKNOWN';
equal(sha(assignment), '342dbf9f2815632e2a0d48445e4e2caf2eb0b04155f91fa7037700a4622bc30a', 'approved P29.3 synthetic assignment hash');

const rows = [
  ['Authority Budget', 'YES'],
  ['Object binding', 'YES'],
  ['Authority owner', 'YES'],
  ['Evidence Before Effect', 'UNKNOWN'],
  ['Freshness', 'UNKNOWN'],
  ['External confirmation', 'NO'],
  ['Recovery', 'UNKNOWN']
];
const unresolved = [
  ['Evidence Before Effect', 'UNKNOWN'],
  ['Freshness', 'UNKNOWN'],
  ['External confirmation', 'NO'],
  ['Recovery', 'UNKNOWN']
];

const enSource = await readFile(new URL('src/pages/diagnostic.astro', root), 'utf8');
const ruSource = await readFile(new URL('src/pages/ru/diagnostic.astro', root), 'utf8');
const enHtml = await readFile(new URL('dist/diagnostic/index.html', root), 'utf8');
const ruHtml = await readFile(new URL('dist/ru/diagnostic/index.html', root), 'utf8');
const currentness = JSON.parse(await readFile(new URL('src/data/sitemap-currentness.json', root), 'utf8'));
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

function exampleSegment(source) {
  const marker = source.indexOf('data-p29-3-example-result');
  check(marker >= 0, 'example result marker exists');
  const start = source.lastIndexOf('<section', marker);
  const end = source.indexOf('</section>', marker);
  check(start >= 0 && end > marker, 'example result section is bounded');
  return source.slice(start, end + '</section>'.length);
}

function dynamicScript(source) {
  const match = source.match(/<script define:vars=\{\{\s*questions\s*\}\}>([\s\S]*?)<\/script>/);
  check(Boolean(match), 'dynamic diagnostic script found');
  return match[1].replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

const enExample = exampleSegment(enSource);
const ruExample = exampleSegment(ruSource);

check(enSource.indexOf('data-p29-3-example-result') < enSource.indexOf('<form id="diagnostic"'), 'EN example appears before questionnaire');
check(ruSource.indexOf('data-p29-3-example-result') < ruSource.indexOf('<form id="ruDiagnostic"'), 'RU example appears before questionnaire');
check(enSource.indexOf('data-p29-3-example-result') > enSource.indexOf('</section>', enSource.indexOf('diag-hero')), 'EN example appears below hero');
check(ruSource.indexOf('data-p29-3-example-result') > ruSource.indexOf('</section>', ruSource.indexOf('class="section hero"')), 'RU example appears below hero');

check(enExample.includes('<details class="panel">') && !/<details\b[^>]*\bopen(?:\s|=|>)/i.test(enExample), 'EN uses native collapsed details');
check(ruExample.includes('<details class="panel">') && !/<details\b[^>]*\bopen(?:\s|=|>)/i.test(ruExample), 'RU uses native collapsed details');
check(enExample.includes('Example result') && enExample.includes('SAMPLE'), 'EN summary copy exact');
check(ruExample.includes('Пример результата') && ruExample.includes('SAMPLE'), 'RU summary copy exact');
check(enHtml.includes('Example result') && enHtml.includes('SAMPLE'), 'EN static HTML contains visible collapsed summary');
check(ruHtml.includes('Пример результата') && ruHtml.includes('SAMPLE'), 'RU static HTML contains visible collapsed summary');

for (const [gate, answer] of rows) {
  for (const [locale, source, html] of [['EN', enSource, enHtml], ['RU', ruSource, ruHtml]]) {
    check(source.includes(`{ gate: '${gate}', answer: '${answer}' }`), `${locale}: source assignment exact for ${gate}`);
    const answerPattern = new RegExp(`<span[^>]*>${answer}</span>`);
    const gatePattern = new RegExp(`<strong[^>]*>${gate.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}</strong>`);
    check(answerPattern.test(html) && gatePattern.test(html), `${locale}: static example renders ${gate}=${answer}`);
  }
}

equal(rows.filter(([, answer]) => answer === 'YES').length, 3, 'sample has 3 YES gates');
equal(rows.filter(([, answer]) => answer === 'NO').length, 1, 'sample has 1 NO gate');
equal(rows.filter(([, answer]) => answer === 'UNKNOWN').length, 3, 'sample has 3 UNKNOWN gates');
equal(unresolved.length, 4, 'sample has exactly 4 unresolved gates');
for (const [gate, answer] of unresolved) {
  const phrase = `${gate} [${answer}]`;
  check(enExample.includes(phrase) && ruExample.includes(phrase), `unresolved list includes ${phrase} in both locales`);
}
check(enExample.includes('These four gates require explicit engineering evidence before authority expands.'), 'EN unresolved engineering-evidence boundary exact');
check(ruExample.includes('Эти четыре gates требуют явных инженерных доказательств до расширения authority.'), 'RU unresolved engineering-evidence boundary exact');

for (const [locale, segment] of [['EN', enExample], ['RU', ruExample]]) {
  check(!/(?:fetch\s*\(|XMLHttpRequest|sendBeacon|<script\b|<form\b|<button\b|<a\b)/i.test(segment), `${locale}: example adds no JS, network action, form submission or CTA`);
  check(!/<style\b/i.test(segment), `${locale}: example adds no style block`);
}

equal(sha(dynamicScript(enSource)), 'cc50f9c26f6615132719e58765d9c0fcdd05055bcbbf9ba4270bc50b3a66c03c', 'EN dynamic diagnostic script unchanged');
equal(sha(dynamicScript(ruSource)), '82460d8bc67ff290e5da190bad2288e252fd544ee08e4cd304aec3f09701e55c', 'RU dynamic diagnostic script unchanged');
equal((enSource.match(/name=\{item\.id\}/g) || []).length, 3, 'EN questionnaire still declares YES/NO/UNKNOWN controls once each in map');
equal((ruSource.match(/name=\{item\.id\}/g) || []).length, 3, 'RU questionnaire still declares YES/NO/UNKNOWN controls once each in map');

check(!enSource.includes('Book a free 20-minute triage') && !ruSource.includes('Записаться на бесплатный разбор, 20 минут'), 'P29.1 Cal.com CTA remains unpublished');
check(!enSource.includes('cal.com') && !ruSource.includes('cal.com'), 'no Cal.com URL published by P29.3');

const expectedCurrentness = {
  '/diagnostic': { lastmod: '2026-10-05', fingerprint: 'sha256:6a3365a00e676720709a69af93f6cb08e25baa8a1ae4589d9d97b045c7c0653c' },
  '/ru/diagnostic': { lastmod: '2026-10-04', fingerprint: 'sha256:ddc94d00f5d0b8d33b7e96da5e822ce3166d51e20a83df689b674f94c51a0358' }
};
for (const [path, value] of Object.entries(expectedCurrentness)) {
  const row = currentness.routes.find(item => item.path === path);
  check(row?.lastmod === value.lastmod && row?.fingerprint === value.fingerprint, `currentness exact for ${path}`);
}
equal(currentness.routes.length, 125, 'currentness route count is exact P30 baseline');
check(packageJson.scripts?.['verify:core']?.includes('verify-p29-3-diagnostic-example-result-r1.mjs'), 'P29.3 verifier wired into verify:core');

console.log(`P29_3_DIAGNOSTIC_EXAMPLE_RESULT_R1_GATE=PASS checks=${checks} locales=2 gates=7 yes=3 no=1 unknown=3 unresolved=4 static_html=PASS native_details=COLLAPSED dynamic_logic=UNCHANGED js_added=0 network_added=0 p29_1_calcom=OMITTED`);
