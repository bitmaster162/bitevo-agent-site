import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const allowlist = JSON.parse(await readFile(join(root, 'scripts/csp-inline-allowlist.json'), 'utf8'));
const expectedScripts = new Set(allowlist.scripts || []);
const expectedStyles = new Set(allowlist.styles || []);
const observedScripts = new Set();
const observedStyles = new Set();
const failures = [];
let htmlFiles = 0;
let inertJsonLd = 0;
let executableInline = 0;
let styleBlocks = 0;
let styleAttrs = 0;

if (allowlist.schema !== 'bitevo.csp-inline-allowlist/v1') failures.push(`unexpected allowlist schema: ${allowlist.schema}`);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}

const digest = value => createHash('sha256').update(value).digest('base64');

for (const path of await walk(dist)) {
  const html = await readFile(path, 'utf8');
  const route = relative(dist, path).replaceAll('\\', '/');
  htmlFiles += 1;

  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const hash = digest(match[1]);
    observedStyles.add(hash);
    styleBlocks += 1;
    if (!expectedStyles.has(hash)) failures.push(`${route}: unreviewed inline style hash sha256-${hash}`);
  }

  const attrs = [...html.matchAll(/\sstyle\s*=\s*(["'])/gi)];
  styleAttrs += attrs.length;
  if (attrs.length) failures.push(`${route}: ${attrs.length} inline style attribute(s) are forbidden; hash sources do not authorize style attributes here`);

  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrsText = match[1] || '';
    const body = match[2] || '';
    if (/\bsrc\s*=/.test(attrsText) || !body.trim()) continue;
    const hash = digest(body);
    const type = attrsText.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() || '';
    observedScripts.add(hash);
    if (type === 'application/ld+json') inertJsonLd += 1;
    else executableInline += 1;
    if (!expectedScripts.has(hash)) failures.push(`${route}: unreviewed inline script hash sha256-${hash} type=${type || 'javascript'}`);
  }
}

for (const hash of expectedStyles) if (!observedStyles.has(hash)) failures.push(`stale reviewed style hash no longer emitted: sha256-${hash}`);
for (const hash of expectedScripts) if (!observedScripts.has(hash)) failures.push(`stale reviewed script hash no longer emitted: sha256-${hash}`);

if (failures.length) {
  console.error(`INLINE_CSP_GATE=FAIL html=${htmlFiles} observed_style_hashes=${observedStyles.size} observed_script_hashes=${observedScripts.size} style_blocks=${styleBlocks} executable_inline=${executableInline} inert_json_ld=${inertJsonLd} style_attrs=${styleAttrs} failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`INLINE_CSP_GATE=PASS html=${htmlFiles} reviewed_style_hashes=${observedStyles.size} reviewed_script_hashes=${observedScripts.size} style_blocks=${styleBlocks} executable_inline=${executableInline} inert_json_ld=${inertJsonLd} style_attrs=0 unknown_hashes=0 stale_hashes=0 failures=0`);
