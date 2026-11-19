import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateScopeHandoffActivation } from '../src/lib/scope-handoff-r1/activation.js';

// Rendered-HTML regression for the Hydrogen site audit of 19 November 2026.
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const registry = JSON.parse(await readFile(new URL('../src/data/public-route-registry.json', import.meta.url), 'utf8'));
const activation = evaluateScopeHandoffActivation(process.env);
const indexable = registry.routes.filter(route => route.indexable);
const scopeRoutes = [
  '/', '/mapper', '/pricing', '/diagnostic', '/entry-audit', '/start', '/pre-check',
  '/ru', '/ru/mapper', '/ru/pricing', '/ru/diagnostic', '/ru/entry-audit', '/ru/start',
  '/audit-intake', '/ru/audit-intake'
];
const scopeSet = new Set(scopeRoutes);
const imageAttrs = ['alt', 'width', 'height'];
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}=(["'])(.*?)\\1`, 'i'))?.[2] ?? null;
const normalize = value => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
const extract = (html, regex) => [...html.matchAll(regex)].map(match => match[0]);
const routeFile = route => join(root, ...(route === '/' ? [] : route.slice(1).split('/')), 'index.html');
async function walk(dir) {
  const output = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) output.push(...await walk(path));
    else if (item.isFile() && path.endsWith('.html')) output.push(path);
  }
  return output;
}

const seoCheckedFiles = new Set([...indexable.map(({ path }) => routeFile(path)), ...['/privacy', '/ru/privacy', '/version'].map(routeFile)]);
const allHtml = await walk(root);
const htmlByFile = new Map();
let imageCount = 0;
for (const file of allHtml) {
  const html = await readFile(file, 'utf8');
  htmlByFile.set(file, html);
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
  const title = head.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
  const metas = extract(head, /<meta\b[^>]*>/gi);
  const meta = (key, value) => metas.filter(tag => attr(tag, key) === value);
  const desc = meta('name', 'description');
  if (seoCheckedFiles.has(file)) {
    assert.ok(title.length > 0, `${relative(root, file)}: title is required`);
    assert.equal(desc.length, 1, `${relative(root, file)}: exactly one meta description`);
    assert.ok((attr(desc[0], 'content') ?? '').trim(), `${relative(root, file)}: nonempty description`);
  }
  for (const img of extract(html, /<img\b[^>]*>/gi)) {
    imageCount += 1;
    for (const name of imageAttrs) assert.notEqual(attr(img, name), null, `${relative(root, file)}: img missing ${name}`);
    assert.ok(attr(img, 'alt') || attr(img, 'role') === 'presentation' || attr(img, 'aria-hidden') === 'true', `${relative(root, file)}: image requires meaningful alt or decorative semantics`);
    for (const name of ['width', 'height']) assert.ok(Number(attr(img, name)) > 0, `${relative(root, file)}: img ${name} must be positive`);
  }
  if (seoCheckedFiles.has(file)) for (const key of ['og:image', 'og:image:alt', 'og:image:width', 'og:image:height']) {
    const matches = meta('property', key);
    assert.equal(matches.length, 1, `${relative(root, file)}: missing or duplicate ${key}`);
    assert.ok((attr(matches[0], 'content') ?? '').trim(), `${relative(root, file)}: empty ${key}`);
  }
}

assert.equal(indexable.length, 142, 'indexable sitemap registry baseline must remain 142');
const titles = new Map();
const descriptions = new Map();
for (const { path: route } of indexable) {
  const html = htmlByFile.get(routeFile(route));
  assert.ok(html, `${route}: rendered route missing`);
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
  const title = normalize(head.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const tags = extract(head, /<meta\b[^>]*>/gi);
  const descriptionTag = tags.find(tag => attr(tag, 'name') === 'description');
  const description = normalize(attr(descriptionTag, 'content') ?? '');
  const canonicalTags = extract(head, /<link\b[^>]*>/gi).filter(tag => attr(tag, 'rel') === 'canonical');
  assert.equal(canonicalTags.length, 1, `${route}: exactly one canonical link`);
  assert.equal(attr(canonicalTags[0], 'href'), `https://bitevo.work${route}`, `${route}: self canonical must not include ?offer`);
  for (const [label, value, set] of [['title', title, titles], ['description', description, descriptions]]) {
    assert.ok(value, `${route}: ${label} is empty`);
    assert.ok(!set.has(value), `${route}: duplicate canonical ${label} also on ${set.get(value)}`);
    set.set(value, route);
  }
  for (const key of ['og:image:width', 'og:image:height']) {
    const tag = tags.find(tag => attr(tag, 'property') === key);
    assert.ok(Number(attr(tag, 'content')) > 0, `${route}: invalid ${key}`);
  }
}

let controllerLinks = 0;
let largestJs = 0;
let largestCss = 0;
for (const route of scopeRoutes) {
  const html = htmlByFile.get(routeFile(route));
  assert.ok(html, `${route}: scope-bearing route missing`);
  const scripts = extract(html, /<script\b[^>]*>/gi);
  const controller = scripts.filter(tag => attr(tag, 'src') === '/scope-handoff-r1.js');
  assert.equal(controller.length, activation.uiEnabled ? 1 : 0, `${route}: disabled scope controller must not be downloaded`);
  if (controller.length) {
    controllerLinks += 1;
    assert.equal(attr(controller[0], 'data-scope-handoff-r1-activation'), activation.uiMarker, `${route}: activation marker drift`);
  }
  const links = extract(html, /<link\b[^>]*>/gi).filter(tag => attr(tag, 'rel') === 'stylesheet');
  if (!route.endsWith('/audit-intake')) {
    const scopeCss = links.filter(tag => attr(tag, 'href') === '/scope-handoff-short.css');
    assert.equal(scopeCss.length, activation.uiEnabled ? 1 : 0, `${route}: disabled scope CSS must not be downloaded`);
  }
  let jsBytes = 0;
  for (const tag of scripts) {
    const src = attr(tag, 'src');
    if (!src || src === '/_vercel/insights/script.js') continue;
    assert.ok(src.startsWith('/') && !src.includes('..'), `${route}: unexpected script origin ${src}`);
    jsBytes += (await stat(join(root, src.slice(1)))).size;
  }
  let cssBytes = 0;
  for (const tag of links) {
    const href = attr(tag, 'href');
    if (href?.startsWith('/')) cssBytes += (await stat(join(root, href.slice(1)))).size;
  }
  largestJs = Math.max(largestJs, jsBytes);
  largestCss = Math.max(largestCss, cssBytes);
  if (!activation.uiEnabled) assert.ok(jsBytes <= 34_000, `${route}: disabled scope exceeds JS budget (${jsBytes} B)`);
  assert.ok(cssBytes <= 34_000, `${route}: stylesheet budget exceeded (${cssBytes} B)`);
}
console.log(`HYDROGEN_PERF_SEO_GATE=PASS html=${allHtml.length} indexable=${indexable.length} unique_titles=${titles.size} unique_descriptions=${descriptions.size} img_checked=${imageCount} scope_routes=${scopeRoutes.length} scope_controller_links=${controllerLinks} scope_ui=${activation.uiEnabled ? 'ENABLED' : 'DISABLED'} max_local_js=${largestJs} max_css=${largestCss}`);
