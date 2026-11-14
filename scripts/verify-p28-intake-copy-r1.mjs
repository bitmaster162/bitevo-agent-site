import { isExactRGapsSuccessor, rgapsExpectedFingerprint } from './r-gaps1-route-successor-r1.mjs';
import { isExactGuides34Successor } from './guides34-route-successor-r1.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };

const root = new URL('../', import.meta.url);
const audit = await readFile(new URL('src/pages/agent-authority-audit.astro', root), 'utf8');
const pricing = await readFile(new URL('src/pages/pricing.astro', root), 'utf8');
const ruPricing = await readFile(new URL('src/pages/ru/pricing.astro', root), 'utf8');
const llms = await readFile(new URL('src/pages/llms.txt.ts', root), 'utf8');
const short = await readFile(new URL('src/components/ScopeHandoffShort.astro', root), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const currentness = JSON.parse(await readFile(new URL('src/data/sitemap-currentness.json', root), 'utf8'));

check(audit.includes('Up to 3 tools / APIs / MCP servers'), 'Primary Audit uses exact tools/APIs/MCP scope');
check(!audit.includes('Up to 3 integrations'), 'stale integrations-only label removed');
check(pricing.includes('The Free triage CTA opens the verified external Cal.com booking page'), 'EN pricing exposes verified external Free triage booking');
check(pricing.includes('The Scope Handoff form sends only the fields you fill after explicit consent.'), 'EN pricing states filled-fields + consent boundary');
check(pricing.includes('Accepted records are stored privately for up to 30 days.'), 'EN pricing states 30-day retention');
check(pricing.includes('Submission through the Scope Handoff form does not create a booking and does not authorize testing.'), 'EN pricing preserves scope-form booking/testing boundary');
check(pricing.includes('The Free, Entry and Primary scope-preparation CTAs remain separate from the external booking flow.'), 'EN pricing separates scope preparation from external booking');
check(!pricing.includes('nothing is transmitted by the public intake'), 'EN stale local-only intake claim removed');
check(pricing.includes('ScopeHandoffShort locale="en" offer="pricing"'), 'EN pricing keeps P27.1 receiver');
check(ruPricing.includes('Форма Scope Handoff отправляет только заполненные вами поля после явного согласия.'), 'RU pricing states filled-fields + consent boundary');
check(ruPricing.includes('Принятые записи хранятся приватно до 30 дней.'), 'RU pricing states 30-day retention');
check(ruPricing.includes('Отправка не создаёт booking и не выдаёт testing authorization.'), 'RU pricing preserves booking/testing boundary');
check(!ruPricing.includes('Публичный сайт помогает подготовить локальный scope brief.'), 'RU stale local-only hero claim removed');
check(!ruPricing.includes('не отправляет audit request'), 'RU stale no-submit claim removed');
check(ruPricing.includes('ScopeHandoffShort locale="ru" offer="pricing"'), 'RU pricing keeps P27.1 receiver');
check(!ruPricing.includes('Ссылка открывает почтовое приложение; ничего не отправляется автоматически. Сначала выберите scope или подготовьте локальный brief, затем передайте только те детали, которые намерены отправить.'), 'RU pricing P28.3 stale auto-send sentence absent');
check(ruPricing.includes('Диагностика и mapper работают в браузере и ничего не отправляют. Форма scope отправляет только заполненные поля и только после согласия; заявки хранятся 30 дней, затем удаляются.'), 'RU pricing P28.3 exact browser/form/consent/30d deletion copy present');
check(llms.includes('Free / 20 minutes booking CTAs on the Homepage, Pricing, Entry Audit and Agent Authority Audit surfaces open the verified Cal.com booking page'), 'llms exposes verified Free triage booking');
check(llms.includes('The separate Scope Handoff form sends only fields the user fills after explicit consent'), 'llms describes consent-gated filled-fields submission');
check(llms.includes('accepted records are stored privately for up to 30 days'), 'llms states retention horizon');
check(llms.includes('Submission through that form does not create a booking and does not authorize testing.'), 'llms preserves scope-form booking/testing boundary');
check(llms.includes('Other scope-preparation CTAs do not book or submit an engagement by themselves.'), 'llms preserves non-booking semantics for other scope CTAs');
check(!llms.includes('prepare a local scope brief only; they do not book or submit an engagement'), 'llms stale local-only claim removed');
check(short.includes('explicit consent') && short.includes('up to 30 days'), 'shared P27.1 component keeps consent and retention disclosure');
check(short.includes('does not authorize testing or execution'), 'shared P27.1 component keeps authorization boundary');
const expected = {
  "/pricing": { fingerprint: "sha256:ff9fbd2ed323c8fc88e7dc146af2a6aef058e08e7a12ff70cd18c04ff82b27c8", lastmod: "2026-11-14" },
  "/ru/pricing": { fingerprint: "sha256:85b3363aaef2c08328348763f24ef6980c22393fb14e137531b11b139d152093", lastmod: "2026-11-14" },
  "/agent-authority-audit": { fingerprint: "sha256:fc7dc51e9773c10d8332ca0308816cae83a69c5ed965a6f5ed1265ceff7c2e60", lastmod: "2026-11-14" }
};
for (const [path, value] of Object.entries(expected)) {
  const row = currentness.routes.find(item => item.path === path);
  check(row?.fingerprint === rgapsExpectedFingerprint(path, value.fingerprint) && row?.lastmod === value.lastmod, 'currentness exact for ' + path);
}
check(currentness.routes.length === ((isExactRGapsSuccessor() ? 142 : (isExactGuides34Successor() ? 137 : 133))), 'currentness route count is exact post-C6+N1 baseline');
check(packageJson.scripts?.['verify:core']?.includes('verify-p28-intake-copy-r1.mjs'), 'P28 intake copy verifier is wired into verify:core');

console.log('P28_INTAKE_COPY_R1_GATE=PASS checks=' + checks + ' scope=UP_TO_3_TOOLS_APIS_MCP consent=EXPLICIT retention=UP_TO_30D triage_booking_link=1 scope_form_booking=0 testing_authorization=0 stale_local_only_claims=0 locales=2');
