import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const meta = JSON.parse(await readFile(join(root, 'src/generated/build-meta.json'), 'utf8'));
const origin = 'https://bitevoagentsite.vercel.app';

const localizedPairs = [
  ['/', '/ru'],
  ['/doctrine', '/ru/doctrine'],
  ['/artifacts', '/ru/artifacts'],
  ['/proof', '/ru/proof'],
  ['/dogfood-self-audit', '/ru/dogfood-self-audit'],
  ['/diagnostic', '/ru/diagnostic'],
  ['/agent-authority-audit', '/ru/agent-authority-audit'],
  ['/audit-intake', '/ru/audit-intake'],
  ['/pricing', '/ru/pricing'],
  ['/consulting', '/ru/consulting'],
  ['/continuityos', '/ru/continuityos'],
  ['/guides', '/ru/guides'],
  ['/build', '/ru/build'],
  ['/universe', '/ru/universe']
];

function htmlPath(route) {
  return route === '/' ? join(dist, 'index.html') : join(dist, route.replace(/^\//, ''), 'index.html');
}

function alternates(enRoute, ruRoute) {
  const en = `${origin}${enRoute === '/' ? '/' : enRoute}`;
  const ru = `${origin}${ruRoute}`;
  return [
    `<link rel="alternate" hreflang="en" href="${en}">`,
    `<link rel="alternate" hreflang="ru" href="${ru}">`,
    `<link rel="alternate" hreflang="x-default" href="${en}">`
  ].join('');
}

for (const [enRoute, ruRoute] of localizedPairs) {
  const path = htmlPath(enRoute);
  let html = await readFile(path, 'utf8');
  if (!html.includes(`hreflang="ru" href="${origin}${ruRoute}"`)) {
    html = html.replace('</head>', `${alternates(enRoute, ruRoute)}</head>`);
    await writeFile(path, html, 'utf8');
  }
}

const { readdir } = await import('node:fs/promises');
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}

for (const path of await walk(dist)) {
  let html = await readFile(path, 'utf8');
  if (!html.includes('name="bitevo-build-sha"')) {
    html = html.replace('</head>', `<meta name="bitevo-build-sha" content="${meta.sha}"></head>`);
  }
  if (!html.includes('data-build-sha=')) {
    html = html.replace('<html ', `<html data-build-sha="${meta.sha}" `);
  }
  if (html.includes('</footer>') && !html.includes('data-public-build-receipt')) {
    const isRu = /<html\b[^>]*\blang="ru"/i.test(html);
    const localeLink = isRu ? '<a href="/" lang="en">EN</a>' : '<a href="/ru" lang="ru">RU</a>';
    const receipt = `<div class="container footer-bottom" data-public-build-receipt="${meta.sha}"><span>Public build</span><span>${localeLink} · <a href="/version">Build ${meta.shortSha}</a></span></div>`;
    html = html.replace('</footer>', `${receipt}</footer>`);
  }
  await writeFile(path, html, 'utf8');
}

console.log(`BITEVO_POSTPROCESS=PASS sha=${meta.sha} localized_pairs=${localizedPairs.length}`);
