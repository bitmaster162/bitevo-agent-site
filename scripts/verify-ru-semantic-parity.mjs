import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const registry = JSON.parse(await readFile(join(root, 'src/data/public-route-registry.json'), 'utf8'));
const parity = JSON.parse(await readFile(join(root, 'src/data/ru-semantic-parity.json'), 'utf8'));
const failures = [];
let checks = 0;

const cyrillic = /[А-Яа-яЁё]/;
const enRoutes = registry.routes.filter(route => route.indexable && route.locale === 'en');
const ruRoutes = registry.routes.filter(route => route.indexable && route.locale === 'ru');
const ruMap = new Map(ruRoutes.map(route => [route.path, route]));
const parityMap = new Map(parity.pages.map(page => [`/ru/${page.slug}`, page]));

function builtFile(route) {
  if (route === '/') return join(dist, 'index.html');
  if (route === '/ru') return join(dist, 'ru', 'index.html');
  return join(dist, route.replace(/^\//, ''), 'index.html');
}

function explicitSourceFile(route) {
  if (route === '/ru') return join(root, 'src/pages/ru/index.astro');
  return join(root, `src/pages${route}.astro`);
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

checks += 2;
if (registry.schema !== 'bitevo.public-route-registry/v1') failures.push(`unexpected registry schema: ${registry.schema}`);
if (parity.schema !== 'bitevo.ru-semantic-parity/v1') failures.push(`unexpected parity schema: ${parity.schema}`);

checks += 2;
if (enRoutes.length !== ruRoutes.length) failures.push(`indexable locale count mismatch: en=${enRoutes.length} ru=${ruRoutes.length}`);
if (enRoutes.length !== 44) failures.push(`unexpected canonical EN route count: ${enRoutes.length}`);

const expectedGenerated = new Set();
for (const en of enRoutes) {
  const ruPath = en.path === '/' ? '/ru' : `/ru${en.path}`;
  const ru = ruMap.get(ruPath);
  checks += 2;
  if (!ru) {
    failures.push(`${en.path}: missing RU registry pair ${ruPath}`);
    continue;
  }
  if (ru.category !== en.category) failures.push(`${en.path} ↔ ${ruPath}: category drift ${en.category}/${ru.category}`);

  if (!(await exists(explicitSourceFile(ruPath)))) expectedGenerated.add(ruPath);

  let enHtml = '';
  let ruHtml = '';
  try {
    enHtml = await readFile(builtFile(en.path), 'utf8');
  } catch {
    failures.push(`${en.path}: missing built EN page`);
    continue;
  }
  try {
    ruHtml = await readFile(builtFile(ruPath), 'utf8');
  } catch {
    failures.push(`${ruPath}: missing built RU page`);
    continue;
  }

  const enAbsolute = `https://bitevo.work${en.path === '/' ? '/' : en.path}`;
  const ruAbsolute = `https://bitevo.work${ruPath}`;
  const pairChecks = [
    [`${ruPath}: html lang=ru`, /<html\b[^>]*\blang="ru"/i.test(ruHtml)],
    [`${ruPath}: Cyrillic body`, cyrillic.test(ruHtml)],
    [`${ruPath}: RU locale bar`, ruHtml.includes('class="ru-locale-bar"')],
    [`${ruPath}: exact canonical`, ruHtml.includes(`rel="canonical" href="${ruAbsolute}"`)],
    [`${ruPath}: EN alternate`, ruHtml.includes(`hreflang="en" href="${enAbsolute}"`)],
    [`${ruPath}: RU alternate`, ruHtml.includes(`hreflang="ru" href="${ruAbsolute}"`)],
    [`${ruPath}: x-default EN`, ruHtml.includes(`hreflang="x-default" href="${enAbsolute}"`)],
    [`${ruPath}: global RU→EN switch`, ruHtml.includes('data-global-locale-switch="ru-to-en"') && ruHtml.includes(`href="${en.path}" lang="en"`)],
    [`${en.path}: RU alternate`, enHtml.includes(`hreflang="ru" href="${ruAbsolute}"`)],
    [`${en.path}: global EN→RU switch`, enHtml.includes('data-global-locale-switch="en-to-ru"') && enHtml.includes(`href="${ruPath}" lang="ru"`)]
  ];
  checks += pairChecks.length;
  for (const [label, ok] of pairChecks) if (!ok) failures.push(label);
}

const actualGenerated = new Set(parityMap.keys());
checks += 2;
if (expectedGenerated.size !== 27) failures.push(`unexpected generated parity route count: ${expectedGenerated.size}`);
if (actualGenerated.size !== parity.pages.length) failures.push('duplicate paths in ru-semantic-parity data');

for (const path of expectedGenerated) {
  checks += 1;
  if (!actualGenerated.has(path)) failures.push(`missing generated parity data for ${path}`);
}
for (const path of actualGenerated) {
  checks += 1;
  if (!expectedGenerated.has(path)) failures.push(`parity data unexpectedly shadows explicit RU source route ${path}`);
}

for (const [ruPath, page] of parityMap) {
  checks += 8;
  if (!page.slug || !page.enPath || !page.title || !page.description || !page.primaryHref || !page.primaryLabel) failures.push(`${ruPath}: incomplete parity data`);
  if (!Array.isArray(page.points) || page.points.length < 3) failures.push(`${ruPath}: expected at least 3 semantic points`);
  if (!cyrillic.test(`${page.title} ${page.description} ${(page.points || []).join(' ')}`)) failures.push(`${ruPath}: parity data lacks Cyrillic semantic content`);

  let html = '';
  try {
    html = await readFile(builtFile(ruPath), 'utf8');
  } catch {
    failures.push(`${ruPath}: generated page missing from build`);
    continue;
  }
  if (!html.includes('RU semantic parity')) failures.push(`${ruPath}: missing semantic parity marker`);
  if (!html.includes('Semantic boundary')) failures.push(`${ruPath}: missing semantic boundary`);
  if (!html.includes('testing authorization')) failures.push(`${ruPath}: missing no-authorization claim boundary`);
  if (!html.includes(`href="${page.enPath}"`)) failures.push(`${ruPath}: missing paired EN route link`);
  if (!html.includes(`href="${page.primaryHref}"`)) failures.push(`${ruPath}: missing localized next-decision route ${page.primaryHref}`);
}

const ruHome = await readFile(builtFile('/ru'), 'utf8');
const ruStart = await readFile(builtFile('/ru/start'), 'utf8');
checks += 7;
if (!ruHome.includes('href="/ru/start"') || !ruHome.includes('Выбрать формат')) failures.push('/ru: primary commercial CTA is not /ru/start');
if (!ruHome.includes('<a class="header-cta" href="/ru/start"') || !ruHome.includes('>Начать <')) failures.push('/ru: shared header does not use RU Start');
if (!ruStart.includes('Free / 20 минут')) failures.push('/ru/start: missing Free triage marker');
if (!ruStart.includes('$1,500')) failures.push('/ru/start: missing Entry price marker');
if (!ruStart.includes('$4,900')) failures.push('/ru/start: missing Primary price marker');
if (!ruStart.includes('testing authorization')) failures.push('/ru/start: missing authorization boundary');
if (!ruStart.includes('href="/ru/pricing"')) failures.push('/ru/start: missing pricing decision path');

if (failures.length) {
  console.error(`RU_SEMANTIC_PARITY_GATE=FAIL en=${enRoutes.length} ru=${ruRoutes.length} generated=${expectedGenerated.size} checks=${checks} failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`RU_SEMANTIC_PARITY_GATE=PASS en=${enRoutes.length} ru=${ruRoutes.length} pairs=${enRoutes.length} generated=${expectedGenerated.size} explicit=${ruRoutes.length - expectedGenerated.size} checks=${checks} commercial_front_door=RU_START claim_boundary=PASS failures=0`);
