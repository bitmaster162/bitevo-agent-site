import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };
const root = new URL('../', import.meta.url);
const EN = 'bitevo.work is an independent B2B AI-agent authority and evidence engineering practice and is not affiliated with unrelated cryptocurrency, wallet, token, or Web3 projects that use the BitEvo name.';
const RU = 'bitevo.work — независимая B2B-практика по полномочиям и доказательствам AI-агентов. Мы не связаны со сторонними криптовалютными, кошельковыми, токен- и Web3-проектами, которые используют имя BitEvo.';
const sha = value => createHash('sha256').update(value, 'utf8').digest('hex');

const layout = await readFile(new URL('src/layouts/Layout.astro', root), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const currentness = JSON.parse(await readFile(new URL('src/data/sitemap-currentness.json', root), 'utf8'));
const standalone = [
  'src/pages/concierge.astro',
  'src/pages/site-agent-copilot-lab.astro',
  'src/pages/site-agent-lab.astro',
  'src/pages/site-agent-fleet-desk.astro'
];

equal(sha(EN), '4a4b1fd5f735be02ac0841554ba8573492f91bd5f9cb86b50328fa3f42ed854b', 'approved EN text hash');
equal(sha(RU), 'e07a5fbf97f1963290f8d155caa82935d1c82f92dd46b11ba20c73a3f8c21c94', 'approved RU text hash');
check(layout.includes(EN) && layout.includes(RU), 'shared layout carries exact EN/RU non-affiliation text');
check(layout.includes('class="footer-non-affiliation"'), 'shared layout renders the disclosure inside footer');
for (const path of standalone) {
  const source = await readFile(new URL(path, root), 'utf8');
  check(source.includes('<footer') && source.includes(EN), `${path}: standalone footer carries exact EN disclosure`);
}

async function walkHtml(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes:true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) files.push(...await walkHtml(url));
    else if (entry.name.endsWith('.html')) files.push(url);
  }
  return files;
}

const htmlFiles = await walkHtml(new URL('dist/', root));
let enPages = 0;
let ruPages = 0;
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const footer = html.match(/<footer\b[\s\S]*?<\/footer>/i)?.[0] || '';
  const lang = html.match(/<html\b[^>]*\blang=["']([^"']+)/i)?.[1]?.toLowerCase() || '';
  const expected = lang.startsWith('ru') ? RU : EN;
  const wrong = expected === RU ? EN : RU;
  if (expected === RU) ruPages += 1; else enPages += 1;
  check(Boolean(footer), `${file.pathname}: footer exists`);
  equal(footer.split(expected).length - 1, 1, `${file.pathname}: exact locale disclosure once in footer`);
  check(!footer.includes(wrong), `${file.pathname}: no wrong-locale disclosure in footer`);
}

equal(htmlFiles.length, 128, 'all rendered HTML pages checked with F1.1 noindex source route');
equal(enPages, 71, 'EN footer coverage exact with F1.1 noindex source route');
equal(ruPages, 57, 'RU footer coverage remains exact');
equal(currentness.routes.length, 113, 'currentness route count exact on N2 baseline');
check(currentness.routes.every(row => /^\d{4}-\d{2}-\d{2}$/.test(String(row.lastmod || '')) && /^sha256:[0-9a-f]{64}$/.test(row.fingerprint)), 'all 113 currentness rows retain valid dates and fingerprints');
check(packageJson.scripts?.['verify:core']?.includes('verify-p28-non-affiliation-r1.mjs'), 'P28.4 verifier is wired into verify:core');
console.log(`P28_NON_AFFILIATION_R1_GATE=PASS checks=${checks} html=${htmlFiles.length} en=${enPages} ru=${ruPages} currentness=${currentness.routes.length} static_html=PASS js_required=0`);
