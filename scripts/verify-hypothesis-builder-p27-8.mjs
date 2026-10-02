import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(JSON.stringify(actual), JSON.stringify(expected), message); checks += 1; };

const root = new URL('../', import.meta.url);
const controller = await readFile(new URL('public/hypothesis-builder-p27-8.js', root), 'utf8');
const css = await readFile(new URL('public/hypothesis-builder-p27-8.css', root), 'utf8');
const en = await readFile(new URL('src/pages/diagnostic.astro', root), 'utf8');
const ru = await readFile(new URL('src/pages/ru/diagnostic.astro', root), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const currentness = JSON.parse(await readFile(new URL('src/data/sitemap-currentness.json', root), 'utf8'));

const sandbox = { __BITEVO_P27_8_TEST__: true };
sandbox.globalThis = sandbox;
vm.runInNewContext(controller, sandbox, { filename: 'hypothesis-builder-p27-8.js' });
const api = sandbox.__BITEVO_HYPOTHESIS_P27_8_TEST_API__;
check(api && typeof api.buildHypothesis === 'function', 'test API exposes pure hypothesis builder');

const allYes = Object.fromEntries(api.ORDER.map(id => [id, 'YES']));
const zero = api.buildHypothesis('en', allYes, '2026-10-02T00:00:00.000Z');
equal(zero.visible, false, '0 NO/UNKNOWN keeps hypothesis hidden');
equal(zero.rows.length, 0, '0 NO/UNKNOWN yields zero rows');

const threeUnknown = { ...allYes, action:'UNKNOWN', freshness:'UNKNOWN', recovery:'UNKNOWN' };
const three = api.buildHypothesis('en', threeUnknown, '2026-10-02T00:00:00.000Z');
equal(three.visible, true, 'NO/UNKNOWN reveals hypothesis');
equal(three.rows.length, 3, '3 UNKNOWN yields exactly 3 rows');
equal(three.rows.map(row => row.answer), ['UNKNOWN','UNKNOWN','UNKNOWN'], 'three rows preserve UNKNOWN tags');
check(three.clipboard.includes('Authority Budget [UNKNOWN]') && three.clipboard.includes('Freshness [UNKNOWN]') && three.clipboard.includes('Recovery [UNKNOWN]'), 'clipboard preserves the same three open gates');
equal((three.clipboard.match(/\[UNKNOWN\]/g) || []).length, 3, 'clipboard contains exactly three UNKNOWN tags');

const mixed = api.buildHypothesis('ru', { ...allYes, object:'NO', owner:'UNKNOWN' }, '2026-10-02T00:00:00.000Z');
equal(mixed.rows.length, 2, 'NO and UNKNOWN only produce two open-gate rows');
equal(mixed.rows.map(row => row.answer), ['NO','UNKNOWN'], 'mixed tags remain exact');
check(mixed.clipboard.includes('Привязка к объекту [NO]') && mixed.clipboard.includes('Владелец полномочия [UNKNOWN]'), 'RU clipboard uses approved gate labels');

const fullOpen = api.buildHypothesis('en', Object.fromEntries(api.ORDER.map(id => [id, 'UNKNOWN'])), '2026-10-02T00:00:00.000Z');
const prefill = api.buildScopePrefill(fullOpen, fullOpen.clipboard);
check(prefill.length <= 600, 'Scope Handoff prefill respects the existing 600-char ceiling');
for (const row of fullOpen.rows) check(prefill.includes(row.gate), 'bounded prefill keeps open gate name: ' + row.gate);
const triage = api.buildTriagePrefill(three);
check(triage.length <= 600 && triage.includes('no booking has been created'), 'triage fallback is bounded and explicitly non-booking');

check(!/\bfetch\s*\(/.test(controller), 'Hypothesis controller contains no fetch');
check(!/XMLHttpRequest|sendBeacon|WebSocket|EventSource/.test(controller), 'Hypothesis controller contains no network transport');
check(controller.includes('navigator.clipboard.writeText'), 'Copy uses local Clipboard API');
check(!/\.(?:submit|requestSubmit)\s*\(/.test(controller), 'Controller never programmatically submits a form');
check(!controller.includes('data-scope-short-consent') && !controller.includes('consent.checked'), 'Controller never changes Scope Handoff consent');
check(controller.includes('[data-scope-short-field="scope_request"]'), 'Send path targets only existing P27.1 scope_request');
check(controller.includes("field.dispatchEvent(new Event('input'"), 'Prefill only emits local input state');
check(controller.includes('no booking has been created') && controller.includes('Запись не создана'), 'Triage copy preserves no-booking boundary');

for (const [label, source, locale] of [['EN',en,'en'],['RU',ru,'ru']]) {
  check(source.includes('data-hypothesis-builder data-hypothesis-locale="' + locale + '"'), label + ': builder marker present');
  check(source.includes('href="/hypothesis-builder-p27-8.css"'), label + ': external CSS linked');
  check(source.includes('src="/hypothesis-builder-p27-8.js" defer'), label + ': external controller linked');
  const gapsIndex = source.indexOf('id="gaps"');
  const builderIndex = source.indexOf('data-hypothesis-builder');
  const boundaryIndex = source.indexOf('class="boundary"');
  check(gapsIndex >= 0 && gapsIndex < builderIndex && builderIndex < boundaryIndex, label + ': builder is between open gates and BOUNDARY');
  check(source.includes('data-hypothesis-copy') && source.includes('data-hypothesis-send') && source.includes('data-hypothesis-triage'), label + ': all three bounded actions are present');
}

check(css.includes('.hypothesis-builder[hidden]{display:none}'), 'builder CSS keeps hidden state fail-closed');
check(css.includes('[data-hypothesis-row]'), 'builder CSS styles generated gate rows');
check(packageJson.scripts?.['verify:core']?.includes('verify-hypothesis-builder-p27-8.mjs'), 'P27.8 verifier is wired into verify:core');

const currentPaths = new Set(currentness.routes.map(row => row.path));
check(currentPaths.has('/diagnostic') && currentPaths.has('/ru/diagnostic'), 'currentness manifest retains both diagnostic routes');

console.log('HYPOTHESIS_BUILDER_P27_8_GATE=PASS checks=' + checks + ' local_only=1 llm=0 network_on_copy=0 auto_post=0 consent_mutation=0 scope_prefill_max=600 triage_booking_effect=0 locales=2');
