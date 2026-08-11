import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const distPath = fileURLToPath(new URL('../dist/', import.meta.url));

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

const files = await walk(distPath);
const htmlFiles = files.filter(file => extname(file).toLowerCase() === '.html');
const failures = [];
let htmlScanned = 0;
let externalFontChecks = 0;
let externalStylesheetChecks = 0;
let externalScriptChecks = 0;

for (const file of htmlFiles) {
  htmlScanned += 1;
  const route = relative(distPath, file).split(sep).join('/');
  const html = await readFile(file, 'utf8');

  for (const domain of ['fonts.googleapis.com', 'fonts.gstatic.com']) {
    externalFontChecks += 1;
    if (html.includes(domain)) failures.push(`${route}: external font dependency ${domain}`);
  }

  for (const match of html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi)) {
    externalStylesheetChecks += 1;
    const href = match[0].match(/\bhref=["']([^"']+)["']/i)?.[1] || '';
    if (/^https?:\/\//i.test(href)) failures.push(`${route}: render-blocking external stylesheet ${href}`);
  }

  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    externalScriptChecks += 1;
    const src = match[1] || '';
    if (/^https?:\/\//i.test(src)) failures.push(`${route}: external script dependency ${src}`);
  }
}

if (failures.length) {
  console.error('PUBLIC_PERFORMANCE_GATE=FAIL');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log(`PUBLIC_PERFORMANCE_GATE=PASS html_scanned=${htmlScanned} external_font_checks=${externalFontChecks} external_stylesheet_checks=${externalStylesheetChecks} external_script_checks=${externalScriptChecks} failures=0`);
