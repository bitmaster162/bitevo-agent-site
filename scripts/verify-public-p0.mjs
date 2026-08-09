import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = new URL('../dist/', import.meta.url);
const textExtensions = new Set(['.html', '.txt', '.json', '.js', '.css', '.xml', '.svg', '.map']);

const forbidden = [
  '/console/execute',
  '/console/reboot',
  '/console/shutdown',
  '7% global',
  'safe in 72',
  'безопасными за 72 часа',
  'excludes hallucinations',
  'typed memory excludes hallucinations',
  'guaranteed execution',
  'Last Checkpoint',
  'Active Frontiers',
  '34.70.171.152',
  '185.231.154.149',
  '35.217.10.153',
  '144.124.250.14',
  'arena-vps',
  'win185',
  'fin35',
  'old144',
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile() && textExtensions.has(extname(entry.name).toLowerCase())) files.push(path);
  }
  return files;
}

const distPath = root.pathname;
const files = await walk(distPath);
const violations = [];

for (const file of files) {
  const text = await readFile(file, 'utf8');
  for (const pattern of forbidden) {
    if (text.toLowerCase().includes(pattern.toLowerCase())) {
      violations.push({ file: relative(distPath, file), pattern });
    }
  }
}

if (violations.length) {
  console.error('PUBLIC_P0_CLAIM_SCAN=FAIL');
  for (const item of violations) console.error(`${item.file}: ${item.pattern}`);
  process.exit(1);
}

console.log(`PUBLIC_P0_CLAIM_SCAN=PASS files_scanned=${files.length} forbidden_patterns=${forbidden.length} occurrences=0`);
