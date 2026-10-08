// T1.4: EN-primary / RU-secondary structural translation check for BitEvo P30.
// Read-only. Reuse the published P30 frontmatter parser; do not regenerate routes.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from '../../scripts/generate-research-notes.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const contentDir = join(root, 'src/content/research-notes');
const required = [
  'site', 'path', 'alternate', 'lang', 'card', 'title',
  'seo_title', 'description', 'reviewed', 'next_review',
  'related', 'schema', 'research_source'
];
const baselineSlugs = [
  'before-write-access',
  'mcp-server-authority-review',
  'bitget-authority-after-orchestration-compromise'
];
const months = Object.freeze({
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6,
  июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12
});
const monthWords = Object.keys(months).sort((a, b) => b.length - a.length).join('|');
const humanDate = new RegExp('\\b(\\d{1,2})\\s+(' + monthWords + ')\\s+(\\d{4})\\b', 'giu');
const urlPattern = /https?:\/\/[^\s<>"'\x60)\]]+/g;
let checks = 0;
function check(ok, message) {
  checks += 1;
  assert.ok(ok, message);
}
function equal(a, b, message) {
  checks += 1;
  assert.deepEqual(a, b, message);
}
const ordered = values => [...new Set(values)].sort();
const sameSet = (a, b) => JSON.stringify(ordered(a)) === JSON.stringify(ordered(b));
const pad = value => String(value).padStart(2, '0');

function normalizeDates(value) {
  return value
    .replace(humanDate, (_match, day, word, year) =>
      year + '-' + pad(months[word.toLowerCase()]) + '-' + pad(day))
    .replace(/\b(\d{2})[.\/](\d{2})[.\/](\d{4})\b/g,
      (_match, day, month, year) => year + '-' + month + '-' + day);
}
function extractUrls(value) {
  return ordered([...value.matchAll(urlPattern)].map(match => match[0].replace(/[.,;:]+$/, '')));
}
function bodyMetrics(body) {
  const lines = body.split(/\r?\n/);
  const tableLines = lines.filter(line => /^\s*\|.*\|\s*$/.test(line));
  const tableSeparator = /^\s*\|(?:\s*:?-{2,}:?\s*\|)+\s*$/;
  const stripped = normalizeDates(body.replace(urlPattern, ' '));
  return {
    h2: lines.filter(line => /^##\s+/.test(line)).length,
    h3: lines.filter(line => /^###\s+/.test(line)).length,
    table_lines: tableLines.length,
    table_rows: tableLines.filter(line => !tableSeparator.test(line)).length,
    list_items: lines.filter(line => /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line)).length,
    url_set: extractUrls(body),
    numeric_set: ordered([...stripped.matchAll(/\d+(?:[.,:]\d+)*/g)]
      .map(match => match[0].replaceAll(',', '.'))),
    date_set: ordered([...stripped.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)]
      .map(match => match[0]))
  };
}
function parityDifferences(enBody, ruBody) {
  const en = bodyMetrics(enBody);
  const ru = bodyMetrics(ruBody);
  return Object.keys(en).filter(key => JSON.stringify(en[key]) !== JSON.stringify(ru[key]));
}
function inventory(fileNames) {
  const pairs = new Map();
  for (const name of fileNames) {
    if (!name.endsWith('.md')) continue;
    const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.(en|ru)\.md$/.exec(name);
    if (!match) throw new Error('Unrecognised Markdown source in research-notes: ' + name);
    const [, slug, lang] = match;
    if (!pairs.has(slug)) pairs.set(slug, {});
    if (pairs.get(slug)[lang]) throw new Error('Duplicate language for ' + slug);
    pairs.get(slug)[lang] = name;
  }
  for (const [slug, pair] of pairs) {
    if (!pair.en || !pair.ru) throw new Error('Orphan language for ' + slug);
  }
  return pairs;
}
function decodeSource(value, name) {
  const text = value.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const end = text.indexOf('\n---\n', 4);
  if (!text.startsWith('---\n') || end < 0) throw new Error(name + ': missing Markdown frontmatter');
  return {
    fm: parseFrontmatter(text, name),
    body: text.slice(end + 5)
  };
}
function validateMetadata(slug, en, ru) {
  for (const [lang, doc] of [['en', en], ['ru', ru]]) {
    const fm = doc.fm;
    for (const key of required) check(fm[key] !== undefined && fm[key] !== '', slug + '.' + lang + ': missing ' + key);
    equal(fm.lang, lang, slug + ': file language');
    equal(fm.site, 'bitevo.work', slug + ': site');
    equal(fm.path, (lang === 'ru' ? '/ru' : '') + '/guides/' + slug, slug + ': route path');
    equal(fm.alternate, (lang === 'en' ? '/ru' : '') + '/guides/' + slug, slug + ': reciprocal alternate');
    check(/^\d{4}-\d{2}-\d{2}$/.test(String(fm.reviewed)), slug + ': reviewed ISO date');
    check(/^\d{4}-\d{2}-\d{2}$/.test(String(fm.next_review)), slug + ': next_review ISO date');
    check(Array.isArray(fm.schema) && fm.schema.includes('Article') && fm.schema.includes('BreadcrumbList'),
      slug + ': Article/Breadcrumb schema');
    check(Array.isArray(fm.related), slug + ': related list');
    check(typeof fm.research_source === 'string' && fm.research_source.trim().length > 0,
      slug + ': research_source attribution');
  }
  equal(en.fm.reviewed, ru.fm.reviewed, slug + ': reviewed parity');
  equal(en.fm.next_review, ru.fm.next_review, slug + ': next_review parity');
  equal(en.fm.schema, ru.fm.schema, slug + ': schema order parity');
  equal(en.fm.card.split(' · ')[0], ru.fm.card.split(' · ')[0], slug + ': card number parity');
  equal(en.fm.related, ru.fm.related.map(route => route.replace(/^\/ru(?=\/)/, '')),
    slug + ': localised related-link order parity');
}
function expectDifference(en, ru, label) {
  check(parityDifferences(en, ru).length > 0, 'Fixture failed to detect: ' + label);
}
function expectThrow(fn, label) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  check(threw, 'Fixture failed closed: ' + label);
}
function runFixtures() {
  const en = '## Heading\n### Detail\n| Key | Value |\n| --- | --- |\n| Case | 31.43 |\n- List\n' +
    'Source: https://docs.example.invalid/fact\nReviewed 2 October 2026.\n';
  const ru = '## Заголовок\n### Деталь\n| Ключ | Значение |\n| --- | --- |\n| Дело | 31,43 |\n- Список\n' +
    'Источник: https://docs.example.invalid/fact\nПроверено 2 октября 2026.\n';
  check(parityDifferences(en, ru).length === 0, 'Fixture positive RU/EN decimal and date normalization');
  expectDifference(en, ru.replace('## Заголовок', 'Заголовок'), 'missing H2');
  expectDifference(en, ru.replace('### Деталь', 'Деталь'), 'missing H3');
  expectDifference(en, ru.replace('| Дело | 31,43 |', ''), 'missing table row');
  expectDifference(en, ru.replace('| --- | --- |', ''), 'missing table separator line');
  expectDifference(en, ru.replace('- Список', 'Список'), 'missing list item');
  expectDifference(en, ru.replace('/fact', '/other'), 'external source URL drift');
  expectDifference(en, ru.replace('31,43', '32,43'), 'numerical value drift');
  expectDifference(en, ru.replace('2 октября', '3 октября'), 'date drift');
  expectDifference(en, ru + '\n### Дополнительный раздел', 'extra H3');
  expectThrow(() => inventory(['example.en.md']), 'orphan EN file');
  expectThrow(() => inventory(['example.ru.md']), 'orphan RU file');
  expectThrow(() => inventory(['README.md']), 'stray README inside published source directory');
  expectThrow(() => decodeSource('No frontmatter', 'example.en.md'), 'missing frontmatter');
  const parsed = parseFrontmatter('---\nsite: bitevo.work\nlang: en\nschema: [Article, BreadcrumbList]\n---\n',
    'T1.4 in-memory fixture');
  equal(parsed.schema, ['Article', 'BreadcrumbList'], 'reuse P30 generator parser');
}
runFixtures();
const names = await readdir(contentDir);
const pairs = inventory(names);
for (const slug of baselineSlugs) check(pairs.has(slug), 'Historical P30 pair missing: ' + slug);
check(pairs.size >= baselineSlugs.length, 'At least three P30 pairs are required');
let actualPairCount = 0;
for (const [slug, files] of [...pairs.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const en = decodeSource(await readFile(join(contentDir, files.en), 'utf8'), files.en);
  const ru = decodeSource(await readFile(join(contentDir, files.ru), 'utf8'), files.ru);
  validateMetadata(slug, en, ru);
  const differences = parityDifferences(en.body, ru.body);
  equal(differences, [], slug + ': structural/URL/numeric/date parity');
  const m = bodyMetrics(en.body);
  console.log('T1_4_PAIR=PASS slug=' + slug + ' h2=' + m.h2 + ' h3=' + m.h3 +
    ' table_lines=' + m.table_lines + ' table_rows=' + m.table_rows +
    ' list_items=' + m.list_items + ' url_set=' + m.url_set.length +
    ' numeric_set=' + m.numeric_set.length + ' date_set=' + m.date_set.length);
  actualPairCount += 1;
}
console.log('T1_4_BITEVO_TRANSLATION_CONTRACT_R1=PASS pairs=' + actualPairCount +
  ' en_primary=' + actualPairCount + ' ru_translation=' + actualPairCount +
  ' checks=' + checks + ' fixture_checks=15 mismatches=0' +
  ' p30_frontmatter_parser=reused publication_gate=SEPARATE');
