import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const siteOrigin = 'https://bitevo.work';
const registry = JSON.parse(await readFile(`${root}/src/data/public-route-registry.json`, 'utf8'));
const routes = registry.routes
  .filter(route => route.indexable && route.locale === 'en')
  .map(route => [route.path === '/' ? '/ru' : `/ru${route.path}`, route.path]);
const navRequired = ['/ru/start','/ru/doctrine','/ru/proof','/ru/mapper','/ru/workspace','/ru/diagnostic','/ru/agent-authority-audit','/ru/audit-intake','/ru/pricing','/ru/build','/ru/universe'];
const requiredCyrillic = /[А-Яа-яЁё]/;
const gateLocalizationRoutes = new Set([
  '/ru/audit/measured-value-gate',
  '/ru/audit/paid-start-gate',
  '/ru/audit/proposal-readiness',
  '/ru/audit/renewal-expansion-gate',
  '/ru/build/measured-value-gate',
  '/ru/build/renewal-expansion-gate'
]);
const failures = [];
let checks = 0;

function visibleLetterShare(html) {
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
  const text = body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ');
  const cyr = (text.match(/[А-Яа-яЁё]/g) || []).length;
  const lat = (text.match(/[A-Za-z]/g) || []).length;
  return { cyr, lat, share: cyr + lat ? cyr / (cyr + lat) : 0 };
}

function textOfFirst(html, tag) {
  const raw = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] || '';
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function metaDescription(html) {
  return html.match(/<meta\b[^>]*\bname=["']description["'][^>]*\bcontent=(["'])(.*?)\1[^>]*>/i)?.[2]
    || html.match(/<meta\b[^>]*\bcontent=(["'])(.*?)\1[^>]*\bname=["']description["'][^>]*>/i)?.[2]
    || '';
}

function fileFor(route) {
  return route === '/' ? `${dist}/index.html` : route === '/ru' ? `${dist}/ru/index.html` : `${dist}${route}/index.html`;
}

function mainContent(html) {
  const start = html.indexOf('<main');
  const end = html.indexOf('</main>');
  if (start < 0 || end < 0 || end <= start) return html;
  return html.slice(start, end + 7);
}

for (const [route, enRoute] of routes) {
  let html = '';
  try {
    html = await readFile(fileFor(route), 'utf8');
  } catch {
    failures.push(`${route}: missing built Russian page`);
    continue;
  }

  const expectedCanonical = `${siteOrigin}${route}`;
  const expectedEn = `${siteOrigin}${enRoute === '/' ? '/' : enRoute}`;
  const expectedRu = `${siteOrigin}${route}`;
  const assertions = [
    ['html lang=ru', /<html\b[^>]*\blang=["']ru["']/i.test(html)],
    ['Cyrillic content', requiredCyrillic.test(html)],
    ['locale surface marker', html.includes('data-locale-surface="ru"')],
    ['RU status bar retained', html.includes('class="ru-locale-bar"')],
    ['canonical global RU→EN switch', html.includes('data-global-locale-switch="ru-to-en"') && html.includes(`href="${enRoute}" lang="en"`)],
    ['exact canonical', html.includes(`rel="canonical" href="${expectedCanonical}"`)],
    ['ru_RU OpenGraph locale', html.includes('property="og:locale" content="ru_RU"')],
    ['English alternate', html.includes(`hreflang="en" href="${expectedEn}"`)],
    ['Russian alternate', html.includes(`hreflang="ru" href="${expectedRu}"`)],
    ['x-default alternate', html.includes(`hreflang="x-default" href="${expectedEn}"`)],
    ['visible build receipt', html.includes('data-public-build-receipt=')],
    ['build SHA meta receipt', html.includes('name="bitevo-build-sha"')]
  ];
  checks += assertions.length;
  for (const [label, ok] of assertions) if (!ok) failures.push(`${route}: ${label} failed`);

  const letterShare = visibleLetterShare(html);
  checks += 1;
  if (!(letterShare.share > 0.33)) failures.push(`${route}: Cyrillic share ${(letterShare.share * 100).toFixed(2)}% must be >33% (cyr=${letterShare.cyr}, lat=${letterShare.lat})`);

  if (gateLocalizationRoutes.has(route)) {
    const titleText = textOfFirst(html, 'title');
    const h1Text = textOfFirst(html, 'h1');
    const descriptionText = metaDescription(html);
    checks += 3;
    if (!requiredCyrillic.test(titleText)) failures.push(`${route}: gate title is not localized`);
    if (!requiredCyrillic.test(h1Text)) failures.push(`${route}: gate H1 is not localized`);
    if (!requiredCyrillic.test(descriptionText)) failures.push(`${route}: gate description is not localized`);
  }

  const enHtml = await readFile(fileFor(enRoute), 'utf8');
  const reciprocal = [
    ['English page has en alternate', enHtml.includes(`hreflang="en" href="${expectedEn}"`)],
    ['English page has ru alternate', enHtml.includes(`hreflang="ru" href="${expectedRu}"`)],
    ['English page has x-default', enHtml.includes(`hreflang="x-default" href="${expectedEn}"`)],
    ['English page has canonical global EN→RU switch', enHtml.includes('data-global-locale-switch="en-to-ru"') && enHtml.includes(`href="${route}" lang="ru"`)]
  ];
  checks += reciprocal.length;
  for (const [label, ok] of reciprocal) if (!ok) failures.push(`${enRoute}: ${label} failed for ${route}`);
}

const ruHome = await readFile(`${dist}/ru/index.html`, 'utf8');
for (const path of navRequired) {
  checks += 1;
  if (!ruHome.includes(`href="${path}"`)) failures.push(`/ru: missing Russian core navigation/decision link ${path}`);
}

const chromeContracts = [
  ['RU brand home', /<a[^>]+href="\/ru"[^>]+class="brand"|<a[^>]+class="brand"[^>]+href="\/ru"/.test(ruHome)],
  ['RU header CTA', ruHome.includes('href="/ru/start"') && ruHome.includes('Начать')],
  ['RU home primary decision CTA', ruHome.includes('href="/ru/start"') && ruHome.includes('Выбрать формат')],
  ['RU canonical header language switch', ruHome.includes('data-global-locale-switch="ru-to-en"') && ruHome.includes('href="/" lang="en"')],
  ['RU primary navigation label', ruHome.includes('aria-label="Основная навигация"')],
  ['RU mobile navigation label', ruHome.includes('aria-label="Мобильная навигация"')],
  ['RU services footer path', ruHome.includes('href="/ru/consulting"')],
  ['RU research footer path', ruHome.includes('href="/ru/guides"')],
  ['RU Universe footer path', ruHome.includes('href="/ru/universe"')],
  ['RU footer decision line', ruHome.includes('Полномочия должны быть обоснованы доказательствами.')],
  ['No English header CTA on RU', !ruHome.includes('>Map workflow <') && !ruHome.includes('>Map workflow →<')]
];
checks += chromeContracts.length;
for (const [label, ok] of chromeContracts) if (!ok) failures.push(`/ru chrome: ${label} failed`);

const ruMapperHtml = await readFile(`${dist}/ru/mapper/index.html`, 'utf8');
const ruWorkspaceHtml = await readFile(`${dist}/ru/workspace/index.html`, 'utf8');
const ruMapperSource = await readFile(`${root}/src/pages/ru/mapper.astro`, 'utf8');
const ruWorkspaceSource = await readFile(`${root}/src/pages/ru/workspace.astro`, 'utf8');
const ruLayoutSource = await readFile(`${root}/src/layouts/RuLayout.astro`, 'utf8');
const ruDiagnostic = await readFile(`${dist}/ru/diagnostic/index.html`, 'utf8');
const ruIntake = await readFile(`${dist}/ru/audit-intake/index.html`, 'utf8');
const ruBuildBaseline = await readFile(`${dist}/ru/build/workflow-baseline-worksheet/index.html`, 'utf8');
const ruPricing = mainContent(await readFile(`${dist}/ru/pricing/index.html`, 'utf8'));
const ruAudit = mainContent(await readFile(`${dist}/ru/agent-authority-audit/index.html`, 'utf8'));
const ruEntryAudit = mainContent(await readFile(`${dist}/ru/entry-audit/index.html`, 'utf8'));
const ruControlValidation = mainContent(await readFile(`${dist}/ru/control-validation/index.html`, 'utf8'));

checks += 1;
if (ruLayoutSource.includes('class="locale-switch"')) failures.push('/src/layouts/RuLayout.astro: legacy RU locale-switch anchor remains');

const toolContracts = [
  ['/ru/mapper', ruMapperHtml.includes('id="ruMapper"') && ruMapperSource.includes("schema:'bitevo.authority-map.v2'") && ruMapperSource.includes("sessionStorage.setItem('bitevo.mapper.workspace.v1'") && ruMapperSource.includes("sessionStorage.setItem('bitevo.mapper.handoff.v1'") && ruMapperSource.includes("location.href='/ru/workspace?from=mapper'") && ruMapperSource.includes("location.href='/ru/audit-intake?from=mapper'")],
  ['/ru/workspace', ruWorkspaceHtml.includes('Decision Workspace') && ruWorkspaceSource.includes("STORAGE_KEY='bitevo.workspace.maps.v1'") && ruWorkspaceSource.includes("'RETEST_CANDIDATE'") && ruWorkspaceSource.includes("'SCOPE_DRIFT'") && ruWorkspaceSource.includes("'CROSS_WORKFLOW'") && ruWorkspaceSource.includes("schema:'bitevo.decision-memo.local.v2'") && ruWorkspaceSource.includes('testing_authorization:false')],
  ['/ru/mapper→intake handoff', ruLayoutSource.includes("sessionStorage.getItem('bitevo.mapper.handoff.v1')") && ruLayoutSource.includes("location.pathname !== '/ru/audit-intake'")],
  ['/ru/diagnostic', ruDiagnostic.includes('id="ruDiagnostic"') && ruDiagnostic.includes('Testing authorization: NOT GRANTED')],
  ['/ru/audit-intake', ruIntake.includes('id="ruIntake"') && ruIntake.includes('Testing authorization: NOT GRANTED') && ruIntake.includes('Download .txt')],
  ['/ru/build/workflow-baseline-worksheet', ruBuildBaseline.includes('data-build-baseline-worksheet') && ruBuildBaseline.includes('data-network-write="none"') && ruBuildBaseline.includes('data-storage-write="none"') && ruBuildBaseline.includes('Testing authorization: NOT GRANTED')],
  ['/ru/pricing', ruPricing.includes('href="/ru/audit-intake"') && ruPricing.includes('href="/ru/audit-intake?offer=entry-audit"') && ruPricing.includes('href="/ru/audit-intake?offer=primary-agent-authority-audit"') && !ruPricing.includes('href="/audit-intake')],
  ['/ru/agent-authority-audit', ruAudit.includes('href="/ru/audit-intake?offer=primary-agent-authority-audit"') && !ruAudit.includes('href="/audit-intake')],
  ['/ru/entry-audit', ruEntryAudit.includes('href="/ru/audit-intake?offer=entry-audit"')],
  ['/ru/control-validation', ruControlValidation.includes('href="/ru/audit-intake?offer=security-control-validation"')]
];
checks += toolContracts.length;
for (const [route, ok] of toolContracts) if (!ok) failures.push(`${route}: localized functional/commercial boundary contract failed`);

const enHome = await readFile(`${dist}/index.html`, 'utf8');
checks += 5;
if (!enHome.includes('href="/ru" lang="ru"')) failures.push('/: missing visible RU entry point');
if (!enHome.includes('data-global-locale-switch="en-to-ru"')) failures.push('/: missing canonical global EN→RU switch');
if (!enHome.includes('name="bitevo-build-sha"')) failures.push('/: missing build SHA meta receipt');
if (!/<a class="header-cta" href="\/start"[^>]*>Start here/.test(enHome)) failures.push('/: English shared chrome must use /start as commercial front door');
if (!enHome.includes('href="/mapper"')) failures.push('/: English shared chrome/content must preserve a visible Mapper path');

if (failures.length) {
  console.error(`RU_SURFACE_GATE=FAIL routes=${routes.length} checks=${checks} failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`RU_SURFACE_GATE=PASS routes=${routes.length} checks=${checks} reciprocal_pairs=${routes.length} global_locale_switches=EN_RU_CANONICAL ru_status_bars=RETAINED shared_chrome=RU_START functional_tools=5 mapper_workspace_schema=PASS commercial_routes=3 failures=0`);
