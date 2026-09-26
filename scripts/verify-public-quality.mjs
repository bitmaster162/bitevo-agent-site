import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const distPath = fileURLToPath(new URL('../dist/', import.meta.url));
const repoRootPath = fileURLToPath(new URL('../', import.meta.url));
const siteOrigin = 'https://bitevo.work';

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

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(buffer) {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('invalid PNG signature');
  }

  let offset = 8;
  let ihdr = null;
  let sawIend = false;
  const idat = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (chunkEnd > buffer.length) throw new Error('truncated PNG chunk');

    const type = buffer.toString('ascii', typeStart, dataStart);
    const chunkData = buffer.subarray(dataStart, dataEnd);
    const expectedCrc = buffer.readUInt32BE(dataEnd);
    const actualCrc = crc32(Buffer.concat([buffer.subarray(typeStart, dataStart), chunkData]));
    if (actualCrc !== expectedCrc) throw new Error(type + ' CRC mismatch');

    if (type === 'IHDR') {
      if (ihdr) throw new Error('duplicate IHDR');
      if (length !== 13) throw new Error('invalid IHDR length');
      ihdr = Buffer.from(chunkData);
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(chunkData));
    } else if (type === 'IEND') {
      if (length !== 0) throw new Error('invalid IEND length');
      sawIend = true;
      offset = chunkEnd;
      break;
    }
    offset = chunkEnd;
  }

  if (!ihdr) throw new Error('missing IHDR');
  if (!idat.length) throw new Error('missing IDAT');
  if (!sawIend) throw new Error('missing IEND');
  if (offset !== buffer.length) throw new Error('trailing bytes after IEND');

  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const compression = ihdr[10];
  const filterMethod = ihdr[11];
  const interlace = ihdr[12];

  if (width < 1 || height < 1) throw new Error('invalid dimensions');
  if (bitDepth !== 8) throw new Error('PNG must use 8-bit channels');
  if (![2, 6].includes(colorType)) throw new Error('PNG must be truecolor RGB or RGBA');
  if (compression !== 0 || filterMethod !== 0 || interlace !== 0) {
    throw new Error('unsupported PNG compression/filter/interlace method');
  }

  const channels = colorType === 2 ? 3 : 4;
  const bytesPerPixel = channels;
  const rowBytes = width * channels;
  const inflated = inflateSync(Buffer.concat(idat));
  const expectedInflated = height * (rowBytes + 1);
  if (inflated.length !== expectedInflated) {
    throw new Error('decoded byte length mismatch');
  }

  let cursor = 0;
  let previous = Buffer.alloc(rowBytes);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[cursor];
    cursor += 1;
    if (filter > 4) throw new Error('invalid PNG scanline filter');
    const source = inflated.subarray(cursor, cursor + rowBytes);
    cursor += rowBytes;
    const decoded = Buffer.allocUnsafe(rowBytes);

    for (let x = 0; x < rowBytes; x += 1) {
      const raw = source[x];
      const left = x >= bytesPerPixel ? decoded[x - bytesPerPixel] : 0;
      const up = previous[x];
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      let value;
      if (filter === 0) value = raw;
      else if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else value = raw + paethPredictor(left, up, upLeft);
      decoded[x] = value & 0xff;
    }
    previous = decoded;
  }

  return { width, height, bitDepth, colorType, decodedBytes: width * height * channels };
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
const canonicalOverrides = new Map([
  ['/guides/ai-agent-reliability-audit', '/agent-authority-audit']
]);

let accessibilityChecks = 0;
let alternateChecks = 0;
let internalLinkChecks = 0;
let funnelChecks = 0;
let trustBoundaryChecks = 0;
let sitemapChecks = 0;
let externalBlankChecks = 0;
let configChecks = 0;
let imageChecks = 0;

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
    const ogUrl = attr(attrTag(html, 'property', 'og:url'), 'content');
    const canonicalRoute = canonicalOverrides.get(route) ?? (route === '/' ? '/' : route.replace(/\/+$/, ''));
    const expectedCanonical = new URL(canonicalRoute, siteOrigin).toString();
    metadataChecks += 2;
    if (canonical && canonical !== expectedCanonical) failures.push(`${route}: canonical must match exact no-trailing-slash route URL (${canonical} != ${expectedCanonical})`);
    if (canonical && ogUrl && ogUrl !== canonical) failures.push(`${route}: og:url must exactly match canonical (${ogUrl} != ${canonical})`);
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
  ['/', 'home-primary', '/start'],
  ['/', 'home-proof', '/proof'],
  ['/', 'map', '/mapper'],
  ['/', 'proof', '/proof'],
  ['/', 'scope', '/audit-intake'],
  ['/', 'home-primary-scope', '/audit-intake'],
  ['/', 'home-primary-scope-mobile', '/audit-intake']
];
for (const [route, marker, href] of funnelContracts) {
  funnelChecks += 1;
  const html = htmlByRoute.get(route) || '';
  if (!anchorHasFunnel(html, marker, href)) failures.push(`${route}: funnel marker ${marker} must point to ${href}`);
}

const funnelTextContracts = [
  ['/agent-authority-audit', '/mapper', 'Map the workflow'],
  ['/agent-authority-audit', '/audit-intake?offer=primary-agent-authority-audit', 'Prepare Primary Audit scope'],
  ['/pricing', '/audit-intake', 'Prepare triage brief'],
  ['/pricing', '/audit-intake?offer=entry-audit', 'Prepare Entry Audit scope'],
  ['/pricing', '/audit-intake?offer=primary-agent-authority-audit', 'Prepare Primary Audit scope'],
  ['/pricing', '/mapper', 'Map the action chain'],
  ['/consulting', '/audit-intake', 'Prepare triage brief'],
  ['/consulting', '/audit-intake?offer=entry-audit', 'Prepare Entry Audit scope'],
  ['/consulting', '/agent-authority-audit', 'See the decision model'],
  ['/consulting', '/audit-intake?offer=primary-agent-authority-audit', 'Prepare Primary Audit scope'],
  ['/consulting', '/mapper', 'Map a workflow'],
  ['/consulting', '/mapper', 'Map the critical action'],
  ['/assurance', '/audit-intake?offer=security-control-validation', 'Scope one control boundary'],
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
  ['/sample-deployment', ['SYNTHETIC / NOT EXECUTED', 'NOT TESTED']],
  ['/mapper', ['NO SECRETS. NO AUTHORIZATION. NO SCORE.', 'IT DOES NOT AUTHORIZE EXECUTION', 'WRITTEN RULES OF ENGAGEMENT REMAIN REQUIRED']],
  ['/diagnostic', ['DOES NOT AUTHORIZE TESTING', 'WRITTEN RULES OF ENGAGEMENT REMAIN REQUIRED', 'TEST EXECUTION REMAINS SEPARATELY AUTHORIZED']],
  ['/pricing', ['DOES NOT BOOK A TRIAGE', 'SUBMIT AN AUDIT REQUEST', 'AUTHORIZE TESTING', '5 WORKING DAYS AFTER COMPLETE EVIDENCE/ACCESS + WRITTEN SCOPE', 'FREE, ENTRY AND PRIMARY SCOPE-PREPARATION CTAS']],
  ['/consulting', ['DOES NOT BOOK A TRIAGE', 'SUBMIT AN AUDIT REQUEST', 'AUTHORIZE TESTING', '5 WORKING DAYS AFTER COMPLETE EVIDENCE/ACCESS + WRITTEN SCOPE', 'FREE, ENTRY AND PRIMARY SCOPE-PREPARATION CTAS']],
  ['/agent-authority-audit', ['5 WORKING DAYS AFTER COMPLETE EVIDENCE/ACCESS + WRITTEN SCOPE', 'PUBLIC INTAKE', 'DOES NOT AUTHORIZE TESTING']],
  ['/', ['5 WORKING DAYS AFTER COMPLETE EVIDENCE/ACCESS + WRITTEN SCOPE', 'PHASE A', 'PHASE B', 'PHASE C', 'PHASE D']]
];
for (const [route, requiredPhrases] of trustBoundaryContracts) {
  const html = (htmlByRoute.get(route) || '').toUpperCase();
  for (const phrase of requiredPhrases) {
    trustBoundaryChecks += 1;
    if (!html.includes(phrase)) failures.push(`${route}: missing proof-boundary phrase "${phrase}"`);
  }
}

const homepageHtml = htmlByRoute.get('/') || '';
for (const staleTiming of ['Day 0', 'Days 1–2', 'Days 3–4', 'Day 5']) {
  trustBoundaryChecks += 1;
  if (homepageHtml.includes(staleTiming)) failures.push(`/: stale unsupported day-by-day Primary timing "${staleTiming}"`);
}

const mobileDock = homepageHtml.match(/<div\b[^>]*class=["'][^"']*mobile-dock[^"']*["'][^>]*>[\s\S]*?<\/div>/i)?.[0] || '';
trustBoundaryChecks += 1;
if (!mobileDock.toUpperCase().includes('5 WORKING DAYS AFTER COMPLETE EVIDENCE/ACCESS + WRITTEN SCOPE') || !anchorHasFunnel(mobileDock, 'home-primary-scope-mobile', '/audit-intake')) {
  failures.push('/: mobile Primary dock must preserve qualified timing and local scope-prep CTA');
}

trustBoundaryChecks += 1;
if (/"areaServed"\s*:/.test(homepageHtml)) {
  failures.push('/: Service JSON-LD must not publish areaServed without an explicit governing service-area policy');
}

const sitemapFile = join(distPath, 'sitemap.xml');
const llmsFile = join(distPath, 'llms.txt');

if (!fileSet.has('build/index.html')) failures.push('/build: route missing from static output');
if (!fileSet.has('sitemap.xml')) failures.push('sitemap.xml missing from static output');
if (!fileSet.has('llms.txt')) failures.push('llms.txt missing from static output');
if (!fileSet.has('og-card.png')) {
  failures.push('og-card.png missing from static output');
} else {
  imageChecks += 5;
  try {
    const distOg = await readFile(join(distPath, 'og-card.png'));
    const sourceOg = await readFile(join(repoRootPath, 'public', 'og-card.png'));
    const decoded = decodePng(distOg);
    if (decoded.width !== 1200) failures.push('og-card.png: width must be 1200');
    if (decoded.height !== 630) failures.push('og-card.png: height must be 630');
    if (decoded.decodedBytes <= 0) failures.push('og-card.png: decoded pixel buffer must be non-empty');
    if (!distOg.equals(sourceOg)) failures.push('og-card.png: dist output must be byte-identical to public source');
  } catch (error) {
    failures.push('og-card.png: decode failed: ' + (error instanceof Error ? error.message : String(error)));
  }
}

if (fileSet.has('sitemap.xml')) {
  const sitemap = await readFile(sitemapFile, 'utf8');
  const currentness = JSON.parse(await readFile(join(repoRootPath, 'src/data/sitemap-currentness.json'), 'utf8'));
  const currentnessByRoute = new Map((currentness.routes || []).map(row => [row.path, row]));
  const sitemapEntries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(match => match[1]);
  const sitemapLastmods = [];
  sitemapChecks += 5;
  if (currentness.schema !== 'bitevo.sitemap-currentness/v1') failures.push(`sitemap.xml: currentness schema mismatch (actual=${currentness.schema || 'missing'})`);
  if (currentness.normalization !== 'provider-envelope-v1') failures.push(`sitemap.xml: currentness normalization mismatch (actual=${currentness.normalization || 'missing'})`);
  if (currentnessByRoute.size !== indexableCount) failures.push(`sitemap.xml: currentness route count must equal indexable routes (currentness=${currentnessByRoute.size} indexable=${indexableCount})`);
  if (sitemapEntries.length !== indexableCount) failures.push(`sitemap.xml: URL entry count must equal indexable routes (entries=${sitemapEntries.length} indexable=${indexableCount})`);
  for (const entry of sitemapEntries) {
    const loc = entry.match(/<loc>([^<]+)<\/loc>/)?.[1] || '';
    const lastmod = entry.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] || '';
    if (lastmod) sitemapLastmods.push(lastmod);
    let route = '';
    try {
      const parsed = new URL(loc);
      route = parsed.pathname === '/' ? '/' : parsed.pathname.replace(/\/+$/, '');
    } catch {}
    const expectedLastmod = String(currentnessByRoute.get(route)?.lastmod || '');
    sitemapChecks += 5;
    if (!loc) failures.push('sitemap.xml: every URL entry must include loc');
    if (!lastmod) failures.push(`sitemap.xml: every URL entry must include lastmod (route=${route || 'unknown'})`);
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) failures.push(`sitemap.xml: invalid lastmod format ${lastmod}`);
    if (!expectedLastmod) failures.push(`sitemap.xml: currentness entry missing for ${route || loc || 'unknown'}`);
    else if (lastmod !== expectedLastmod) failures.push(`sitemap.xml: lastmod mismatch for ${route} expected=${expectedLastmod} actual=${lastmod}`);
  }
  if (sitemapLastmods.length !== sitemapEntries.length) failures.push(`sitemap.xml: lastmod count must equal URL entry count (lastmod=${sitemapLastmods.length} entries=${sitemapEntries.length})`);
  if (!sitemap.includes(`${siteOrigin}/build`)) failures.push('sitemap.xml: /build missing');
  for (const [route, indexable] of indexabilityByRoute) {
    if (route === '/404.html') continue;
    const canonicalRoute = route === '/' ? '/' : route.replace(/\/+$/, '');
    const canonicalLoc = new URL(canonicalRoute, siteOrigin).toString();
    const listed = sitemap.includes(`<loc>${canonicalLoc}</loc>`);
    if (indexable && !listed) failures.push(`sitemap.xml: indexable canonical route must be listed (${canonicalRoute})`);
    if (!indexable && listed) failures.push(`sitemap.xml: noindex route must not be listed (${route})`);
  }
}
if (fileSet.has('llms.txt')) {
  const llms = await readFile(llmsFile, 'utf8');
  if (!llms.includes('- /build')) failures.push('llms.txt: /build missing');
  const machineBoundaryPhrases = [
    'READY TO SCOPE TEST / RETEST',
    'it does not authorize execution',
    'The diagnostic does not authorize testing',
    '5 working days after complete evidence/access + written scope',
    'they do not book or submit an engagement',
    'including the Primary Audit path',
    'Homepage Primary Audit timing uses the same qualified five-working-day window',
    'Public Homepage, Pricing/Consulting and Agent Authority Audit scope-preparation CTAs'
  ];
  for (const phrase of machineBoundaryPhrases) {
    trustBoundaryChecks += 1;
    if (!llms.includes(phrase)) failures.push(`llms.txt: missing machine-boundary phrase "${phrase}"`);
  }
}

if (!routes.has('/ru')) {
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    if (/hreflang=["']ru["']/i.test(html)) failures.push(`${routeFromHtml(file)}: publishes ru hreflang before /ru exists`);
  }
}

const rootEntries = await readdir(repoRootPath, { withFileTypes: true });
const rootScriptNames = rootEntries
  .filter(entry => entry.isFile() && ['.bat', '.cmd', '.ps1', '.sh'].includes(extname(entry.name).toLowerCase()))
  .map(entry => entry.name);

configChecks += 1;
try {
  const attributes = await readFile(join(repoRootPath, '.gitattributes'), 'utf8');
  const pngBinary = attributes.split(/\r?\n/).some(line => line.trim() === '*.png binary');
  if (!pngBinary) failures.push('.gitattributes: missing exact *.png binary policy');
} catch {
  failures.push('.gitattributes: missing exact *.png binary policy');
}

configChecks += 1;
for (const scriptName of rootScriptNames) {
  const script = await readFile(join(repoRootPath, scriptName), 'utf8');
  const directMainPush = script
    .split(/\r?\n/)
    .some(line => /\bgit\s+push\b/i.test(line) && /\bmain\b/i.test(line));
  if (directMainPush) failures.push(`${scriptName}: root deployment helper must not push directly to main`);
}

if (failures.length) {
  console.error('PUBLIC_QUALITY_GATE=FAIL');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log(`PUBLIC_QUALITY_GATE=PASS html_scanned=${htmlFiles.length} indexable=${indexableCount} metadata_checks=${metadataChecks} accessibility_checks=${accessibilityChecks} internal_link_checks=${internalLinkChecks} funnel_checks=${funnelChecks} trust_boundary_checks=${trustBoundaryChecks} sitemap_checks=${sitemapChecks} alternate_checks=${alternateChecks} target_blank_checks=${externalBlankChecks} config_checks=${configChecks} failures=0`);
