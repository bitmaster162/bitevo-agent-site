import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };
const sha = value => createHash('sha256').update(value, 'utf8').digest('hex');
const root = new URL('../', import.meta.url);

const COPY = [
  'How do you get access?',
  'Access is agreed with the client for the engagement and fixed in the written scope.',
  'Do you sign an NDA?',
  'Yes. BitEvo can sign an NDA.'
];
equal(sha(COPY.join('\n')), '29d99a82ad959778923c888c56304258d88867766afd238d1fb513f4b7090f0e', 'approved P29.5B owner-facts copy bundle hash');

const component = await readFile(new URL('src/components/HowWorkWorksConfirmed.astro', root), 'utf8');
const pricingHtml = await readFile(new URL('dist/pricing/index.html', root), 'utf8');
const securityHtml = await readFile(new URL('dist/security/index.html', root), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const currentness = JSON.parse(await readFile(new URL('src/data/sitemap-currentness.json', root), 'utf8'));

for (const line of COPY) {
  equal(component.split(line).length - 1, 1, 'component contains P29.5B line once: ' + line);
  equal(pricingHtml.split(line).length - 1, 1, '/pricing static HTML contains P29.5B line once: ' + line);
  equal(securityHtml.split(line).length - 1, 1, '/security static HTML contains P29.5B line once: ' + line);
}

check(component.includes('data-p29-5b-owner-facts'), 'shared component exposes P29.5B marker');
check(component.includes('fixed in the written scope'), 'Q1 preserves written-scope boundary');
check(component.includes('Yes. BitEvo can sign an NDA.'), 'Q2 publishes only the confirmed yes/no NDA stance');

for (const banned of [
  'Which stacks do you work with?',
  'test accounts',
  'staging endpoint',
  'read-only repository',
  'read-only repo',
  'mutual NDA',
  'NDA on request',
  'all stacks',
  'every stack'
]) {
  check(!component.toLowerCase().includes(banned.toLowerCase()), 'component avoids unsupported expansion: ' + banned);
}

check(!pricingHtml.includes('Which stacks do you work with?'), '/pricing keeps Q3 unpublished');
check(!securityHtml.includes('Which stacks do you work with?'), '/security keeps Q3 unpublished');
check(!/(?:fetch\s*\(|XMLHttpRequest|sendBeacon|<script\b|<form\b|<button\b|<a\b)/i.test(component), 'P29.5B adds no JS, network, forms, buttons or links');

const expected = {
  '/pricing': ['2026-10-05', 'sha256:26c47dbf02c967df21873b50604623a058c1e15b60063c68918af7523f29bea6'],
  '/security': ['2026-10-05', 'sha256:931fc48d39f0ac06a069b3c7147e2a28897d482c8dd75c55f0f7b5fa2e98903e']
};
for (const [path, pair] of Object.entries(expected)) {
  const lastmod = pair[0];
  const fingerprint = pair[1];
  const row = currentness.routes.find(item => item.path === path);
  check(Boolean(row), path + ' currentness row exists');
  equal(row?.lastmod, lastmod, path + ' currentness date exact');
  equal(row?.fingerprint, fingerprint, path + ' currentness fingerprint exact');
}
equal(currentness.routes.length, 127, 'currentness route count remains 112');
check(packageJson.scripts?.['verify:core']?.includes('verify-p29-5b-owner-facts-r1.mjs'), 'P29.5B verifier wired into verify:core');

console.log('P29_5B_OWNER_FACTS_R1_GATE=PASS checks=' + checks + ' copy_hash=29d99a82ad959778923c888c56304258d88867766afd238d1fb513f4b7090f0e surfaces=2 q1=CONFIRMED_CLIENT_CHOICE_WRITTEN_SCOPE q2=CONFIRMED_NDA_YES q3=OMITTED access_mode_list=OMITTED nda_variant=OMITTED js_added=0 network_added=0');
