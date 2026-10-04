import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };
const sha = value => createHash('sha256').update(value, 'utf8').digest('hex');
const root = new URL('../', import.meta.url);

const COPY = [
  'How the work works',
  'What do we get at the end?',
  'Finding memo · Expected-vs-observed test matrix · Reproducible evidence pack.',
  'Sample audit evidence also exposes a machine-readable pack and a JSON download.',
  'Who does the work?',
  'Robert runs BitEvo.'
];
equal(sha(COPY.join('\n')), 'ae7506c2fb9fdeab53ae7cf8df0c1994e760f5bcfae058ae2461adfea82cc67f', 'approved P29.5A copy bundle hash');

const component = await readFile(new URL('src/components/HowWorkWorksConfirmed.astro', root), 'utf8');
const pricing = await readFile(new URL('src/pages/pricing.astro', root), 'utf8');
const security = await readFile(new URL('src/pages/security.astro', root), 'utf8');
const operator = await readFile(new URL('src/pages/operator.astro', root), 'utf8');
const entryAudit = await readFile(new URL('src/pages/entry-audit.astro', root), 'utf8');
const sampleAudit = await readFile(new URL('src/pages/sample-audit.astro', root), 'utf8');
const pricingHtml = await readFile(new URL('dist/pricing/index.html', root), 'utf8');
const securityHtml = await readFile(new URL('dist/security/index.html', root), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const currentness = JSON.parse(await readFile(new URL('src/data/sitemap-currentness.json', root), 'utf8'));

for (const line of COPY) {
  equal(component.split(line).length - 1, 1, 'component contains approved line once: ' + line);
  equal(pricingHtml.split(line).length - 1, 1, '/pricing static HTML contains approved line once: ' + line);
  equal(securityHtml.split(line).length - 1, 1, '/security static HTML contains approved line once: ' + line);
}

check(pricing.includes("import HowWorkWorksConfirmed from '../components/HowWorkWorksConfirmed.astro';") && pricing.includes('<HowWorkWorksConfirmed />'), '/pricing uses shared confirmed component');
check(security.includes("import HowWorkWorksConfirmed from '../components/HowWorkWorksConfirmed.astro';") && security.includes('<HowWorkWorksConfirmed />'), '/security uses shared confirmed component');

for (const banned of [
  'How do you get access?',
  'Do you sign an NDA?',
  'Which stacks do you work with?',
  'test accounts',
  'staging endpoint',
  'read-only repo',
  'mutual NDA'
]) {
  check(!component.toLowerCase().includes(banned.toLowerCase()), 'component omits unconfirmed P29.5 answer: ' + banned);
  check(!pricingHtml.toLowerCase().includes(banned.toLowerCase()), '/pricing omits unconfirmed P29.5 answer: ' + banned);
  check(!securityHtml.toLowerCase().includes(banned.toLowerCase()), '/security omits unconfirmed P29.5 answer: ' + banned);
}

check(pricing.includes("price: 'Free'") && pricing.includes("price: '$1,500'") && pricing.includes("price: '$4,900'"), '/pricing prices remain unchanged');
check(pricing.includes("cta: 'Book a free 20-minute triage'") && pricing.includes("cta: 'Open Entry Audit'") && pricing.includes("cta: 'Prepare Primary Audit scope'"), '/pricing P29.1 Free CTA updated while paid CTAs remain unchanged');
check(security.includes('Prepare scope brief') && security.includes('Review public proof') && security.includes('Prepare the boundary'), '/security CTAs remain unchanged');

check(entryAudit.includes('Expected-vs-observed test matrix'), 'Q4 expected-vs-observed matrix is supported by existing Entry Audit source');
check(pricing.includes('Reproducible evidence pack') && pricing.toLowerCase().includes('finding memo'), 'Q4 finding memo and reproducible evidence pack are supported by existing pricing source');
check(sampleAudit.includes('Open machine-readable pack') && sampleAudit.includes('Download JSON'), 'Q4 machine-readable pack and JSON download are supported by existing sample audit source');
check(operator.includes('<h1 class="display">Robert runs BitEvo.</h1>'), 'Q5 Robert operator fact is supported by existing operator source');

check(!/(?:fetch\s*\(|XMLHttpRequest|sendBeacon|<script\b|<form\b|<button\b|<a\b)/i.test(component), 'shared component adds no JS, network, forms, buttons or links');

for (const path of ['/pricing', '/security']) {
  const row = currentness.routes.find(item => item.path === path);
  check(Boolean(row), path + ' currentness row exists');
  equal(row?.lastmod, '2026-10-03', path + ' currentness date exact');
}
equal(currentness.routes.find(item => item.path === '/pricing')?.fingerprint, 'sha256:c8d331a2e8445395e02068ae7a4c02c7b8df221634cbf1c52565cfbdcbada1f2', '/pricing currentness fingerprint exact');
equal(currentness.routes.find(item => item.path === '/security')?.fingerprint, 'sha256:57b1b205931ee48921b2023b1add0a0088bd0e459c8e4f4e1aecc92eeb3ad2a9', '/security currentness fingerprint exact');
equal(currentness.routes.find(item => item.path === '/ru/pricing')?.fingerprint, 'sha256:586bdae1520076200a2cdbbd6e2ca1faa08076e6db4f011ebda06b51f3bd6bcd', '/ru/pricing currentness exact');
equal(currentness.routes.find(item => item.path === '/ru/security')?.fingerprint, 'sha256:77ccacea4e9cf856583f03ac7446a93a7776d1d9b12899749be21eeb3d9d77e5', '/ru/security currentness exact');
equal(currentness.routes.length, 112, 'currentness route count is exact P30 baseline');
check(packageJson.scripts?.['verify:core']?.includes('verify-p29-5a-how-work-works-confirmed-r1.mjs'), 'P29.5A verifier wired into verify:core');

console.log(`P29_5A_HOW_WORK_WORKS_CONFIRMED_R1_GATE=PASS checks=${checks} copy_hash=ae7506c2fb9fdeab53ae7cf8df0c1994e760f5bcfae058ae2461adfea82cc67f surfaces=2 q4=CONFIRMED q5=CONFIRMED q1_q2_q3=OMITTED prices=UNCHANGED free_cta=P29_1 paid_ctas=UNCHANGED currentness_rebased=P27_6`);
// P29.5A Cloudflare CI retrigger marker; no verification behavior change.
