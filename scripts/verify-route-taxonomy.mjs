import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const registry = JSON.parse(await readFile(join(root, 'src/data/public-route-registry.json'), 'utf8'));
const vercel = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
const failures = [];

const allowed = new Set(['FLAGSHIP', 'ENTRY', 'SPECIALIST', 'TOOL', 'PROOF', 'RESEARCH', 'CONTEXT', 'LEGACY', 'INTERNAL_NO_INDEX']);
if (registry.schema !== 'bitevo.public-route-registry/v1') failures.push(`unexpected registry schema: ${registry.schema}`);

const seen = new Set();
for (const route of registry.routes) {
  if (seen.has(route.path)) failures.push(`duplicate route: ${route.path}`);
  seen.add(route.path);
  if (!allowed.has(route.category)) failures.push(`${route.path}: invalid category ${route.category}`);
  if (route.indexable && ['LEGACY', 'INTERNAL_NO_INDEX'].includes(route.category)) failures.push(`${route.path}: legacy/internal route cannot be indexable`);
}

const expectedIndexable = registry.routes.filter(route => route.indexable).map(route => route.path);
const expectedSet = new Set(expectedIndexable);
const sitemap = await readFile(join(dist, 'sitemap.xml'), 'utf8');
const sitemapRoutes = [...sitemap.matchAll(/<loc>https:\/\/bitevo\.work([^<]+)<\/loc>/g)].map(match => match[1]);
const sitemapSet = new Set(sitemapRoutes);
for (const route of expectedSet) if (!sitemapSet.has(route)) failures.push(`sitemap missing indexable route ${route}`);
for (const route of sitemapSet) if (!expectedSet.has(route)) failures.push(`sitemap includes non-indexable/unregistered route ${route}`);
if (sitemapRoutes.length !== sitemapSet.size) failures.push('sitemap contains duplicate routes');

const legacy = registry.routes.filter(route => !route.indexable).map(route => route.path);
for (const route of legacy) if (sitemapSet.has(route)) failures.push(`legacy/internal route leaked into sitemap: ${route}`);

const llms = await readFile(join(dist, 'llms.txt'), 'utf8');
for (const heading of ['## Current route hierarchy', '### Commercial / flagship', '### Specialist scopes', '### Browser-local tools', '### Proof / trust', '### Research', '### Context']) {
  if (!llms.includes(heading)) failures.push(`llms missing heading: ${heading}`);
}
const englishIndexable = registry.routes.filter(route => route.indexable && route.locale === 'en');
for (const route of englishIndexable) {
  const escaped = route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const line = new RegExp(`^- ${escaped}(?:\\s|$)`, 'm');
  if (!line.test(llms)) failures.push(`llms hierarchy missing ${route.path}`);
}
if (!/^- \/start — commercial front door$/m.test(llms)) failures.push('llms does not identify /start as commercial front door');
if (/^- \/assurance(?:\s|$)/m.test(llms)) failures.push('llms still presents /assurance as current route');

const readHtml = route => readFile(join(dist, route.replace(/^\//, ''), 'index.html'), 'utf8');
const assurance = await readHtml('/assurance');
if (!/<meta name="robots" content="noindex, follow" data-route-taxonomy="LEGACY">/.test(assurance)) failures.push('/assurance missing transition noindex');
if (!assurance.includes('data-legacy-route-note')) failures.push('/assurance missing legacy transition note');

for (const route of ['/control-validation', '/evidence-readiness']) {
  const html = await readHtml(route);
  if (html.includes('href="/assurance"')) failures.push(`${route}: specialist parent still points to /assurance`);
  if (!html.includes('href="/start"')) failures.push(`${route}: missing /start parent path`);
}
const aiAudit = await readHtml('/ai-audit');
if (aiAudit.includes('href="/assurance"') || aiAudit.includes('<strong>/assurance</strong>')) failures.push('/ai-audit still chains to /assurance');
if (!aiAudit.includes('href="/start"')) failures.push('/ai-audit missing current /start path');

const intakeRedirect = (vercel.redirects || []).find(item => item.source === '/intake');
if (!intakeRedirect || intakeRedirect.destination !== '/audit-intake' || intakeRedirect.permanent !== true) failures.push('vercel missing permanent /intake -> /audit-intake redirect');

const pricing = await readHtml('/pricing');
for (const marker of ['Scope / Authority Triage', 'Entry Audit', 'Agent Authority &amp; Evidence Audit']) {
  if (!pricing.includes(marker)) failures.push(`/pricing missing canonical ladder marker: ${marker}`);
}
for (const marker of ['Free', '$1,500', '$4,900']) {
  if (!pricing.includes(marker)) failures.push(`/pricing missing canonical price marker: ${marker}`);
}

const ruIndexable = registry.routes.filter(route => route.indexable && route.locale === 'ru').length;
if (ruIndexable !== 17) failures.push(`RU registry scope drift: expected 17 indexable routes, found ${ruIndexable}`);

if (failures.length) {
  console.error(`ROUTE_TAXONOMY_GATE=FAIL registry=${registry.routes.length} indexable=${expectedIndexable.length} sitemap=${sitemapRoutes.length} english=${englishIndexable.length} ru=${ruIndexable} failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`ROUTE_TAXONOMY_GATE=PASS registry=${registry.routes.length} indexable=${expectedIndexable.length} sitemap=${sitemapRoutes.length} english=${englishIndexable.length} ru=${ruIndexable} legacy=${legacy.length} hierarchy=PASS specialist_parent=PASS assurance_transition=PASS pricing_ladder=PASS failures=0`);
