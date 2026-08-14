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
  ['/mapper', '/ru/mapper'],
  ['/workspace', '/ru/workspace'],
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

const localeByFile = new Map();
for (const [enRoute, ruRoute] of localizedPairs) {
  localeByFile.set(htmlPath(enRoute), { current: 'en', target: 'ru', href: ruRoute, label: 'RU', aria: 'Русский' });
  localeByFile.set(htmlPath(ruRoute), { current: 'ru', target: 'en', href: enRoute, label: 'EN', aria: 'English' });

  const path = htmlPath(enRoute);
  let html = await readFile(path, 'utf8');
  if (!html.includes(`hreflang="ru" href="${origin}${ruRoute}"`)) {
    html = html.replace('</head>', `${alternates(enRoute, ruRoute)}</head>`);
    await writeFile(path, html, 'utf8');
  }
}

const localeSwitchStyle = `<style data-global-locale-switch-style>.global-locale-switch{display:inline-flex;align-items:center;justify-content:center;min-width:42px;height:34px;padding:0 10px;border:1px solid rgba(174,211,202,.18);border-radius:999px;color:var(--muted);background:rgba(255,255,255,.018);font:700 .66rem/1 var(--mono);letter-spacing:.08em;transition:color .18s ease,border-color .18s ease,background .18s ease,transform .18s ease}.global-locale-switch:hover{color:var(--ink);border-color:rgba(127,208,177,.48);background:rgba(127,208,177,.055);transform:translateY(-1px)}@media(max-width:980px){.global-locale-switch{margin-left:0}}</style>`;

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

let localeAffordances = 0;
let injectedGlobalLocaleSwitches = 0;
let retainedRuLocaleBars = 0;
for (const path of await walk(dist)) {
  let html = await readFile(path, 'utf8');
  const locale = localeByFile.get(path);

  if (!html.includes('name="bitevo-build-sha"')) {
    html = html.replace('</head>', `<meta name="bitevo-build-sha" content="${meta.sha}"></head>`);
  }
  if (!html.includes('data-build-sha=')) {
    html = html.replace('<html ', `<html data-build-sha="${meta.sha}" `);
  }

  if (locale && html.includes('<header class="site-header">') && !html.includes('data-global-locale-switch=')) {
    const hasExistingRuLocaleBar = locale.current === 'ru'
      && html.includes('class="ru-locale-bar"')
      && html.includes('class="locale-switch"')
      && html.includes(`href="${locale.href}"`);

    if (hasExistingRuLocaleBar) {
      retainedRuLocaleBars += 1;
      localeAffordances += 1;
    } else {
      if (!html.includes('data-global-locale-switch-style')) {
        html = html.replace('</head>', `${localeSwitchStyle}</head>`);
      }
      const switchMarkup = `<a class="global-locale-switch" data-global-locale-switch="${locale.current}-to-${locale.target}" data-locale-pair="paired" href="${locale.href}" lang="${locale.target}" aria-label="${locale.aria}">${locale.label}</a>`;
      const ctaMarker = '<a class="header-cta"';
      if (html.includes(ctaMarker)) {
        html = html.replace(ctaMarker, `${switchMarkup}${ctaMarker}`);
        injectedGlobalLocaleSwitches += 1;
        localeAffordances += 1;
      }
    }
  }

  if (html.includes('</footer>') && !html.includes('data-public-build-receipt')) {
    const isRu = /<html\b[^>]*\blang="ru"/i.test(html);
    const href = locale?.href ?? (isRu ? '/' : '/ru');
    const target = locale?.target ?? (isRu ? 'en' : 'ru');
    const label = locale?.label ?? (isRu ? 'EN' : 'RU');
    const localeLink = `<a href="${href}" lang="${target}">${label}</a>`;
    const receipt = `<div class="container footer-bottom" data-public-build-receipt="${meta.sha}"><span>Public build</span><span>${localeLink} · <a href="/version">Build ${meta.shortSha}</a></span></div>`;
    html = html.replace('</footer>', `${receipt}</footer>`);
  }
  await writeFile(path, html, 'utf8');
}

const expectedLocaleAffordances = localizedPairs.length * 2;
if (localeAffordances !== expectedLocaleAffordances) {
  throw new Error(`Expected ${expectedLocaleAffordances} paired locale affordances, found ${localeAffordances}`);
}
if (injectedGlobalLocaleSwitches !== localizedPairs.length) {
  throw new Error(`Expected ${localizedPairs.length} EN global locale switches, injected ${injectedGlobalLocaleSwitches}`);
}
if (retainedRuLocaleBars !== localizedPairs.length) {
  throw new Error(`Expected ${localizedPairs.length} RU page-level locale bars, found ${retainedRuLocaleBars}`);
}

console.log(`BITEVO_POSTPROCESS=PASS sha=${meta.sha} localized_pairs=${localizedPairs.length} locale_affordances=${localeAffordances} global_locale_switches=${injectedGlobalLocaleSwitches} ru_locale_bars=${retainedRuLocaleBars}`);
