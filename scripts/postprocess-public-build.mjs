import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const meta = JSON.parse(await readFile(join(root, 'src/generated/build-meta.json'), 'utf8'));
const allowlist = JSON.parse(await readFile(join(root, 'scripts/csp-inline-allowlist.json'), 'utf8'));
const registry = JSON.parse(await readFile(join(root, 'src/data/public-route-registry.json'), 'utf8'));
const origin = 'https://bitevo.work';
const legacyOrigin = 'https://bitevoagentsite.vercel.app';

const enIndexable = registry.routes.filter(route => route.indexable && route.locale === 'en');
const ruIndexable = new Map(
  registry.routes
    .filter(route => route.indexable && route.locale === 'ru')
    .map(route => [route.path, route])
);
const localizedPairs = enIndexable.map(route => {
  const ruRoute = route.path === '/' ? '/ru' : `/ru${route.path}`;
  const partner = ruIndexable.get(ruRoute);
  if (!partner) throw new Error(`Missing RU parity route for ${route.path}: expected ${ruRoute}`);
  if (partner.category !== route.category) throw new Error(`Locale category drift for ${route.path} ↔ ${ruRoute}: ${route.category} != ${partner.category}`);
  return [route.path, ruRoute];
});

const cspHashes = values => values.map(hash => `'sha256-${hash}'`).join(' ');
const cloudflareMetaCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  `script-src 'self' ${cspHashes(allowlist.scripts || [])}`.trim(),
  `style-src 'self' ${cspHashes(allowlist.styles || [])}`.trim(),
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  'upgrade-insecure-requests'
].join('; ');
const cloudflareMetaTag = `<meta http-equiv="Content-Security-Policy" content="${cloudflareMetaCsp}" data-cloudflare-csp="hash-bound">`;

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

const localeSwitchStylesheet = '<link rel="stylesheet" href="/locale-switch.css" data-global-locale-switch-stylesheet>';

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
let cloudflareHtml = 0;
let cloudflareCspTags = 0;
for (const path of await walk(dist)) {
  let html = await readFile(path, 'utf8');
  html = html.replaceAll(legacyOrigin, origin);
  const locale = localeByFile.get(path);

  if (meta.provider === 'cloudflare') {
    cloudflareHtml += 1;
    if (!html.includes('data-cloudflare-csp="hash-bound"')) {
      const withCsp = html.replace(/<head(\s[^>]*)?>/i, match => `${match}${cloudflareMetaTag}`);
      if (withCsp === html) throw new Error(`${path}: missing <head> for Cloudflare CSP`);
      html = withCsp;
    }
    if (html.includes('data-cloudflare-csp="hash-bound"')) cloudflareCspTags += 1;
  }

  if (!html.includes('name="bitevo-build-sha"')) {
    html = html.replace('</head>', `<meta name="bitevo-build-sha" content="${meta.sha}"></head>`);
  }
  if (!html.includes('data-build-sha=')) {
    html = html.replace('<html ', `<html data-build-sha="${meta.sha}" `);
  }

  const hasRuLocaleBar = locale?.current === 'ru' && html.includes('class="ru-locale-bar"');
  if (hasRuLocaleBar) retainedRuLocaleBars += 1;

  if (locale && html.includes('<header class="site-header">') && !html.includes('data-global-locale-switch=')) {
    if (!html.includes('data-global-locale-switch-stylesheet')) {
      html = html.replace('</head>', `${localeSwitchStylesheet}</head>`);
    }
    const switchMarkup = `<a class="global-locale-switch" data-global-locale-switch="${locale.current}-to-${locale.target}" data-locale-pair="paired" href="${locale.href}" lang="${locale.target}" aria-label="${locale.aria}">${locale.label}</a>`;
    const ctaMarker = '<a class="header-cta"';
    if (html.includes(ctaMarker)) {
      html = html.replace(ctaMarker, `${switchMarkup}${ctaMarker}`);
      injectedGlobalLocaleSwitches += 1;
      localeAffordances += 1;
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
if (localeAffordances !== expectedLocaleAffordances) throw new Error(`Expected ${expectedLocaleAffordances} paired locale affordances, found ${localeAffordances}`);
if (injectedGlobalLocaleSwitches !== expectedLocaleAffordances) throw new Error(`Expected ${expectedLocaleAffordances} global locale switches, injected ${injectedGlobalLocaleSwitches}`);
if (retainedRuLocaleBars !== localizedPairs.length) throw new Error(`Expected ${localizedPairs.length} RU page-level locale bars, found ${retainedRuLocaleBars}`);
if (meta.provider === 'cloudflare' && cloudflareCspTags !== cloudflareHtml) {
  throw new Error(`Expected Cloudflare CSP meta on ${cloudflareHtml} HTML files, found ${cloudflareCspTags}`);
}

console.log(`BITEVO_POSTPROCESS=PASS sha=${meta.sha} localized_pairs=${localizedPairs.length} locale_affordances=${localeAffordances} global_locale_switches=${injectedGlobalLocaleSwitches} ru_locale_bars=${retainedRuLocaleBars} cloudflare_csp=${meta.provider === 'cloudflare' ? `${cloudflareCspTags}/${cloudflareHtml}` : 'N/A'}`);
