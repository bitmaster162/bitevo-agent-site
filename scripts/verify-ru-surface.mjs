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

for (const [route, enRoute] of routes) {
  const file = route === '/ru' ? `${dist}/ru/index.html` : `${dist}${route}/index.html`;
  let html = '';
  try {
    html = await readFile(file, 'utf8');
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
    ['x-default alternate', html.includes(`hreflang="x-default" href="${expectedEn}"`)]
  ];
  checks += assertions.length;
  for (const [label, ok] of assertions) if (!ok) failures.push(`${route}: ${label} failed`);
}

const ruHome = await readFile(`${dist}/ru/index.html`, 'utf8');
for (const path of ['/ru/pricing', '/ru/agent-authority-audit', '/ru/build', '/ru/universe']) {
  checks += 1;
  if (!ruHome.includes(`href="${path}"`)) failures.push(`/ru: missing Russian core navigation link ${path}`);
}

if (failures.length) {
  console.error(`RU_SURFACE_GATE=FAIL checks=${checks} failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`RU_SURFACE_GATE=PASS routes=${routes.length} checks=${checks} failures=0`);
