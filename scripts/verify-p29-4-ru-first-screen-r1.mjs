import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };
const sha = value => createHash('sha256').update(value, 'utf8').digest('hex');
const root = new URL('../', import.meta.url);

const H1 = 'Агент должен заслужить полномочия доказательствами.';
const LEDE = 'BitEvo проверяет слой действий AI-систем: что процесс может изменить, какие доказательства нужны до действия, как подтверждается внешний результат и что система делает, когда уверенности нет.';
const P29_2 = 'Типичные сбои, которые мы проверяем: изменение в CRM ушло не в ту запись, сообщение отправлено дважды после повтора, тикет помечен «готово» раньше, чем внешняя система это подтвердила.';
const TRIAGE_URL = 'https://cal.com/robert-dumanyan-vlck0x/free-20-minute-triage';
const P29_1 = 'Записаться на бесплатный разбор, 20 минут';
const SIGNALS = [
  ['ОБЪЕКТ', 'один процесс, в котором агент может действовать'],
  ['ВОПРОС', 'что ему можно делать и почему'],
  ['ТЕСТ', '10–20 согласованных сценариев сбоя'],
  ['РЕШЕНИЕ', 'расширить, ограничить, исправить, перепроверить']
];
const COPY_BUNDLE = [H1, LEDE, ...SIGNALS.map(([label, value]) => `${label} — ${value}`)].join('\n');
equal(sha(COPY_BUNDLE), '6b88673b35e79864c271782ab37dec5c19d1111c17b1602460d8f563d23fe1a8', 'approved P29.4 copy bundle hash');

const source = await readFile(new URL('src/pages/ru/index.astro', root), 'utf8');
const ruLayout = await readFile(new URL('src/layouts/RuLayout.astro', root), 'utf8');
const baseLayout = await readFile(new URL('src/layouts/Layout.astro', root), 'utf8');
const html = await readFile(new URL('dist/ru/index.html', root), 'utf8');
const pricingHtml = await readFile(new URL('dist/ru/pricing/index.html', root), 'utf8');
const currentness = JSON.parse(await readFile(new URL('src/data/sitemap-currentness.json', root), 'utf8'));
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

const h1Index = source.indexOf(`<h1 class="display">${H1}</h1>`);
check(h1Index >= 0, 'RU home H1 preserved');
const h1End = source.indexOf('</h1>', h1Index);
const ledeMatch = source.slice(h1End + 5).match(/<p class="lede">([\s\S]*?)<\/p>/);
check(Boolean(ledeMatch), 'first lede after H1 exists');
equal(ledeMatch?.[1] || '', LEDE, 'RU home first lede is exact P29.4 copy');
equal((source.match(/BitEvo проверяет слой действий AI-систем:/g) || []).length, 1, 'P29.4 lede appears once in source');

for (const [label, value] of SIGNALS) {
  check(source.includes(`<small>${label}</small><strong>${value}</strong>`), `${label}: exact Russian signal row in source`);
  check(html.includes(`>${label}</small><strong`) && html.includes(`>${value}</strong>`), `${label}: exact Russian signal row in static HTML`);
}

for (const banned of ['action-capable workflow', 'failure scenarios', 'PUBLIC PRODUCT LAYER', 'ПУБЛИЧНЫЙ ПРОДУКТОВЫЙ СЛОЙ']) {
  check(!html.includes(banned), `/ru static HTML excludes first-screen/internal label: ${banned}`);
}
check(ruLayout.includes("const isRuHome = Astro.url.pathname === '/ru' || Astro.url.pathname === '/ru/';"), 'RU layout has explicit home-only condition');
check(ruLayout.includes("{isRuHome ? 'RU' : 'RU · ПУБЛИЧНЫЙ ПРОДУКТОВЫЙ СЛОЙ'}"), 'non-home RU product-layer label preserved behind home-only condition');
check(html.includes('class="ru-locale-bar"') && html.includes('href="/ru/universe"'), 'RU locale bar and Universe link preserved on home');
check(pricingHtml.includes('RU · ПУБЛИЧНЫЙ ПРОДУКТОВЫЙ СЛОЙ'), 'non-home RU locale label remains unchanged');
equal(source.split(P29_2).length - 1, 1, 'P29.2 RU failure copy remains exactly once');
equal(html.split(P29_2).length - 1, 1, 'P29.2 RU failure copy remains in static HTML');
const ledeIndex = source.indexOf(LEDE);
const failureIndex = source.indexOf(P29_2);
const actionsIndex = source.indexOf('<div class="hero-actions">', ledeIndex);
check(ledeIndex >= 0 && failureIndex > ledeIndex && actionsIndex > failureIndex, 'P29.2 failure copy remains after new lead and before hero actions');
check(html.includes(P29_1) && html.includes(TRIAGE_URL) && !source.includes(P29_1) && !source.includes(TRIAGE_URL), 'P29.1 Cal.com CTA is published in RU static HTML while source stays CSP-stable');
check(source.includes('Agent Authority & Evidence Audit') && source.includes('$4,900'), 'package name and price remain present');
check(baseLayout.includes('Authority Budget. Evidence Before Effect. False Green.'), 'Authority Budget / Evidence Before Effect / False Green terms remain unchanged');

const firstScreenStart = source.indexOf('<section class="ru-hero section">');
const firstScreenEnd = source.indexOf('<section class="section section-rule">', firstScreenStart);
const firstScreen = source.slice(firstScreenStart, firstScreenEnd);
check(firstScreenStart >= 0 && firstScreenEnd > firstScreenStart, 'RU first-screen source segment is bounded');
check(!/(?:fetch\s*\(|XMLHttpRequest|sendBeacon|<script\b|<form\b)/i.test(firstScreen), 'P29.4 first-screen copy adds no JS, network action or form');
equal((firstScreen.match(/<a\b/g) || []).length, 2, 'existing two hero CTAs preserved');

const row = currentness.routes.find(item => item.path === '/ru');
check(Boolean(row), '/ru currentness row exists');
equal(row?.lastmod, '2026-10-03', '/ru currentness date exact');
equal(row?.fingerprint, 'sha256:48a4a25f70906aee63f9583786b41a49f883bcd12a36866e38cf51193ec1aaa8', '/ru currentness fingerprint exact');
equal(currentness.routes.length, 110, 'currentness route count remains 110');
check(packageJson.scripts?.['verify:core']?.includes('verify-p29-4-ru-first-screen-r1.mjs'), 'P29.4 verifier wired into verify:core');

console.log(`P29_4_RU_FIRST_SCREEN_R1_GATE=PASS checks=${checks} copy_hash=6b88673b35e79864c271782ab37dec5c19d1111c17b1602460d8f563d23fe1a8 h1=PRESERVED lede=RUSSIAN signal_rows=4 internal_label_home=REMOVED ru_locale_bar=PRESERVED p29_2=UNCHANGED p29_1_calcom=PUBLISHED`);
