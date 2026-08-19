import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const failures = [];
const inventory = [];
let htmlFiles = 0;
let inertJsonLd = 0;

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

  const styleBlocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  for (const match of styleBlocks) {
    inventory.push({ route, type: 'inline-style', sha256: digest(match[1]) });
    failures.push(`${route}: inline <style> block is not permitted by release CSP`);
  }

  const styleAttrs = [...html.matchAll(/\sstyle\s*=\s*(["'])/gi)];
  if (styleAttrs.length) failures.push(`${route}: ${styleAttrs.length} inline style attribute(s) are not permitted by release CSP`);

  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = match[1] || '';
    const body = match[2] || '';
    if (/\bsrc\s*=/.test(attrs) || !body.trim()) continue;
    const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() || '';
    const hash = digest(body);
    if (type === 'application/ld+json') {
      inertJsonLd += 1;
      inventory.push({ route, type: 'inert-json-ld', sha256: hash });
      continue;
    }
    inventory.push({ route, type: 'inline-executable-script', sha256: hash });
    failures.push(`${route}: executable inline <script> is not permitted by release CSP`);
  }
}

if (failures.length) {
  console.error(`INLINE_CSP_GATE=FAIL html=${htmlFiles} inventory=${inventory.length} inert_json_ld=${inertJsonLd} failures=${failures.length}`);
  for (const item of inventory) console.error(`INLINE_CSP_INVENTORY route=${item.route} type=${item.type} sha256=${item.sha256}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`INLINE_CSP_GATE=PASS html=${htmlFiles} inventory=${inventory.length} inert_json_ld=${inertJsonLd} executable_inline=0 inline_styles=0 style_attrs=0 failures=0`);
