import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const origin = 'https://bitevo.work';
const registry = JSON.parse(await readFile(join(root, 'src/data/public-route-registry.json'), 'utf8'));
const parity = JSON.parse(await readFile(join(root, 'src/data/ru-semantic-parity.json'), 'utf8'));
const vercel = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
const failures = [];
let checks = 0;

const check = (value, message) => { checks += 1; if (!value) failures.push(message); };
const equal = (actual, expected, message) => { checks += 1; if (actual !== expected) failures.push(`${message}: expected=${expected} actual=${actual}`); };
const deepEqual = (actual, expected, message) => { checks += 1; try { assert.deepEqual(actual, expected); } catch { failures.push(`${message}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); } };

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else if (entry.isFile()) out.push(path);
  }
  return out;
}

function routeFromHtml(path) {
  const rel = relative(dist, path).split(sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'/index.html'.length);
  return '/' + rel;
}

function fileFor(route) {
  if (route === '/') return join(dist, 'index.html');
  if (route === '/ru') return join(dist, 'ru', 'index.html');
  return join(dist, route.replace(/^\//, ''), 'index.html');
}

function jsonLdObjects(html, route) {
  const objects = [];
  const scripts = [...html.matchAll(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      const value = JSON.parse(raw);
      const visit = item => {
        if (Array.isArray(item)) { for (const child of item) visit(child); return; }
        if (!item || typeof item !== 'object') return;
        objects.push(item);
        for (const value of Object.values(item)) {
          if (value && typeof value === 'object') visit(value);
        }
      };
      visit(value);
    } catch (error) {
      failures.push(`${route}: invalid JSON-LD: ${error.message}`);
    }
  }
  return objects;
}

function hrefs(html) {
  return [...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)].map(match => match[1]);
}

const files = await walk(dist);
const htmlFiles = files.filter(path => path.endsWith('.html'));
const htmlByRoute = new Map();
const jsonByRoute = new Map();
for (const path of htmlFiles) {
  const route = routeFromHtml(path);
  const html = await readFile(path, 'utf8');
  htmlByRoute.set(route, html);
  jsonByRoute.set(route, jsonLdObjects(html, route));
}

// Canonical Organization: exactly one typed Organization per built HTML.
for (const [route, objects] of jsonByRoute) {
  const organizations = objects.filter(item => item['@type'] === 'Organization');
  equal(organizations.length, 1, `${route}: canonical Organization node count`);
  if (organizations.length !== 1) continue;
  const org = organizations[0];
  equal(org['@id'], origin + '/#organization', `${route}: Organization @id`);
  equal(org.logo, origin + '/bitevo-logo-512.png', `${route}: Organization PNG logo`);
  deepEqual(org.sameAs, [
    'https://github.com/bitmaster162',
    'https://linkedin.com/in/robert-dumanyan-984171335',
    'https://aiskillab.work/'
  ], `${route}: Organization sameAs`);
  check(org.founder?.['@type'] === 'Person' && org.founder?.name === 'Robert Dumanyan', `${route}: Organization founder Person Robert Dumanyan`);
}

const logo = await readFile(join(root, 'public/bitevo-logo-512.png'));
check(logo.length > 24 && logo.subarray(1,4).toString('ascii') === 'PNG', 'logo: valid PNG signature');
const logoWidth = logo.readUInt32BE(16);
const logoHeight = logo.readUInt32BE(20);
check(logoWidth >= 112 && logoHeight >= 112, `logo: dimensions must be >=112px, got ${logoWidth}x${logoHeight}`);

// OfferCatalog on EN/RU pricing.
for (const route of ['/pricing','/ru/pricing']) {
  const objects = jsonByRoute.get(route) || [];
  const catalogs = objects.filter(item => item['@type'] === 'OfferCatalog');
  equal(catalogs.length, 1, `${route}: OfferCatalog count`);
  const offers = catalogs[0]?.itemListElement || [];
  equal(offers.length, 5, `${route}: OfferCatalog offer count`);
  deepEqual(offers.map(offer => Number(offer.price)).sort((a,b) => a-b), [0,1500,1500,3000,4900], `${route}: canonical offer prices`);
  for (const offer of offers) {
    check(offer?.['@type'] === 'Offer', `${route}: catalog item must be Offer`);
    check(offer?.priceCurrency === 'USD', `${route}: offer currency must be USD`);
    check(offer?.itemOffered?.['@type'] === 'Service', `${route}: itemOffered must be Service`);
    check(typeof offer?.itemOffered?.url === 'string' && offer.itemOffered.url.startsWith(origin + '/'), `${route}: Service URL must stay canonical`);
  }
}

// BreadcrumbList follows existing public registry hierarchy on requested surfaces.
const breadcrumbRoutes = registry.routes
  .filter(route => route.indexable && (
    route.path.startsWith('/build/') ||
    route.path.startsWith('/audit/') ||
    route.path.startsWith('/ru/')
  ))
  .map(route => route.path);
for (const route of breadcrumbRoutes) {
  const objects = jsonByRoute.get(route) || [];
  const breadcrumbs = objects.filter(item => item['@type'] === 'BreadcrumbList');
  equal(breadcrumbs.length, 1, `${route}: BreadcrumbList count`);
  const items = breadcrumbs[0]?.itemListElement || [];
  check(items.length >= 2, `${route}: BreadcrumbList must contain parent + current page`);
  const finalItem = items.at(-1);
  equal(finalItem?.position, items.length, `${route}: final breadcrumb position`);
  equal(finalItem?.item, origin + route, `${route}: final breadcrumb URL`);
}

// llms.txt v2 top summary + links + RU section.
const llms = await readFile(join(dist, 'llms.txt'), 'utf8');
const firstLines = llms.split(/\r?\n/).slice(0, 32).join('\n');
for (const marker of [
  'Who: BitEvo is an independent B2B engineering practice operated by Robert Dumanyan.',
  'What: BitEvo audits authority',
  'Prices: Free 20-minute triage;',
  'Timing: Free triage is 20 minutes;',
  'Contact: Robert Dumanyan — robert@bitevo.work.',
  '[Pricing](https://bitevo.work/pricing)',
  '## Кратко по-русски',
  '[Цены](https://bitevo.work/ru/pricing)'
]) check(firstLines.includes(marker), `llms.txt: missing top marker ${marker}`);

// RU generated pages are translated enough to remain indexable; internal parity service UI is absent.
const cyrillic = /[А-Яа-яЁё]/;
const generatedPages = parity.pages.filter(page => !['start','entry-audit'].includes(page.slug));
for (const page of generatedPages) {
  const route = '/ru/' + page.slug;
  const html = htmlByRoute.get(route) || '';
  check(cyrillic.test(`${page.title} ${page.description} ${(page.points || []).join(' ')}`), `${route}: translated core RU content missing`);
  check(!html.includes('Смысловое соответствие RU'), `${route}: internal semantic parity service UI must be absent`);
  check(!/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html), `${route}: translated generated RU page must remain indexable`);
  if (!cyrillic.test(page.eyebrow || '')) {
    check(/<div\b[^>]*class=["']eyebrow["'][^>]*lang=["']en["'][^>]*>/i.test(html), `${route}: English eyebrow must declare lang=en`);
  }
}

// Every indexable RU route must have at least one inbound link from another indexable RU route.
const ruRoutes = registry.routes.filter(route => route.indexable && route.locale === 'ru').map(route => route.path);
const ruSet = new Set(ruRoutes);
const incoming = new Map(ruRoutes.map(route => [route, new Set()]));
for (const source of ruRoutes) {
  const html = htmlByRoute.get(source) || '';
  for (const href of hrefs(html)) {
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;
    let target;
    try {
      const parsed = new URL(href, origin + (source === '/' ? '/' : source + '/'));
      if (parsed.origin !== origin) continue;
      target = parsed.pathname.replace(/\/+$/, '') || '/';
    } catch { continue; }
    if (ruSet.has(target) && target !== source) incoming.get(target).add(source);
  }
}
const ruOrphans = [...incoming.entries()].filter(([, sources]) => sources.size === 0).map(([route]) => route);
deepEqual(ruOrphans, [], 'RU indexable routes without incoming RU links');

// Locale switch CSS must be in Astro bundle, not an inline component style or public standalone stylesheet.
const localeComponent = await readFile(join(root, 'src/components/PairedLocaleSwitch.astro'), 'utf8');
const localeCss = await readFile(join(root, 'src/styles/locale-switch.css'), 'utf8');
check(!localeComponent.includes('<style>'), 'locale switch: component must not keep inline style block');
check(localeCss.includes('.global-locale-switch'), 'locale switch: bundled CSS source missing');
const cssFiles = files.filter(path => path.endsWith('.css'));
const builtCss = (await Promise.all(cssFiles.map(path => readFile(path, 'utf8')))).join('\n');
check(builtCss.includes('.global-locale-switch'), 'locale switch: selector missing from built CSS bundle');
for (const html of htmlByRoute.values()) check(!html.includes('/locale-switch.css'), 'locale switch: standalone CSS URL must not be emitted');

// vercel.json: HSTS, route cache rules, and permanent guide fallback.
const headerRules = Array.isArray(vercel.headers) ? vercel.headers : [];
const globalHeaders = headerRules.find(rule => rule.source === '/(.*)')?.headers || [];
const globalHeaderMap = new Map(globalHeaders.map(item => [String(item.key).toLowerCase(), String(item.value)]));
equal(globalHeaderMap.get('strict-transport-security'), 'max-age=63072000; includeSubDomains', 'vercel: global HSTS');
const routes = Array.isArray(vercel.routes) ? vercel.routes : [];
const securityRoute = routes.find(route => route.src === '/(.*)' && route.continue === true);
equal(securityRoute?.headers?.['Strict-Transport-Security'], 'max-age=63072000; includeSubDomains', 'vercel: route HSTS');
for (const source of ['/_astro/(.*)','/og-card.png','/favicon.svg','/bitevo-logo-512.png']) {
  check(routes.some(route => route.src === source && route.continue === true && route.headers?.['Cache-Control']), `vercel: cache rule must live in routes for ${source}`);
  check(!headerRules.some(rule => rule.source === source), `vercel: cache rule must not remain in headers for ${source}`);
}
check((vercel.redirects || []).some(item => item.source.startsWith('/guides/:slug') && item.destination === '/guides' && item.permanent === true), 'vercel: non-reviewed guide fallback must be permanent/308');

if (failures.length) {
  console.error(`P27_6_SEO_R1_GATE=FAIL checks=${checks} html=${htmlFiles.length} breadcrumbs=${breadcrumbRoutes.length} ru_routes=${ruRoutes.length} ru_orphans=${ruOrphans.length} failures=${failures.length}`);
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}

console.log(`P27_6_SEO_R1_GATE=PASS checks=${checks} html=${htmlFiles.length} organization_per_html=1 logo=${logoWidth}x${logoHeight} offer_catalogs=2 offers_each=5 breadcrumbs=${breadcrumbRoutes.length} llms_v2=PASS generated_ru=${generatedPages.length} ru_routes=${ruRoutes.length} ru_orphans=0 locale_css=BUNDLED hsts=INCLUDE_SUBDOMAINS guide_fallback=PERMANENT cache_rules=ROUTES failures=0`);
