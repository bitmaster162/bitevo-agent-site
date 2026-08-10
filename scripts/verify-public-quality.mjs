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

const files = await walk(distPath);
const htmlFiles = files.filter(file => extname(file).toLowerCase() === '.html');
const routes = new Set(htmlFiles.map(routeFromHtml));
const failures = [];
let indexableCount = 0;
let metadataChecks = 0;
let alternateChecks = 0;
let externalBlankChecks = 0;
let configChecks = 0;

for (const file of htmlFiles) {
  const route = routeFromHtml(file);
  const html = await readFile(file, 'utf8');
  if (route === '/404.html') continue;

  const robotsTag = attrTag(html, 'name', 'robots');
  const robots = attr(robotsTag, 'content') || '';
  const indexable = !robots.toLowerCase().includes('noindex');

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

const sitemapFile = join(distPath, 'sitemap.xml');
const llmsFile = join(distPath, 'llms.txt');
const fileSet = new Set(files.map(rel));

if (!fileSet.has('build/index.html')) failures.push('/build: route missing from static output');
if (!fileSet.has('sitemap.xml')) failures.push('sitemap.xml missing from static output');
if (!fileSet.has('llms.txt')) failures.push('llms.txt missing from static output');
if (!fileSet.has('og-card.png')) failures.push('og-card.png missing from static output');

if (fileSet.has('sitemap.xml')) {
  const sitemap = await readFile(sitemapFile, 'utf8');
  if (!sitemap.includes(`${siteOrigin}/build`)) failures.push('sitemap.xml: /build missing');
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

console.log(`PUBLIC_QUALITY_GATE=PASS html_scanned=${htmlFiles.length} indexable=${indexableCount} metadata_checks=${metadataChecks} alternate_checks=${alternateChecks} target_blank_checks=${externalBlankChecks} config_checks=${configChecks} failures=0`);
