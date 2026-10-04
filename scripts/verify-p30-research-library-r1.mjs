import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './generate-research-notes.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const generated = JSON.parse(await readFile(join(root, 'src/generated/research-notes.json'), 'utf8'));
const registry = JSON.parse(await readFile(join(root, 'src/data/public-route-registry.json'), 'utf8'));
const vercel = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
let checks = 0;
const check = (value, message) => { checks += 1; assert.ok(value, message); };
const equal = (actual, expected, message) => { checks += 1; assert.equal(actual, expected, message); };

const expected = [
  '/guides/before-write-access',
  '/ru/guides/before-write-access'
];
equal(generated.schema, 'bitevo.research-notes/v1', 'generated schema');
equal(generated.notes.length, 2, 'published research note locale count');
for (const path of expected) check(generated.notes.some(note => note.path === path), `generated note missing ${path}`);

const enMeta = generated.notes.find(note => note.path === expected[0]);
const ruMeta = generated.notes.find(note => note.path === expected[1]);
equal(enMeta.alternate, ruMeta.path, 'EN alternate');
equal(ruMeta.alternate, enMeta.path, 'RU alternate');
equal(enMeta.reviewed, '2026-10-01', 'EN reviewed');
equal(ruMeta.reviewed, '2026-10-01', 'RU reviewed');
equal(enMeta.next_review, '2027-01-01', 'EN next review');
equal(ruMeta.next_review, '2027-01-01', 'RU next review');
equal(ruMeta.description, 'Семь вопросов, на которые нужно ответить доказательствами, прежде чем AI-агент сможет менять записи в CRM, тикеты, платежи, код или данные, — с публичным случаем для каждого.', 'RU description exact from attached P30 frontmatter');
equal(ruMeta.description.length, 174, 'RU canonical description length is an explicit P30 source exception');

for (const note of generated.notes) {
  const route = registry.routes.find(item => item.path === note.path);
  check(route, `${note.path}: registry route`);
  equal(route.category, 'RESEARCH', `${note.path}: registry category`);
  equal(route.indexable, true, `${note.path}: registry indexable`);
  equal(route.generatedBy, 'research-notes', `${note.path}: generated marker`);
  equal(route.reviewed, note.reviewed, `${note.path}: reviewed binding`);
}

const fallback = (vercel.redirects || []).find(item => String(item.source || '').startsWith('/guides/:slug'));
check(fallback, 'Vercel guide fallback exists');
check(fallback.source.includes('before-write-access'), 'Vercel guide fallback allowlists before-write-access');
equal(fallback.destination, '/guides', 'Vercel guide fallback destination');
equal(fallback.permanent, true, 'Vercel guide fallback permanent');

function fileFor(route) {
  return join(dist, route.replace(/^\//, ''), 'index.html');
}
function jsonLd(html) {
  return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap(match => {
      const value = JSON.parse(match[1]);
      return Array.isArray(value) ? value : [value];
    });
}

for (const note of generated.notes) {
  const html = await readFile(fileFor(note.path), 'utf8');
  equal((html.match(/<h3\b/g) || []).length, 7, `${note.path}: seven h3 checks`);
  check(html.includes(`<link rel="canonical" href="https://bitevo.work${note.path}">`), `${note.path}: canonical`);
  check(html.includes(`<meta name="description" content="${note.description}">`), `${note.path}: meta description exact from frontmatter`);
  const en = note.lang === 'en' ? note.path : note.alternate;
  const ru = note.lang === 'ru' ? note.path : note.alternate;
  check(html.includes(`hreflang="en" href="https://bitevo.work${en}"`), `${note.path}: hreflang en`);
  check(html.includes(`hreflang="ru" href="https://bitevo.work${ru}"`), `${note.path}: hreflang ru`);
  check(html.includes(`hreflang="x-default" href="https://bitevo.work${en}"`), `${note.path}: hreflang x-default`);
  check(html.includes(note.lang === 'ru' ? 'Следующая проверка' : 'Next review'), `${note.path}: next review visible`);
  check(html.includes(note.next_review), `${note.path}: next review date visible`);
  const objects = jsonLd(html);
  check(objects.some(item => item['@type'] === 'Article' && item.headline === note.title && item.dateModified === '2026-10-01'), `${note.path}: Article JSON-LD`);
  check(objects.some(item => item['@type'] === 'BreadcrumbList'), `${note.path}: BreadcrumbList JSON-LD`);
  for (const anchor of html.matchAll(/<a\b[^>]*href=["']https?:\/\/[^"']+["'][^>]*>/gi)) {
    check(/\brel=["'][^"']*\bnoopener\b[^"']*["']/i.test(anchor[0]), `${note.path}: external link missing rel=noopener`);
  }
}

const enIndex = await readFile(fileFor('/guides'), 'utf8');
const ruIndex = await readFile(fileFor('/ru/guides'), 'utf8');
for (const href of ['/guides/security-sandboxing','/guides/fleet-coordinator-drift-monitoring','/guides/d3-tool-io-bridge-contract','/guides/before-write-access']) {
  check(enIndex.includes(`href="${href}"`), `/guides card missing ${href}`);
}
for (const href of ['/ru/guides/security-sandboxing','/ru/guides/fleet-coordinator-drift-monitoring','/ru/guides/d3-tool-io-bridge-contract','/ru/guides/before-write-access']) {
  check(ruIndex.includes(`href="${href}"`), `/ru/guides card missing ${href}`);
}
for (const phrase of ['RU · PUBLIC PRODUCT LAYER','reviewed note','isolation boundaries','Research ≠ customer proof','Reviewed public research','PUBLICATION POLICY','Legacy archive','Historical notes']) {
  check(!ruIndex.includes(phrase), `/ru/guides forbidden mixed-language phrase: ${phrase}`);
}
for (const phrase of ['Изоляция и ограниченный запуск инструментов','Мониторинг дрейфа координатора','Контракт ввода-вывода инструментов','Проверенные публичные заметки']) {
  check(ruIndex.includes(phrase), `/ru/guides required Russian phrase missing: ${phrase}`);
}

const sitemap = await readFile(join(dist, 'sitemap.xml'), 'utf8');
for (const path of expected) {
  const entry = `<loc>https://bitevo.work${path}</loc><lastmod>2026-10-01</lastmod>`;
  check(sitemap.includes(entry), `sitemap exact currentness missing ${path}`);
}

const llms = await readFile(join(dist, 'llms.txt'), 'utf8');
const researchStart = llms.indexOf('### Research');
const contextStart = llms.indexOf('### Context', researchStart);
check(researchStart >= 0 && contextStart > researchStart, 'llms Research section boundaries');
const researchSection = llms.slice(researchStart, contextStart);
for (const path of expected) check(researchSection.includes(`- ${path}`), `llms Research missing ${path}`);

for (const [route, href, label] of [
  ['/diagnostic','/guides/before-write-access','Seven checks before an agent gets write access →'],
  ['/agent-authority-audit','/guides/before-write-access','Seven checks before an agent gets write access →'],
  ['/ru/diagnostic','/ru/guides/before-write-access','Семь проверок перед правом записи для агента →'],
  ['/ru/agent-authority-audit','/ru/guides/before-write-access','Семь проверок перед правом записи для агента →']
]) {
  const html = await readFile(fileFor(route), 'utf8');
  check(html.includes(`href="${href}"`), `${route}: P30 link href`);
  check(html.includes(label), `${route}: P30 link label`);
}

for (const note of generated.notes) {
  const source = await readFile(join(root, note.source), 'utf8');
  equal((source.match(/^###\s+/gm) || []).length, 7, `${note.source}: source h3 count`);
}

const fixture = await readFile(join(root, 'tests/fixtures/research-note.test.md'), 'utf8');
const parsed = parseFrontmatter(fixture, 'research-note.test.md');
equal(parsed.path, '/guides/test-note-local-only', 'P30.5 fixture path');
equal(parsed.card, '99 · Method · Test note — Local-only pipeline fixture.', 'P30.5 fixture card');
check(Array.isArray(parsed.schema) && parsed.schema.includes('Article') && parsed.schema.includes('BreadcrumbList'), 'P30.5 fixture schema parses from one Markdown file');

console.log(`P30_RESEARCH_LIBRARY_R1_GATE=PASS checks=${checks} notes=${generated.notes.length} locale_pairs=1 h3_each=7 cards_en=4 cards_ru=4 sitemap_lastmod=2026-10-01 llms=EN_RU research_fixture=PASS failures=0`);
