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
check(pricing.includes('The Free, Entry and Primary scope-preparation CTAs'), 'EN pricing preserves public-quality CTA anchor');
check(pricing.includes('The Scope Handoff form sends only the fields you fill after explicit consent.'), 'EN pricing states filled-fields + consent boundary');
check(pricing.includes('Accepted records are stored privately for up to 30 days.'), 'EN pricing states 30-day retention');
check(pricing.includes('Submission does not create a booking and does not authorize testing.'), 'EN pricing preserves booking/testing boundary');
check(!pricing.includes('nothing is transmitted by the public intake'), 'EN stale local-only intake claim removed');
check(pricing.includes('ScopeHandoffShort locale="en" offer="pricing"'), 'EN pricing keeps P27.1 receiver');
check(ruPricing.includes('Форма Scope Handoff отправляет только заполненные вами поля после явного согласия.'), 'RU pricing states filled-fields + consent boundary');
check(ruPricing.includes('Принятые записи хранятся приватно до 30 дней.'), 'RU pricing states 30-day retention');
check(ruPricing.includes('Отправка не создаёт booking и не выдаёт testing authorization.'), 'RU pricing preserves booking/testing boundary');
check(!ruPricing.includes('Публичный сайт помогает подготовить локальный scope brief.'), 'RU stale local-only hero claim removed');
check(!ruPricing.includes('не отправляет audit request'), 'RU stale no-submit claim removed');
check(ruPricing.includes('ScopeHandoffShort locale="ru" offer="pricing"'), 'RU pricing keeps P27.1 receiver');
check(llms.includes('Public Homepage, Pricing/Consulting and Agent Authority Audit scope-preparation CTAs'), 'llms preserves public-quality CTA anchor');
check(llms.includes('including the Primary Audit path'), 'llms preserves Primary Audit anchor');
check(llms.includes('they do not book or submit an engagement'), 'llms preserves no-book/no-engagement CTA anchor');
check(llms.includes('Scope Handoff form is available, it sends only fields the user fills after explicit consent'), 'llms describes consent-gated filled-fields submission');
check(llms.includes('accepted records are stored privately for up to 30 days'), 'llms states retention horizon');
check(llms.includes('Submission does not create a booking and does not authorize testing.'), 'llms preserves booking/testing boundary');
check(!llms.includes('prepare a local scope brief only; they do not book or submit an engagement'), 'llms stale local-only claim removed');
check(short.includes('explicit consent') && short.includes('up to 30 days'), 'shared P27.1 component keeps consent and retention disclosure');
check(short.includes('does not authorize testing or execution'), 'shared P27.1 component keeps authorization boundary');
const expected = {"/pricing":"sha256:26dae95a1feb6563989b4605c471ae7a0929475a2567e6e64b19178ec29efa4b","/ru/pricing":"sha256:622860e85cd2ce4a521e6e0e90b5d3439f41c7e2bf26d24de84b16ecd5e7ad62","/agent-authority-audit":"sha256:db6c81fbaff4700abc5d0575dec18d37e1abc45f865ccd9c8152dc7b8472f71e"};
for (const [path, fingerprint] of Object.entries(expected)) {
  const row = currentness.routes.find(item => item.path === path);
  check(row?.fingerprint === fingerprint && row?.lastmod === '2026-10-02', 'currentness exact for ' + path);
}
check(currentness.routes.length === 108, 'currentness route count remains 108');
check(packageJson.scripts?.['verify:core']?.includes('verify-p28-intake-copy-r1.mjs'), 'P28 intake copy verifier is wired into verify:core');

console.log('P28_INTAKE_COPY_R1_GATE=PASS checks=' + checks + ' scope=UP_TO_3_TOOLS_APIS_MCP consent=EXPLICIT retention=UP_TO_30D booking=0 testing_authorization=0 stale_local_only_claims=0 locales=2');
