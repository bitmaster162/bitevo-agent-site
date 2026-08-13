import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const siteOrigin = 'https://bitevoagentsite.vercel.app';
const routes = [
  ['/ru', '/'],
  ['/ru/doctrine', '/doctrine'],
  ['/ru/artifacts', '/artifacts'],
  ['/ru/proof', '/proof'],
  ['/ru/dogfood-self-audit', '/dogfood-self-audit'],
  ['/ru/diagnostic', '/diagnostic'],
  ['/ru/agent-authority-audit', '/agent-authority-audit'],
  ['/ru/audit-intake', '/audit-intake'],
  ['/ru/pricing', '/pricing'],
  ['/ru/consulting', '/consulting'],
  ['/ru/continuityos', '/continuityos'],
  ['/ru/guides', '/guides'],
  ['/ru/build', '/build'],
  ['/ru/universe', '/universe']
];
const navRequired = ['/ru/doctrine','/ru/proof','/ru/diagnostic','/ru/agent-authority-audit','/ru/audit-intake','/ru/pricing','/ru/build','/ru/universe'];
const requiredCyrillic = /[А-Яа-яЁё]/;
const failures = [];
let checks = 0;

function fileFor(route) {
  return route === '/' ? `${dist}/index.html` : route === '/ru' ? `${dist}/ru/index.html` : `${dist}${route}/index.html`;
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

  const enHtml = await readFile(fileFor(enRoute), 'utf8');
  const reciprocal = [
    ['English page has en alternate', enHtml.includes(`hreflang="en" href="${expectedEn}"`)],
    ['English page has ru alternate', enHtml.includes(`hreflang="ru" href="${expectedRu}"`)],
    ['English page has x-default', enHtml.includes(`hreflang="x-default" href="${expectedEn}"`)]
  ];
  checks += reciprocal.length;
  for (const [label, ok] of reciprocal) if (!ok) failures.push(`${enRoute}: ${label} failed for ${route}`);
}

const ruHome = await readFile(`${dist}/ru/index.html`, 'utf8');
for (const path of navRequired) {
  checks += 1;
  if (!ruHome.includes(`href="${path}"`)) failures.push(`/ru: missing Russian core navigation link ${path}`);
}

const ruDiagnostic = await readFile(`${dist}/ru/diagnostic/index.html`, 'utf8');
const ruIntake = await readFile(`${dist}/ru/audit-intake/index.html`, 'utf8');
const ruPricing = await readFile(`${dist}/ru/pricing/index.html`, 'utf8');
const ruAudit = await readFile(`${dist}/ru/agent-authority-audit/index.html`, 'utf8');
const toolContracts = [
  ['/ru/diagnostic', ruDiagnostic.includes('id="ruDiagnostic"') && ruDiagnostic.includes('Testing authorization: NOT GRANTED')],
  ['/ru/audit-intake', ruIntake.includes('id="ruIntake"') && ruIntake.includes('Testing authorization: NOT GRANTED') && ruIntake.includes('Download .txt')],
  ['/ru/pricing', (ruPricing.match(/href="\/ru\/audit-intake"/g) || []).length >= 3 && !ruPricing.includes('href="/audit-intake"')],
  ['/ru/agent-authority-audit', ruAudit.includes('href="/ru/audit-intake"') && !ruAudit.includes('href="/audit-intake"')]
];
checks += toolContracts.length;
for (const [route, ok] of toolContracts) if (!ok) failures.push(`${route}: localized functional/commercial boundary contract failed`);

const enHome = await readFile(`${dist}/index.html`, 'utf8');
checks += 2;
if (!enHome.includes('href="/ru" lang="ru"')) failures.push('/: missing visible RU entry point');
if (!enHome.includes('name="bitevo-build-sha"')) failures.push('/: missing build SHA meta receipt');

if (failures.length) {
  console.error(`RU_SURFACE_GATE=FAIL checks=${checks} failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`RU_SURFACE_GATE=PASS routes=${routes.length} checks=${checks} reciprocal_pairs=${routes.length} functional_tools=2 commercial_routes=2 failures=0`);
