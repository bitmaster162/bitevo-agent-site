import { readdir, stat } from 'node:fs/promises';
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

const limits = {
  jsTotal: 320 * 1024,
  jsSingle: 180 * 1024,
  cssTotal: 220 * 1024,
  cssSingle: 140 * 1024,
  imageTotal: 2 * 1024 * 1024,
  distTotal: 6 * 1024 * 1024
};

const files = await walk(distPath);
const failures = [];
let jsTotal = 0;
let cssTotal = 0;
let imageTotal = 0;
let distTotal = 0;
let jsFiles = 0;
let cssFiles = 0;
let imageFiles = 0;

for (const file of files) {
  const size = (await stat(file)).size;
  const name = relative(distPath, file).split(sep).join('/');
  const ext = extname(file).toLowerCase();
  distTotal += size;

  if (ext === '.js' || ext === '.mjs') {
    jsFiles += 1;
    jsTotal += size;
    if (size > limits.jsSingle) failures.push(`${name}: JS asset ${size} exceeds ${limits.jsSingle}`);
  }
  if (ext === '.css') {
    cssFiles += 1;
    cssTotal += size;
    if (size > limits.cssSingle) failures.push(`${name}: CSS asset ${size} exceeds ${limits.cssSingle}`);
  }
  if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.avif'].includes(ext)) {
    imageFiles += 1;
    imageTotal += size;
  }
}

if (jsTotal > limits.jsTotal) failures.push(`total JS ${jsTotal} exceeds ${limits.jsTotal}`);
if (cssTotal > limits.cssTotal) failures.push(`total CSS ${cssTotal} exceeds ${limits.cssTotal}`);
if (imageTotal > limits.imageTotal) failures.push(`total images ${imageTotal} exceeds ${limits.imageTotal}`);
if (distTotal > limits.distTotal) failures.push(`total dist ${distTotal} exceeds ${limits.distTotal}`);

if (failures.length) {
  console.error('PUBLIC_BUDGET_GATE=FAIL');
  for (const failure of failures) console.error(failure);
  console.error(`PUBLIC_BUDGET_RECEIPT js_files=${jsFiles} js_bytes=${jsTotal} css_files=${cssFiles} css_bytes=${cssTotal} image_files=${imageFiles} image_bytes=${imageTotal} dist_bytes=${distTotal}`);
  process.exit(1);
}

console.log(`PUBLIC_BUDGET_GATE=PASS js_files=${jsFiles} js_bytes=${jsTotal} css_files=${cssFiles} css_bytes=${cssTotal} image_files=${imageFiles} image_bytes=${imageTotal} dist_bytes=${distTotal} failures=0`);
