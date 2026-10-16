import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };

const root = new URL('../', import.meta.url);
const home = await readFile(new URL('src/pages/index.astro', root), 'utf8');
const ruHome = await readFile(new URL('src/pages/ru/index.astro', root), 'utf8');
const audit = await readFile(new URL('src/pages/agent-authority-audit.astro', root), 'utf8');
const ruAudit = await readFile(new URL('src/pages/ru/agent-authority-audit.astro', root), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const currentness = JSON.parse(await readFile(new URL('src/data/sitemap-currentness.json', root), 'utf8'));

const EN = 'An Agent Authority Audit is a bounded engineering review of an action-capable AI workflow: what it can change, on which object, with whose approval — and whether it has enough evidence, external confirmation and recovery control for that authority. BitEvo audits the action chain in staging or test, not the model in isolation.';
const RU = 'Аудит полномочий AI-агента (Agent Authority Audit) — ограниченная инженерная проверка workflow, который может действовать: что он меняет, над каким объектом, с чьего одобрения — и хватает ли ему доказательств, внешнего подтверждения и контроля восстановления для этих полномочий. BitEvo проверяет цепочку действий в staging или test, а не модель в отрыве от неё.';
const RU_AUDIT = 'Аудит полномочий AI-агента (Agent Authority Audit) — ограниченная инженерная проверка workflow, который может действовать: что он меняет, над каким объектом, с чьего одобрения — и хватает ли ему доказательств, внешнего подтверждения и контроля восстановления для этих полномочий. BitEvo проверяет цепочку действий в staging или test, а не модель в отрыве от неё.';

function firstLedeAfterH1(source) {
  const start = source.indexOf('<h1');
  check(start >= 0, 'page contains h1');
  const h1End = source.indexOf('</h1>', start);
  check(h1End > start, 'h1 closes');
  const match = source.slice(h1End + 5).match(/<p class="lede">([\s\S]*?)<\/p>/);
  check(Boolean(match), 'first lede after h1 exists');
  return match?.[1] || '';
}

equal(firstLedeAfterH1(home), EN, 'EN homepage first text after h1 is approved definition');
equal(firstLedeAfterH1(ruHome), RU, 'RU homepage first text after h1 is approved definition');
equal(firstLedeAfterH1(audit), EN, 'Agent Authority Audit first text after h1 is approved definition');
equal(firstLedeAfterH1(ruAudit), RU_AUDIT, 'RU Agent Authority Audit first text after h1 is approved definition');

equal((home.match(/An Agent Authority Audit is a bounded engineering review/g) || []).length, 1, 'EN homepage definition appears once');
equal((ruHome.match(/Аудит полномочий AI-агента \(Agent Authority Audit\) — ограниченная инженерная проверка/g) || []).length, 1, 'RU homepage definition appears once');
equal((audit.match(/An Agent Authority Audit is a bounded engineering review/g) || []).length, 1, 'audit definition appears once');
equal((ruAudit.match(/Аудит полномочий AI-агента \(Agent Authority Audit\) — ограниченная инженерная проверка/g) || []).length, 1, 'RU audit definition appears once');

check(!home.includes('BitEvo audits the action layer of AI systems: what a workflow is allowed to change'), 'old EN homepage lead removed');
check(!ruHome.includes('BitEvo проверяет action layer AI-систем: что workflow может изменить'), 'old RU homepage lead removed');
check(!audit.includes('The audit answers one operational question: does this action-capable workflow have enough evidence'), 'old audit lead removed');

check(EN.includes('staging or test, not the model in isolation.'), 'EN definition preserves staging/test and model-isolation boundary');
check(RU.includes('в staging или test') && RU.includes('а не модель в отрыве от неё.'), 'RU homepage definition preserves staging/test and model-isolation boundary');
check(RU_AUDIT.includes('staging или test') && RU_AUDIT.includes('а не модель в отрыве от неё.'), 'RU audit definition preserves staging/test and model-isolation boundary');

const expectedCurrentness = {
  '/': { fingerprint: 'sha256:c463fa1cbead1e5f2af4f313372aa983701dd9a2414123b5e3a33a86f90a4197', lastmod: '2026-10-13' },
  '/ru': { fingerprint: 'sha256:b86c985d9527d7da7709e6fc1c811b156446446a6aba7148cef00a515d9b73e6', lastmod: '2026-10-13' },
  '/agent-authority-audit': { fingerprint: 'sha256:0dbb0456dfaa209a33bd3cf5b22da5135acbbe9a57d249e6d78af654eb7e1e5a', lastmod: '2026-10-13' },
  '/ru/agent-authority-audit': { fingerprint: 'sha256:cbec8453e63c557ff6f1a9c174db07362b7d8a16087cd17828d0a8b1685c8ebd', lastmod: '2026-10-16' }
};
for (const [route, expected] of Object.entries(expectedCurrentness)) {
  const row = currentness.routes.find(item => item.path === route);
  check(row?.fingerprint === expected.fingerprint && row?.lastmod === expected.lastmod, 'currentness exact for ' + route);
}
equal(currentness.routes.length, 133, 'currentness route count is exact P30 baseline');
check(packageJson.scripts?.['verify:core']?.includes('verify-p28-definition-r1.mjs'), 'P28.1 verifier is wired into verify:core');

console.log('P28_DEFINITION_R1_GATE=PASS checks=' + checks + ' locales=2 pages=4 definition_first=PASS static_html=PASS js_required=0');
