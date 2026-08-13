import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const siteOrigin = 'https://bitevoagentsite.vercel.app';
const routes = [
  ['/ru', '/'],
  ['/ru/pricing', '/pricing'],
  ['/ru/agent-authority-audit', '/agent-authority-audit'],
  ['/ru/build', '/build'],
  ['/ru/universe', '/universe']
];
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
    ['visible build receipt', html.includes('data-public-build-receipt=')]
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
for (const path of ['/ru/pricing', '/ru/agent-authority-audit', '/ru/build', '/ru/universe']) {
  checks += 1;
  if (!ruHome.includes(`href="${path}"`)) failures.push(`/ru: missing Russian core navigation link ${path}`);
}

const enHome = await readFile(`${dist}/index.html`, 'utf8');
checks += 2;
if (!enHome.includes('href="/ru" lang="ru"')) failures.push('/: missing visible RU entry point');
if (!enHome.includes('name="bitevo-build-sha"')) failures.push('/: missing build SHA meta receipt');

if (failures.length) {
  console.error(`RU_SURFACE_GATE=FAIL checks=${checks} failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`RU_SURFACE_GATE=PASS routes=${routes.length} checks=${checks} reciprocal_pairs=${routes.length} failures=0`);
