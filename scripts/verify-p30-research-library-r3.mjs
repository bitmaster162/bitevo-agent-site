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
const worker = await readFile(join(root, 'worker/index.mjs'), 'utf8');
let checks = 0;
const check = (value, message) => { checks += 1; assert.ok(value, message); };
const equal = (actual, expected, message) => { checks += 1; assert.equal(actual, expected, message); };

const expectedMeta = new Map([
  ['/guides/before-write-access', { reviewed: '2026-10-01', nextReview: '2027-01-01', h3: 7, card: '04' }],
  ['/ru/guides/before-write-access', { reviewed: '2026-10-01', nextReview: '2027-01-01', h3: 7, card: '04' }],
  ['/guides/mcp-server-authority-review', { reviewed: '2026-10-06', nextReview: '2027-01-06', h3: 20, card: '05' }],
  ['/ru/guides/mcp-server-authority-review', { reviewed: '2026-10-06', nextReview: '2027-01-06', h3: 20, card: '05' }],
  ['/guides/bitget-authority-after-orchestration-compromise', { reviewed: '2026-10-07', nextReview: '2027-01-07', h3: 4, card: '06' }],
  ['/ru/guides/bitget-authority-after-orchestration-compromise', { reviewed: '2026-10-07', nextReview: '2027-01-07', h3: 4, card: '06' }]
]);
const expected = [...expectedMeta.keys()];
const serverNames = [
  'GitHub MCP Server','GitLab MCP Server','Microsoft Playwright MCP','Cloudflare MCP','Sentry MCP','Grafana MCP','Neon MCP','Supabase MCP','MongoDB MCP Server','Redis MCP Server','Kubernetes MCP Server','Terraform MCP Server','Azure MCP Server 2.0','ClickHouse MCP Server','Postgres MCP Pro','Notion MCP Server (self-hosted)','MCP Filesystem reference server','MCP Git reference server','MCP Memory reference server','AWS API MCP Server (awslabs)'
];

equal(generated.schema, 'bitevo.research-notes/v1', 'generated schema');
equal(generated.notes.length, expected.length, 'published research note locale count');
for (const path of expected) check(generated.notes.some(note => note.path === path), `generated note missing ${path}`);

for (const note of generated.notes) {
  const meta = expectedMeta.get(note.path);
  check(meta, `${note.path}: expected metadata`);
  equal(note.reviewed, meta.reviewed, `${note.path}: reviewed`);
  equal(note.next_review, meta.nextReview, `${note.path}: next review`);
  equal(note.card_number, meta.card, `${note.path}: card number`);
  const partner = generated.notes.find(item => item.path === note.alternate);
  check(partner, `${note.path}: alternate exists`);
  equal(partner.alternate, note.path, `${note.path}: alternate reciprocal`);
  check(partner.lang !== note.lang, `${note.path}: alternate locale differs`);
  equal(partner.slug, note.slug, `${note.path}: alternate slug`);

  const route = registry.routes.find(item => item.path === note.path);
  check(route, `${note.path}: registry route`);
  equal(route.category, 'RESEARCH', `${note.path}: registry category`);
  equal(route.indexable, true, `${note.path}: registry indexable`);
  equal(route.generatedBy, 'research-notes', `${note.path}: generated marker`);
  equal(route.reviewed, note.reviewed, `${note.path}: reviewed binding`);
}

for (const lang of ['en','ru']) {
  const localeNotes = generated.notes.filter(note => note.lang === lang);
  equal(new Set(localeNotes.map(note => note.card_number)).size, localeNotes.length, `${lang}: unique research card numbers`);
  equal(new Set(localeNotes.map(note => note.path)).size, localeNotes.length, `${lang}: unique research paths`);
}

const ruLegacy = generated.notes.find(note => note.path === '/ru/guides/before-write-access');
equal(ruLegacy.description, 'Семь вопросов, на которые нужно ответить доказательствами, прежде чем AI-агент сможет менять записи в CRM, тикеты, платежи, код или данные, — с публичным случаем для каждого.', 'RU legacy description exact from attached P30 frontmatter');
equal(ruLegacy.description.length, 174, 'RU canonical description length remains an explicit P30 source exception');

const fallback = (vercel.redirects || []).find(item => String(item.source || '').startsWith('/guides/:slug'));
check(fallback, 'Vercel guide fallback exists');
for (const slug of generated.notes.filter(note => note.lang === 'en').map(note => note.slug)) check(fallback.source.includes(slug), `Vercel guide fallback allowlists ${slug}`);
equal(fallback.destination, '/guides', 'Vercel guide fallback destination');
equal(fallback.permanent, true, 'Vercel guide fallback permanent');
for (const note of generated.notes.filter(note => note.lang === 'en')) check(worker.includes(`'${note.path}'`), `${note.path}: Cloudflare worker canonical guide allowlist`);
check(worker.includes("Response.redirect(new URL('/guides', url), 302)"), 'Cloudflare unknown-guide fallback remains 302 /guides');

function fileFor(route) { return join(dist, route.replace(/^\//, ''), 'index.html'); }
function jsonLd(html) {
  return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap(match => { const value = JSON.parse(match[1]); return Array.isArray(value) ? value : [value]; });
}

for (const note of generated.notes) {
  const meta = expectedMeta.get(note.path);
  const html = await readFile(fileFor(note.path), 'utf8');
  equal((html.match(/<h3\b/g) || []).length, meta.h3, `${note.path}: expected h3 count`);
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
  check(objects.some(item => item['@type'] === 'Article' && item.headline === note.title && item.dateModified === note.reviewed), `${note.path}: Article JSON-LD`);
  check(objects.some(item => item['@type'] === 'BreadcrumbList'), `${note.path}: BreadcrumbList JSON-LD`);
  for (const anchor of html.matchAll(/<a\b[^>]*href=["']https?:\/\/[^"']+["'][^>]*>/gi)) check(/\brel=["'][^"']*\bnoopener\b[^"']*["']/i.test(anchor[0]), `${note.path}: external link missing rel=noopener`);
}

const enIndex = await readFile(fileFor('/guides'), 'utf8');
const ruIndex = await readFile(fileFor('/ru/guides'), 'utf8');
for (const href of ['/guides/security-sandboxing','/guides/fleet-coordinator-drift-monitoring','/guides/d3-tool-io-bridge-contract', ...generated.notes.filter(note => note.lang === 'en').map(note => note.path)]) check(enIndex.includes(`href="${href}"`), `/guides card missing ${href}`);
for (const href of ['/ru/guides/security-sandboxing','/ru/guides/fleet-coordinator-drift-monitoring','/ru/guides/d3-tool-io-bridge-contract', ...generated.notes.filter(note => note.lang === 'ru').map(note => note.path)]) check(ruIndex.includes(`href="${href}"`), `/ru/guides card missing ${href}`);
for (const phrase of ['RU · PUBLIC PRODUCT LAYER','reviewed note','isolation boundaries','Research ≠ customer proof','Reviewed public research','PUBLICATION POLICY','Legacy archive','Historical notes']) check(!ruIndex.includes(phrase), `/ru/guides forbidden mixed-language phrase: ${phrase}`);
for (const phrase of ['Изоляция и ограниченный запуск инструментов','Мониторинг дрейфа координатора','Контракт ввода-вывода инструментов','Проверенные публичные заметки']) check(ruIndex.includes(phrase), `/ru/guides required Russian phrase missing: ${phrase}`);

const sitemap = await readFile(join(dist, 'sitemap.xml'), 'utf8');
for (const note of generated.notes) check(sitemap.includes(`<loc>https://bitevo.work${note.path}</loc><lastmod>${note.reviewed}</lastmod>`), `sitemap currentness missing ${note.path}`);

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
  equal((source.match(/^###\s+/gm) || []).length, expectedMeta.get(note.path).h3, `${note.source}: source h3 count`);
  if (note.slug === 'mcp-server-authority-review') {
    for (const [index,name] of serverNames.entries()) check(source.includes(`### ${index + 1}. ${name}`), `${note.path}: missing server entry ${index + 1} ${name}`);
    check(/not a penetration test|не penetration test/.test(source), `${note.path}: publication boundary`);
  }
  if (note.slug === 'bitget-authority-after-orchestration-compromise') {
    check(source.includes('18:31') && source.includes('19:05'), `${note.path}: distinct incident timing milestones`);
    check(source.includes('Mandiant') && source.includes('SlowMist'), `${note.path}: direct forensic report attribution`);
    check(source.includes('SigningPubKey') && source.includes('LastLedgerSequence'), `${note.path}: XRPL evidence boundary fields`);
    check(/signing time|время подписания|timestamps подписания/i.test(source), `${note.path}: ledger/signing-time boundary`);
    if (note.lang === 'en') {
      check(source.includes('does not establish insider involvement'), `${note.path}: no insider claim boundary`);
      check(source.includes('solvency'), `${note.path}: solvency boundary explicit`);
      check(source.includes('MPC/TSS failure'), `${note.path}: MPC/TSS boundary explicit`);
      check(source.includes('kill-switch failure'), `${note.path}: kill-switch boundary explicit`);
      check(source.includes('not market analysis'), `${note.path}: no market framing boundary`);
    } else {
      check(source.includes('не устанавливает участие инсайдера'), `${note.path}: no insider claim boundary`);
      check(source.includes('платёжеспособности'), `${note.path}: solvency boundary explicit`);
      check(source.includes('failure MPC/TSS'), `${note.path}: MPC/TSS boundary explicit`);
      check(source.includes('failure kill switch'), `${note.path}: kill-switch boundary explicit`);
      check(source.includes('не анализ рынка'), `${note.path}: no market framing boundary`);
    }
  }
}

const fixture = await readFile(join(root, 'tests/fixtures/research-note.test.md'), 'utf8');
const parsed = parseFrontmatter(fixture, 'research-note.test.md');
equal(parsed.path, '/guides/test-note-local-only', 'P30.5 fixture path');
equal(parsed.card, '99 · Method · Test note — Local-only pipeline fixture.', 'P30.5 fixture card');
check(Array.isArray(parsed.schema) && parsed.schema.includes('Article') && parsed.schema.includes('BreadcrumbList'), 'P30.5 fixture schema parses from one Markdown file');

console.log(`P30_RESEARCH_LIBRARY_R3_GATE=PASS checks=${checks} notes=${generated.notes.length} locale_pairs=${generated.notes.length / 2} cards_en=${generated.notes.filter(note => note.lang === 'en').length + 3} cards_ru=${generated.notes.filter(note => note.lang === 'ru').length + 3} cloudflare_generated_en=BOUND llms=EN_RU research_fixture=PASS failures=0`);
