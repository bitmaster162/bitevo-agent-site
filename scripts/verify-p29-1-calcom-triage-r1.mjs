import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };
const root = new URL('../', import.meta.url);
const TRIAGE = 'https://cal.com/robert-dumanyan-vlck0x/free-20-minute-triage';
const EN = 'Book a free 20-minute triage';
const RU = 'Записаться на бесплатный разбор, 20 минут';
const read = rel => readFile(new URL(rel, root), 'utf8');

const [
  homeSource, ruSource, pricingSource, entrySource,
  homeHtml, ruHtml, pricingHtml, entryHtml,
  tracker, llms, scopeShort
] = await Promise.all([
  read('src/pages/index.astro'),
  read('src/pages/ru/index.astro'),
  read('src/pages/pricing.astro'),
  read('src/pages/entry-audit.astro'),
  read('dist/index.html'),
  read('dist/ru/index.html'),
  read('dist/pricing/index.html'),
  read('dist/entry-audit/index.html'),
  read('public/triage-click.js'),
  read('src/pages/llms.txt.ts'),
  read('src/components/ScopeHandoffShort.astro')
]);

const strip = value => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
function triageAnchors(html, text, source) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].filter(match => {
    const attrs = match[1] || '';
    const href = attrs.match(/\bhref=["']([^"']+)["']/i)?.[1];
    return href === TRIAGE &&
      strip(match[2] || '').includes(text) &&
      attrs.includes('data-triage-click="true"') &&
      attrs.includes(`data-triage-source="${source}"`);
  });
}

for (const [label, html, text, source] of [
  ['home-en', homeHtml, EN, 'home-en'],
  ['home-ru', ruHtml, RU, 'home-ru'],
  ['pricing-free', pricingHtml, EN, 'pricing-free'],
  ['entry-audit', entryHtml, EN, 'entry-audit']
]) {
  equal(triageAnchors(html, text, source).length, 1, `${label}: one exact Cal.com triage CTA`);
}

check(homeSource.includes('<ScopeHandoffShort locale="en" offer="triage" />'), 'EN home reuses P27.1 short scope component');
check(!ruSource.includes(TRIAGE) && ruSource.includes('Собрать карту workflow') && ruHtml.includes('data-scope-offer="triage"'), 'RU home keeps CSP-stable source and reuses rendered P27.1 short scope through bounded postprocess');
check(pricingSource.includes('ScopeHandoffShort locale="en" offer="pricing"'), 'pricing retains P27.1 short scope component');
check(entrySource.includes('ScopeHandoffShort locale="en" offer="entry_audit"'), 'entry audit retains P27.1 short scope component');
check(scopeShort.includes('Five fields, explicit consent and no secrets.'), 'P27.1 EN short-scope copy preserved');
check(scopeShort.includes('Пять полей, явное согласие и никаких secrets.'), 'P27.1 RU short-scope copy preserved');

for (const [label, html, secondary] of [
  ['home-en', homeHtml, 'Send a short scope'],
  ['home-ru', ruHtml, 'Отправить короткий scope'],
  ['pricing', pricingHtml, 'Send a short scope'],
  ['entry-audit', entryHtml, 'Send a short scope']
]) {
  check(html.includes('href="#send-scope"') && html.includes(secondary), `${label}: secondary CTA opens existing short scope`);
  check(html.includes('src="/triage-click.js"'), `${label}: local triage click tracker is loaded`);
}

check(pricingSource.includes("price: 'Free'") && pricingSource.includes("price: '$1,500'") && pricingSource.includes("price: '$4,900'"), 'pricing values remain unchanged');
check(pricingSource.includes("cta: 'Open Entry Audit'") && pricingSource.includes("cta: 'Prepare Primary Audit scope'"), 'paid pricing CTAs remain unchanged');
check(entrySource.includes('href="/audit-intake?offer=entry-audit"') && entrySource.includes('Prepare the bounded scope'), 'Entry Audit paid scope CTA remains available');
check(pricingHtml.includes('Contact Robert'), 'pricing retains Contact Robert handoff');

check(tracker.includes("const EVENT = 'triage_click'"), 'tracker uses exact triage_click event');
check(tracker.includes('new CustomEvent(EVENT') && tracker.includes('dispatchEvent'), 'tracker dispatches first-party local event');
check(tracker.includes('globalThis.dataLayer') && tracker.includes('queue.push(detail)'), 'tracker queues local dataLayer event');
check(tracker.includes("addEventListener('click'") && tracker.includes('{ capture: true }'), 'tracker observes click before navigation');
check(!/(fetch\s*\(|XMLHttpRequest|sendBeacon|gtag\s*\(|plausible|posthog|mixpanel)/i.test(tracker), 'tracker adds no external analytics or network transport');
check(!tracker.includes('preventDefault'), 'tracker does not block Cal.com navigation');
check(llms.includes(TRIAGE) && llms.includes('verified Cal.com booking page'), 'llms manifest documents verified triage booking');

const currentness = JSON.parse(await read('src/data/sitemap-currentness.json'));
const packageJson = JSON.parse(await read('package.json'));
const expected = {
  '/': ['2026-10-05', 'sha256:858879ec74e74b17b3476ed23103b6f6cb213bce5429bb15df3a60e679776203'],
  '/ru': ['2026-10-04', 'sha256:6102a5be4c927d0dfc247d1c947522c6ca9e1e4b94fdac625b7b2a1868285436'],
  '/pricing': ['2026-10-05', 'sha256:d4a8fe52df7aee055bf542d14a591612499e8adcaaa024508a59fc001053489b'],
  '/entry-audit': ['2026-10-05', 'sha256:b8d48c7f624af9fcfd977ca17011b2d2ffe6263fae56bd316fb041bb77343167']
};
for (const [route, [lastmod, fingerprint]] of Object.entries(expected)) {
  const row = currentness.routes.find(item => item.path === route);
  check(Boolean(row), `${route}: currentness row exists`);
  equal(row?.lastmod, lastmod, `${route}: currentness date exact`);
  equal(row?.fingerprint, fingerprint, `${route}: currentness fingerprint exact`);
}
equal(currentness.routes.length, 113, 'currentness route count is exact P30 baseline');
check(packageJson.scripts?.['verify:core']?.includes('verify-p29-1-calcom-triage-r1.mjs'), 'P29.1 verifier is wired into verify:core');

check(homeSource.includes('Typical failures we test for:'), 'P29.2 EN failure examples remain present');
check(ruSource.includes('Типичные сбои, которые мы проверяем:'), 'P29.2 RU failure examples remain present');

console.log(`P29_1_CALCOM_TRIAGE_R1_GATE=PASS checks=${checks} surfaces=4 locales=2 triage_url=BOUND secondary_scope=P27_1 triage_click=LOCAL_QUEUE_ONLY external_analytics=0 prices=UNCHANGED`);
