import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const distPath = fileURLToPath(new URL('../dist/', import.meta.url));
const vercelConfigPath = fileURLToPath(new URL('../vercel.json', import.meta.url));
const siteOrigin = 'https://bitevoagentsite.vercel.app';

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function rel(file) {
  return relative(distPath, file).split(sep).join('/');
}

function routeFromHtml(file) {
  const path = rel(file);
  if (path === 'index.html') return '/';
  if (path.endsWith('/index.html')) return `/${path.slice(0, -'/index.html'.length)}`;
  return `/${path}`;
}

function attrTag(html, attrName, attrValue) {
  const tag = html.match(new RegExp(`<(?:meta|link)\\b[^>]*\\b${attrName}=["']${attrValue}["'][^>]*>`, 'i'))?.[0];
  return tag || null;
}

function attr(tag, name) {
  return tag?.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'))?.[1] || null;
}

function stripTags(text) {
  return text.replace(/<[^>]*>/g, ' ').replace(/&[a-z0-9#]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function anchorHasFunnel(html, marker, href) {
  return [...html.matchAll(/<a\b[^>]*>/gi)].some(match => {
    const tag = match[0];
    return attr(tag, 'data-funnel') === marker && attr(tag, 'href') === href;
  });
}

function anchorHasText(html, href, expectedText) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].some(match => {
    const tag = `<a${match[1]}>`;
    return attr(tag, 'href') === href && stripTags(match[2]).includes(expectedText);
  });
}

const files = await walk(distPath);
const fileSet = new Set(files.map(rel));
const htmlFiles = files.filter(file => extname(file).toLowerCase() === '.html');
const routes = new Set(htmlFiles.map(routeFromHtml));
const publicFiles = new Set([...fileSet].map(path => `/${path}`));
const htmlByRoute = new Map();
const indexabilityByRoute = new Map();
const failures = [];
let indexableCount = 0;
let metadataChecks = 0;
let accessibilityChecks = 0;
let alternateChecks = 0;
let internalLinkChecks = 0;
let funnelChecks = 0;
let trustBoundaryChecks = 0;
let sitemapChecks = 0;
let externalBlankChecks = 0;
let configChecks = 0;

for (const file of htmlFiles) {
  const route = routeFromHtml(file);
  const html = await readFile(file, 'utf8');
  htmlByRoute.set(route, html);
  if (route === '/404.html') continue;

  const robotsTag = attrTag(html, 'name', 'robots');
  const robots = attr(robotsTag, 'content') || '';
  const indexable = !robots.toLowerCase().includes('noindex');
  indexabilityByRoute.set(route, indexable);

  if (indexable) {
    indexableCount += 1;
    const checks = [
      ['html lang', /<html\b[^>]*\blang=["'][^"']+["']/i.test(html)],
      ['title', /<title>[^<]+<\/title>/i.test(html)],
      ['description', Boolean(attr(attrTag(html, 'name', 'description'), 'content'))],
      ['canonical', Boolean(attr(attrTag(html, 'rel', 'canonical'), 'href'))],
      ['og:title', Boolean(attr(attrTag(html, 'property', 'og:title'), 'content'))],
      ['og:description', Boolean(attr(attrTag(html, 'property', 'og:description'), 'content'))],
      ['og:url', Boolean(attr(attrTag(html, 'property', 'og:url'), 'content'))],
      ['og:image', Boolean(attr(attrTag(html, 'property', 'og:image'), 'content'))],
      ['twitter:card', Boolean(attr(attrTag(html, 'name', 'twitter:card'), 'content'))],
      ['twitter:image', Boolean(attr(attrTag(html, 'name', 'twitter:image'), 'content'))],
      ['Organization JSON-LD', html.includes('"@type":"Organization"')],
      ['WebSite JSON-LD', html.includes('"@type":"WebSite"')]
    ];
    metadataChecks += checks.length;
    for (const [label, ok] of checks) if (!ok) failures.push(`${route}: missing ${label}`);

    const canonical = attr(attrTag(html, 'rel', 'canonical'), 'href');
    if (canonical && !canonical.startsWith(siteOrigin)) failures.push(`${route}: canonical outside site origin (${canonical})`);

    for (const [label, tag] of [
      ['og:image', attrTag(html, 'property', 'og:image')],
      ['twitter:image', attrTag(html, 'name', 'twitter:image')]
    ]) {
      const imageUrl = attr(tag, 'content');
      if (imageUrl && !imageUrl.startsWith(`${siteOrigin}/`)) failures.push(`${route}: ${label} outside canonical site origin (${imageUrl})`);
    }

    const h1Count = [...html.matchAll(/<h1\b/gi)].length;
    accessibilityChecks += 3;
    if (h1Count !== 1) failures.push(`${route}: expected exactly one h1, found ${h1Count}`);
    if (!/<main\b[^>]*\bid=["']main-content["']/i.test(html)) failures.push(`${route}: missing main#main-content landmark`);
    if (!/<a\b[^>]*\bclass=["'][^"']*skip-link[^"']*["'][^>]*\bhref=["']#main-content["']/i.test(html)) failures.push(`${route}: missing skip link to #main-content`);
  }

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    accessibilityChecks += 1;
    if (!/\balt=["'][^"']*["']/i.test(match[0])) failures.push(`${route}: img missing alt attribute`);
  }

  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    accessibilityChecks += 1;
    const attrs = match[1] || '';
    const text = stripTags(match[2] || '');
    const ariaLabel = attrs.match(/\baria-label=["']([^"']+)["']/i)?.[1]?.trim();
    const title = attrs.match(/\btitle=["']([^"']+)["']/i)?.[1]?.trim();
    if (!text && !ariaLabel && !title) failures.push(`${route}: button has no accessible name`);
  }

  for (const match of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) {
    const href = match[1];
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    if (href.startsWith('/')) {
      internalLinkChecks += 1;
      const target = new URL(href, siteOrigin).pathname.replace(/\/$/, '') || '/';
      const targetFile = target === '/' ? '/index.html' : target;
      if (!routes.has(target) && !publicFiles.has(target) && !publicFiles.has(targetFile)) {
        failures.push(`${route}: internal link points to missing built target ${href}`);
      }
    }
  }

  for (const match of html.matchAll(/<link\b[^>]*\brel=["']alternate["'][^>]*>/gi)) {
    const tag = match[0];
    const hreflang = attr(tag, 'hreflang');
    const href = attr(tag, 'href');
    if (!hreflang || !href) {
      failures.push(`${route}: malformed alternate-language link`);
      continue;
    }
    alternateChecks += 1;
    if (href.startsWith(siteOrigin)) {
      const target = new URL(href).pathname.replace(/\/$/, '') || '/';
      if (!routes.has(target)) failures.push(`${route}: hreflang ${hreflang} points to missing route ${target}`);
    }
  }

  for (const match of html.matchAll(/<a\b[^>]*\btarget=["']_blank["'][^>]*>/gi)) {
    externalBlankChecks += 1;
    const relValue = attr(match[0], 'rel') || '';
    if (!relValue.split(/\s+/).includes('noopener')) failures.push(`${route}: target=_blank link missing rel=noopener`);
  }

  if (/href=["']javascript:/i.test(html)) failures.push(`${route}: javascript: href is prohibited`);
}

const funnelContracts = [
  ['/', 'home-primary', '/mapper'],
  ['/', 'home-proof', '/proof'],
  ['/', 'map', '/mapper'],
  ['/', 'proof', '/proof'],
  ['/', 'scope', '/audit-intake']
];
for (const [route, marker, href] of funnelContracts) {
  funnelChecks += 1;
  const html = htmlByRoute.get(route) || '';
  if (!anchorHasFunnel(html, marker, href)) failures.push(`${route}: funnel marker ${marker} must point to ${href}`);
}

const funnelTextContracts = [
  ['/agent-authority-audit', '/mapper', 'Map the workflow'],
  ['/pricing', '/audit-intake', 'Qualify the workflow'],
  ['/pricing', '/audit-intake', 'Test one uncertainty'],
  ['/pricing', '/mapper', 'Map the authority decision'],
  ['/pricing', '/mapper', 'Map the action chain'],
  ['/consulting', '/mapper', 'Map a workflow'],
  ['/consulting', '/mapper', 'Map the critical action'],
  ['/doctrine', '/mapper', 'Map one workflow']
];
for (const [route, href, label] of funnelTextContracts) {
  funnelChecks += 1;
  const html = htmlByRoute.get(route) || '';
  if (!anchorHasText(html, href, label)) failures.push(`${route}: expected funnel CTA "${label}" -> ${href}`);
}

const trustBoundaryContracts = [
  ['/proof', ['SYNTHETIC PROOF SURFACE', 'DOES NOT ESTABLISH', 'PRODUCTION EXECUTION', 'NOT UNIVERSAL CERTIFICATION']],
  ['/sample-audit', ['SYNTHETIC / NOT EXECUTED', 'NOT OBSERVED', 'NOT TESTED']],
  ['/sample-message', ['SYNTHETIC / NOT EXECUTED', 'NOT TESTED']],
  ['/sample-deployment', ['SYNTHETIC / NOT EXECUTED', 'NOT TESTED']]
];
for (const [route, requiredPhrases] of trustBoundaryContracts) {
  const html = (htmlByRoute.get(route) || '').toUpperCase();
  for (const phrase of requiredPhrases) {
    trustBoundaryChecks += 1;
    if (!html.includes(phrase)) failures.push(`${route}: missing proof-boundary phrase "${phrase}"`);
  }
}

const sitemapFile = join(distPath, 'sitemap.xml');
const llmsFile = join(distPath, 'llms.txt');

if (!fileSet.has('build/index.html')) failures.push('/build: route missing from static output');
if (!fileSet.has('sitemap.xml')) failures.push('sitemap.xml missing from static output');
if (!fileSet.has('llms.txt')) failures.push('llms.txt missing from static output');
if (!fileSet.has('og-card.png')) failures.push('og-card.png missing from static output');

if (fileSet.has('sitemap.xml')) {
  const sitemap = await readFile(sitemapFile, 'utf8');
  if (!sitemap.includes(`${siteOrigin}/build`)) failures.push('sitemap.xml: /build missing');
  sitemapChecks += 1;
  for (const [route, indexable] of indexabilityByRoute) {
    if (route === '/' || route === '/404.html') continue;
    const listed = sitemap.includes(`<loc>${siteOrigin}${route}</loc>`);
    if (!indexable && listed) failures.push(`sitemap.xml: noindex route must not be listed (${route})`);
  }
}
if (fileSet.has('llms.txt')) {
  const llms = await readFile(llmsFile, 'utf8');
  if (!llms.includes('- /build')) failures.push('llms.txt: /build missing');
}

if (!routes.has('/ru')) {
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    if (/hreflang=["']ru["']/i.test(html)) failures.push(`${routeFromHtml(file)}: publishes ru hreflang before /ru exists`);
  }
}

const vercelConfig = JSON.parse(await readFile(vercelConfigPath, 'utf8'));
const headerRules = Array.isArray(vercelConfig.headers) ? vercelConfig.headers : [];
const globalHeaders = headerRules.find(rule => rule.source === '/(.*)')?.headers || [];
const globalHeaderMap = new Map(globalHeaders.map(item => [String(item.key).toLowerCase(), String(item.value)]));
const requiredSecurityHeaders = ['x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy', 'content-security-policy'];
for (const key of requiredSecurityHeaders) {
  configChecks += 1;
  if (!globalHeaderMap.has(key)) failures.push(`vercel.json: missing global ${key} header`);
}
configChecks += 1;
if (!globalHeaderMap.get('content-security-policy')?.includes("frame-ancestors 'none'")) failures.push("vercel.json: CSP must include frame-ancestors 'none'");

const immutableRule = headerRules.find(rule => rule.source === '/_astro/(.*)');
const immutableCache = immutableRule?.headers?.find(item => String(item.key).toLowerCase() === 'cache-control')?.value || '';
configChecks += 1;
if (!String(immutableCache).includes('immutable') || !String(immutableCache).includes('31536000')) failures.push('vercel.json: hashed Astro assets must use one-year immutable cache');

if (failures.length) {
  console.error('PUBLIC_QUALITY_GATE=FAIL');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log(`PUBLIC_QUALITY_GATE=PASS html_scanned=${htmlFiles.length} indexable=${indexableCount} metadata_checks=${metadataChecks} accessibility_checks=${accessibilityChecks} internal_link_checks=${internalLinkChecks} funnel_checks=${funnelChecks} trust_boundary_checks=${trustBoundaryChecks} sitemap_checks=${sitemapChecks} alternate_checks=${alternateChecks} target_blank_checks=${externalBlankChecks} config_checks=${configChecks} failures=0`);