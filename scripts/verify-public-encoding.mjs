import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { TextDecoder } from 'node:util';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const failures = [];
const decoder = new TextDecoder('utf-8', { fatal: true });
const textExtensions = new Set(['.html', '.json', '.xml', '.txt', '.css', '.js']);
const humanExtensions = new Set(['.html', '.json', '.xml', '.txt']);
const mojibakeTokens = [
  'Р°', 'Р±', 'РІ', 'Рі', 'Рґ', 'Рµ', 'Р¶', 'Р·', 'Рё', 'Р№', 'Рє', 'Р»', 'Рј', 'РЅ', 'Рѕ', 'Рї',
  'СЂ', 'СЃ', 'С‚', 'Сѓ', 'С„', 'С…', 'С†', 'С‡', 'С€', 'С‰', 'СЉ', 'С‹', 'СЊ', 'СЌ', 'СЋ', 'СЏ'
];

const walk = async dir => {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else out.push(path);
  }
  return out;
};

const withoutExecutableBlocks = text => text
  .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi, ' ');

let textFiles = 0;
let htmlFiles = 0;
let ruHtmlFiles = 0;
let questionRuns = 0;
let replacementChars = 0;
let mojibakeHits = 0;

for (const path of await walk(dist)) {
  const ext = extname(path).toLowerCase();
  if (!textExtensions.has(ext)) continue;
  textFiles += 1;
  const rel = relative(dist, path).replaceAll('\\', '/');
  const raw = await readFile(path);
  let text;
  try {
    text = decoder.decode(raw);
  } catch {
    failures.push(`${rel}: invalid UTF-8 byte sequence`);
    continue;
  }
  const replacements = (text.match(/\uFFFD/g) || []).length;
  if (replacements) {
    replacementChars += replacements;
    failures.push(`${rel}: replacement character U+FFFD x${replacements}`);
  }
  if (ext === '.html') {
    htmlFiles += 1;
    if (rel === 'ru/index.html' || rel.startsWith('ru/')) ruHtmlFiles += 1;
  }
  if (!humanExtensions.has(ext)) continue;
  const human = ext === '.html' ? withoutExecutableBlocks(text) : text;
  const qs = human.match(/\?{3,}/g) || [];
  if (qs.length) {
    questionRuns += qs.length;
    failures.push(`${rel}: suspicious question-mark run x${qs.length}`);
  }
  const hits = mojibakeTokens.filter(token => human.includes(token));
  if (hits.length) {
    mojibakeHits += hits.length;
    failures.push(`${rel}: mojibake markers ${hits.slice(0, 6).join(', ')}`);
  }
}

if (failures.length) {
  console.error('PUBLIC_ENCODING_GATE=FAIL');
  failures.forEach(x => console.error(x));
  process.exit(1);
}
console.log(`PUBLIC_ENCODING_GATE=PASS text_files=${textFiles} html=${htmlFiles} ru_html=${ruHtmlFiles} strict_utf8=PASS question_runs=${questionRuns} replacement_chars=${replacementChars} mojibake=${mojibakeHits} failures=0`);
