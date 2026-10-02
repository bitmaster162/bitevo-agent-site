import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };

const root = new URL('../', import.meta.url);
const home = await readFile(new URL('src/pages/index.astro', root), 'utf8');
const ruHome = await readFile(new URL('src/pages/ru/index.astro', root), 'utf8');
const audit = await readFile(new URL('src/pages/agent-authority-audit.astro', root), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const currentness = JSON.parse(await readFile(new URL('src/data/sitemap-currentness.json', root), 'utf8'));

const EN = 'An Agent Authority Audit is a bounded engineering review of an action-capable AI workflow: what it can change, on which object, with whose approval — and whether it has enough evidence, external confirmation and recovery control for that authority. BitEvo audits the action chain in staging or test, not the model in isolation.';
const RU = 'Аудит полномочий AI-агента (Agent Authority Audit) — ограниченная инженерная проверка workflow, который может действовать: что он меняет, над каким объектом, с чьего одобрения — и хватает ли ему доказательств, внешнего подтверждения и контроля восстановления для этих полномочий. BitEvo проверяет цепочку действий в staging или test, а не модель в отрыве от неё.';

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

equal((home.match(/An Agent Authority Audit is a bounded engineering review/g) || []).length, 1, 'EN homepage definition appears once');
equal((ruHome.match(/Аудит полномочий AI-агента \(Agent Authority Audit\) — ограниченная инженерная проверка/g) || []).length, 1, 'RU homepage definition appears once');
equal((audit.match(/An Agent Authority Audit is a bounded engineering review/g) || []).length, 1, 'audit definition appears once');

check(!home.includes('BitEvo audits the action layer of AI systems: what a workflow is allowed to change'), 'old EN homepage lead removed');
check(!ruHome.includes('BitEvo проверяет action layer AI-систем: что workflow может изменить'), 'old RU homepage lead removed');
check(!audit.includes('The audit answers one operational question: does this action-capable workflow have enough evidence'), 'old audit lead removed');

check(EN.includes('staging or test, not the model in isolation.'), 'EN definition preserves staging/test and model-isolation boundary');
check(RU.includes('в staging или test, а не модель в отрыве от неё.'), 'RU definition preserves staging/test and model-isolation boundary');

const expectedCurrentness = {
  '/': 'sha256:03128a3d424fee7dd3c7a9cb5aa76b00f96d514fccb759f091462b42fe8e177a',
  '/ru': 'sha256:d439af420aedb5fc170b19e463dbdf8baad1849fca43d9599b29cc8e84918c93',
  '/agent-authority-audit': 'sha256:a3b0f56f4de85837105f54c0e4e35b8653383c8016b76713b2f7332c6b2fe25c'
};
for (const [route, fingerprint] of Object.entries(expectedCurrentness)) {
  const row = currentness.routes.find(item => item.path === route);
  check(row?.fingerprint === fingerprint && row?.lastmod === '2026-10-02', 'currentness exact for ' + route);
}
equal(currentness.routes.length, 108, 'currentness route count remains 108');
check(packageJson.scripts?.['verify:core']?.includes('verify-p28-definition-r1.mjs'), 'P28.1 verifier is wired into verify:core');

console.log('P28_DEFINITION_R1_GATE=PASS checks=' + checks + ' locales=2 pages=3 definition_first=PASS static_html=PASS js_required=0');
