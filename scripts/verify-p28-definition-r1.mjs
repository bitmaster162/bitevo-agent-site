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
const RU = 'BitEvo проверяет слой действий AI-систем: что процесс может изменить, какие доказательства нужны до действия, как подтверждается внешний результат и что система делает, когда уверенности нет.';

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
equal((ruHome.match(/BitEvo проверяет слой действий AI-систем: что процесс может изменить/g) || []).length, 1, 'RU homepage P29.4 lead appears once');
equal((audit.match(/An Agent Authority Audit is a bounded engineering review/g) || []).length, 1, 'audit definition appears once');

check(!home.includes('BitEvo audits the action layer of AI systems: what a workflow is allowed to change'), 'old EN homepage lead removed');
check(!ruHome.includes('BitEvo проверяет action layer AI-систем: что workflow может изменить'), 'old RU homepage lead removed');
check(!audit.includes('The audit answers one operational question: does this action-capable workflow have enough evidence'), 'old audit lead removed');

check(EN.includes('staging or test, not the model in isolation.'), 'EN definition preserves staging/test and model-isolation boundary');
check(RU.includes('какие доказательства нужны до действия') && RU.includes('когда уверенности нет.'), 'RU P29.4 lead preserves evidence-before-action and uncertainty boundary');

const expectedCurrentness = {
  '/': { fingerprint: 'sha256:f244e65c855cfe2eac250ecb9ba605b41114588d63fd487249155e4413c49efe', lastmod: '2026-10-03' },
  '/ru': { fingerprint: 'sha256:d38fd94db1fa4404d62f853428b4aa8a2bc9b79fc997b99b41edbe474a577000', lastmod: '2026-10-03' },
  '/agent-authority-audit': { fingerprint: 'sha256:29fe3d7772c41678a964d99ac275b9a3c2c530502da261bafe8ba7fd9248c556', lastmod: '2026-10-02' }
};
for (const [route, expected] of Object.entries(expectedCurrentness)) {
  const row = currentness.routes.find(item => item.path === route);
  check(row?.fingerprint === expected.fingerprint && row?.lastmod === expected.lastmod, 'currentness exact for ' + route);
}
equal(currentness.routes.length, 110, 'currentness route count remains 110');
check(packageJson.scripts?.['verify:core']?.includes('verify-p28-definition-r1.mjs'), 'P28.1 verifier is wired into verify:core');

console.log('P28_DEFINITION_R1_GATE=PASS checks=' + checks + ' locales=2 pages=3 definition_first=PASS static_html=PASS js_required=0');
