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

const routeByPath = new Map(registry.routes.map(route => [route.path, route]));
for (const [route, parent, locale] of [
  ['/build/renewal-expansion-gate', '/build/measured-value-gate', 'en'],
  ['/ru/build/renewal-expansion-gate', '/ru/build/measured-value-gate', 'ru']
]) {
  const item = routeByPath.get(route);
  if (!item || item.category !== 'TOOL' || item.indexable !== true || item.locale !== locale || item.parent !== parent) failures.push(`${route}: build renewal-expansion taxonomy drift`);
  const html = await readHtml(route);
  if (!html.includes('RENEWAL / EXPANSION READINESS') || !html.includes('NO RETAINED REVENUE CLAIM') || !html.includes('NO NRR CLAIM')) failures.push(`${route}: build renewal-expansion boundary marker missing`);
}
for (const [route, parent, locale] of [
  ['/build/measured-value-gate', '/build/paid-start-gate', 'en'],
  ['/ru/build/measured-value-gate', '/ru/build/paid-start-gate', 'ru']
]) {
  const item = routeByPath.get(route);
  if (!item || item.category !== 'TOOL' || item.indexable !== true || item.locale !== locale || item.parent !== parent) failures.push(`${route}: build measured-value taxonomy drift`);
  const html = await readHtml(route);
  if (!html.includes('MEASURED VALUE READINESS') || !html.includes('NO ROI CLAIM') || !html.includes('NO MEASURED VALUE CLAIM') || !html.includes('SYNTHETIC EXAMPLE IS NOT CUSTOMER EVIDENCE')) failures.push(`${route}: build measured-value boundary marker missing`);
}
for (const [route, parent, locale] of [
  ['/audit/proposal-readiness', '/audit-intake', 'en'],
  ['/ru/audit/proposal-readiness', '/ru/audit-intake', 'ru']
]) {
  const item = routeByPath.get(route);
  if (!item || item.category !== 'TOOL' || item.indexable !== true || item.locale !== locale || item.parent !== parent) failures.push(`${route}: audit proposal-readiness taxonomy drift`);
  const html = await readHtml(route);
  if (!html.includes('PROPOSAL READINESS') || !html.includes('NO PROPOSAL ISSUED')) failures.push(`${route}: readiness boundary marker missing`);
}
for (const [route, parent, locale] of [
  ['/audit/paid-start-gate', '/audit/proposal-readiness', 'en'],
  ['/ru/audit/paid-start-gate', '/ru/audit/proposal-readiness', 'ru']
]) {
  const item = routeByPath.get(route);
  if (!item || item.category !== 'TOOL' || item.indexable !== true || item.locale !== locale || item.parent !== parent) failures.push(`${route}: audit paid-start taxonomy drift`);
  const html = await readHtml(route);
  if (!html.includes('PAID START GATE') || !html.includes('NO PAYMENT PROCESSING') || !html.includes('NO DELIVERY START')) failures.push(`${route}: paid-start boundary marker missing`);
}
for (const [route, parent, locale] of [
  ['/audit/measured-value-gate', '/audit/paid-start-gate', 'en'],
  ['/ru/audit/measured-value-gate', '/ru/audit/paid-start-gate', 'ru']
]) {
  const item = routeByPath.get(route);
  if (!item || item.category !== 'TOOL' || item.indexable !== true || item.locale !== locale || item.parent !== parent) failures.push(`${route}: audit measured-value taxonomy drift`);
  const html = await readHtml(route);
  if (!html.includes('MEASURED VALUE READINESS') || !html.includes('NO ROI CLAIM') || !html.includes('NO MEASURED VALUE CLAIM')) failures.push(`${route}: measured-value boundary marker missing`);
}
for (const [route, parent, locale] of [
  ['/audit/renewal-expansion-gate', '/audit/measured-value-gate', 'en'],
  ['/ru/audit/renewal-expansion-gate', '/ru/audit/measured-value-gate', 'ru']
]) {
  const item = routeByPath.get(route);
  if (!item || item.category !== 'TOOL' || item.indexable !== true || item.locale !== locale || item.parent !== parent) failures.push(`${route}: audit renewal-expansion taxonomy drift`);
  const html = await readHtml(route);
  if (!html.includes('RENEWAL / EXPANSION READINESS') || !html.includes('NO RETAINED REVENUE CLAIM') || !html.includes('NO NRR CLAIM')) failures.push(`${route}: renewal-expansion boundary marker missing`);
}

const pricing = await readHtml('/pricing');
for (const marker of ['Scope / Authority Triage', 'Entry Audit', 'Agent Authority &amp; Evidence Audit']) {
  if (!pricing.includes(marker)) failures.push(`/pricing missing canonical ladder marker: ${marker}`);
}
for (const marker of ['Free', '$1,500', '$4,900']) {
  if (!pricing.includes(marker)) failures.push(`/pricing missing canonical price marker: ${marker}`);
}

const ruIndexable = registry.routes.filter(route => route.indexable && route.locale === 'ru').length;
if (ruIndexable !== englishIndexable.length) failures.push(`RU registry parity drift: expected ${englishIndexable.length} indexable routes, found ${ruIndexable}`);

if (failures.length) {
  console.error(`ROUTE_TAXONOMY_GATE=FAIL registry=${registry.routes.length} indexable=${expectedIndexable.length} sitemap=${sitemapRoutes.length} english=${englishIndexable.length} ru=${ruIndexable} failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`ROUTE_TAXONOMY_GATE=PASS registry=${registry.routes.length} indexable=${expectedIndexable.length} sitemap=${sitemapRoutes.length} english=${englishIndexable.length} ru=${ruIndexable} legacy=${legacy.length} hierarchy=PASS specialist_parent=PASS build_measured_value_gate=PASS build_renewal_expansion_gate=PASS audit_proposal_readiness=PASS audit_paid_start_gate=PASS audit_measured_value_gate=PASS audit_renewal_expansion_gate=PASS assurance_transition=PASS pricing_ladder=PASS failures=0`);
