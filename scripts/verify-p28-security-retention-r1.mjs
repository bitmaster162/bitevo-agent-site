import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };
const sha = value => createHash('sha256').update(value, 'utf8').digest('hex');
const root = new URL('../', import.meta.url);
const enSource = await readFile(new URL('src/pages/security.astro', root), 'utf8');
const ruSource = await readFile(new URL('src/data/ru-semantic-parity.json', root), 'utf8');
const ruTemplate = await readFile(new URL('src/pages/ru/[...slug].astro', root), 'utf8');
const enHtml = await readFile(new URL('dist/security/index.html', root), 'utf8');
const ruHtml = await readFile(new URL('dist/ru/security/index.html', root), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const currentness = JSON.parse(await readFile(new URL('src/data/sitemap-currentness.json', root), 'utf8'));

const HEADING = 'What we keep, and for how long';
const EN_SCOPE = 'Scope requests from the site: only the fields you submit, kept for 30 days, then deleted. Telegram alerts to Robert carry no personal data.';
const EN_EVIDENCE = 'Engagement evidence: the exact set, retention and access path are fixed in the written scope before testing starts.';
const RU_SCOPE = 'Заявки с сайта: только отправленные поля, хранятся 30 дней, затем удаляются. Уведомления Robert в Telegram не содержат персональных данных.';
const RU_EVIDENCE = 'Доказательства по проекту: состав, срок хранения и доступ фиксируются в письменном scope до начала тестов.';

equal(sha(HEADING), '9602aac687578bbf88d2ffa843da71607f77e1f2d737366ce7ca5b7d3a01a897', 'approved EN heading hash');
equal(sha(EN_SCOPE), 'f3e6eaa74a08227be0d9d5d23c61e5bd3526ef4c325b8decc9698f70276a1885', 'approved EN scope-request hash');
equal(sha(EN_EVIDENCE), 'b181caad33ee4356bfa1d7e71593f24ce01d08c593705111bb9fe42f16f3f411', 'approved EN evidence hash');
equal(sha(RU_SCOPE), 'c3eaea5b19955e7ecea4c0229b2f7b17dc6ae9b66009f996ed09e531bf8c60c9', 'approved RU scope-request hash');
equal(sha(RU_EVIDENCE), 'd3c5ebb28e7c6da0c16adf61a265dfda3130fe84a6be6bc09e7d8127ed63a289', 'approved RU evidence hash');
check(enSource.indexOf('Evidence handled in scope') < enSource.indexOf(HEADING), 'EN retention block follows evidence-handled section');
check(enSource.indexOf(HEADING) < enSource.indexOf('Public intake boundary'), 'EN retention block precedes public-intake boundary');
check(enSource.includes(EN_SCOPE) && enSource.includes(EN_EVIDENCE), 'EN source keeps exact confirmed facts');
check(ruSource.includes(RU_SCOPE) && ruSource.includes(RU_EVIDENCE), 'RU parity data keeps exact confirmed facts');
check(ruTemplate.includes("page.slug === 'security'") && ruTemplate.includes('page.retentionFacts'), 'RU template renders retention block only for security');
for (const [label, html, facts] of [['EN', enHtml, [HEADING, EN_SCOPE, EN_EVIDENCE]], ['RU', ruHtml, [RU_SCOPE, RU_EVIDENCE]]]) {
  for (const fact of facts) equal(html.split(fact).length - 1, 1, `${label}: approved retention text appears once in static HTML`);
  check(!html.includes('we sign a mutual NDA on request before you share non-public details'), `${label}: unconfirmed EN NDA claim omitted`);
  check(!html.includes('your data is not used to train AI models'), `${label}: unconfirmed EN model-training claim omitted`);
  check(!html.includes('подписываем взаимное NDA по запросу до передачи закрытых данных'), `${label}: unconfirmed RU NDA claim omitted`);
  check(!html.includes('ваши данные не используются для обучения AI-моделей'), `${label}: unconfirmed RU model-training claim omitted`);
}
const expected = {
  '/security': { fingerprint:'sha256:dd99b4245ad155b3db9d627696ff2260506271b6ca55bae48ffccf82ea25b717', lastmod:'2026-10-04' },
  '/ru/security': { fingerprint:'sha256:77ccacea4e9cf856583f03ac7446a93a7776d1d9b12899749be21eeb3d9d77e5', lastmod:'2026-10-03' }
};
for (const [path, value] of Object.entries(expected)) {
  const row = currentness.routes.find(item => item.path === path);
  check(row?.lastmod === value.lastmod && row?.fingerprint === value.fingerprint, `currentness exact for ${path}`);
}
equal(currentness.routes.length, 112, 'currentness route count is exact P30 baseline');
check(packageJson.scripts?.['verify:core']?.includes('verify-p28-security-retention-r1.mjs'), 'P28.5 verifier is wired into verify:core');
console.log(`P28_SECURITY_RETENTION_R1_GATE=PASS checks=${checks} routes=2 static_html=PASS nda_unconfirmed=OMITTED model_training_unconfirmed=OMITTED js_required=0`);
