import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };
const sha = value => createHash('sha256').update(value, 'utf8').digest('hex');
const root = new URL('../', import.meta.url);

const EN = 'Typical failures we test for: a CRM update applied to the wrong record, a message sent twice after a retry, a ticket marked “done” before the external system confirmed it.';
const RU = 'Типичные сбои, которые мы проверяем: изменение в CRM ушло не в ту запись, сообщение отправлено дважды после повтора, тикет помечен «готово» раньше, чем внешняя система это подтвердила.';
const TRIAGE_URL = 'https://cal.com/robert-dumanyan-vlck0x/free-20-minute-triage';
const EN_TRIAGE = 'Book a free 20-minute triage';
const RU_TRIAGE = 'Записаться на бесплатный разбор, 20 минут';

equal(sha(EN), 'ce33e2c0177865848c38dc2a64ec74827cd7e80a57805239190c862c90a07c87', 'approved EN P29.2 copy hash');
equal(sha(RU), 'c3e54d59fe1591bffd05e2fb4e88376c91e9297b72a7352c708890ad4200b870', 'approved RU P29.2 copy hash');

const enSource = await readFile(new URL('src/pages/index.astro', root), 'utf8');
const ruSource = await readFile(new URL('src/pages/ru/index.astro', root), 'utf8');
const enHtml = await readFile(new URL('dist/index.html', root), 'utf8');
const ruHtml = await readFile(new URL('dist/ru/index.html', root), 'utf8');
const currentness = JSON.parse(await readFile(new URL('src/data/sitemap-currentness.json', root), 'utf8'));
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

const enLead = 'An Agent Authority Audit is a bounded engineering review of an action-capable AI workflow: what it can change, on which object, with whose approval — and whether it has enough evidence, external confirmation and recovery control for that authority. BitEvo audits the action chain in staging or test, not the model in isolation.';
const ruLead = 'Аудит полномочий AI-агента (Agent Authority Audit) — ограниченная инженерная проверка workflow, который может действовать: что он меняет, над каким объектом, с чьего одобрения — и хватает ли ему доказательств, внешнего подтверждения и контроля восстановления для этих полномочий. BitEvo проверяет цепочку действий в staging или test, а не модель в отрыве от неё.';

for (const [name, source, html, lead, copy, actionsMarker] of [
  ['EN', enSource, enHtml, enLead, EN, '<div class="hero-actions">'],
  ['RU', ruSource, ruHtml, ruLead, RU, '<div class="hero-actions">']
]) {
  equal(source.split(copy).length - 1, 1, `${name}: exact P29.2 copy once in source`);
  equal(html.split(copy).length - 1, 1, `${name}: exact P29.2 copy once in static HTML`);
  const leadIndex = source.indexOf(lead);
  const copyIndex = source.indexOf(copy);
  const actionsIndex = source.indexOf(actionsMarker, leadIndex);
  check(leadIndex >= 0 && copyIndex > leadIndex && actionsIndex > copyIndex, `${name}: copy is immediately in hero flow after lead and before actions`);
  const between = source.slice(leadIndex + lead.length, actionsIndex);
  check(between.includes(copy), `${name}: hero lead-to-actions segment contains exact copy`);
  check(!/(?:fetch\s*\(|XMLHttpRequest|sendBeacon|<script\b|href=|src=)/i.test(between), `${name}: inserted hero segment adds no JS, network call or CTA`);
}

check(enSource.includes(EN_TRIAGE) && enSource.includes(TRIAGE_URL), 'P29.1 EN Cal.com CTA is published');
check(!ruSource.includes(RU_TRIAGE) && !ruSource.includes(TRIAGE_URL), 'RU source remains CSP-stable; P29.1 RU Cal.com CTA is emitted by bounded postprocess');
check(enHtml.includes(TRIAGE_URL) && ruHtml.includes(TRIAGE_URL), 'P29.1 verified Cal.com URL is present in both home static pages');
check(enSource.includes('$4,900'), 'existing EN price remains present');
check(ruSource.includes('$4,900'), 'existing RU price remains present');

const expected = {
  '/': { lastmod: '2026-10-05', fingerprint: 'sha256:858879ec74e74b17b3476ed23103b6f6cb213bce5429bb15df3a60e679776203' },
  '/ru': { lastmod: '2026-10-04', fingerprint: 'sha256:6102a5be4c927d0dfc247d1c947522c6ca9e1e4b94fdac625b7b2a1868285436' }
};
for (const [path, value] of Object.entries(expected)) {
  const row = currentness.routes.find(item => item.path === path);
  check(row?.lastmod === value.lastmod && row?.fingerprint === value.fingerprint, `currentness exact for ${path}`);
}
equal(currentness.routes.length, 125, 'currentness route count is exact P30 baseline');
check(packageJson.scripts?.['verify:core']?.includes('verify-p29-2-home-failure-examples-r1.mjs'), 'P29.2 verifier wired into verify:core');

console.log(`P29_2_HOME_FAILURE_EXAMPLES_R1_GATE=PASS checks=${checks} locales=2 static_html=PASS position=AFTER_LEAD_BEFORE_ACTIONS p29_1_calcom=PUBLISHED`);
