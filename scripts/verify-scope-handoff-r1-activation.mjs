import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SCOPE_HANDOFF_R1_ACTIVATION_MODE,
  SCOPE_HANDOFF_R1_ACTIVATION_SCHEMA,
  SCOPE_HANDOFF_R1_DISABLED_MARKER,
  SCOPE_HANDOFF_R1_STAGING_PROJECT_ID,
  evaluateScopeHandoffActivation,
  isScopeHandoffUiMarkerEnabled,
  readScopeHandoffRuntimeEnvironment
} from '../src/lib/scope-handoff-r1/activation.js';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks += 1; };

const exact = Object.freeze({
  VERCEL:'1',
  VERCEL_PROJECT_ID:SCOPE_HANDOFF_R1_STAGING_PROJECT_ID,
  VERCEL_ENV:'preview',
  VERCEL_TARGET_ENV:'preview',
  SCOPE_HANDOFF_R1_ACTIVATION_MODE:SCOPE_HANDOFF_R1_ACTIVATION_MODE,
  SCOPE_HANDOFF_R1_ENABLED:'true',
  SCOPE_HANDOFF_R1_UI_ENABLED:'true'
});

const disabled = evaluateScopeHandoffActivation();
equal(disabled.schema, SCOPE_HANDOFF_R1_ACTIVATION_SCHEMA, 'activation schema is exact');
equal(disabled.mode, SCOPE_HANDOFF_R1_ACTIVATION_MODE, 'activation mode is version-bound');
equal(disabled.runtimeEnabled, false, 'missing environment leaves runtime disabled');
equal(disabled.uiEnabled, false, 'missing environment leaves UI disabled');
equal(disabled.uiMarker, SCOPE_HANDOFF_R1_DISABLED_MARKER, 'missing environment emits disabled marker');
equal(disabled.runtimeReason, 'NOT_VERCEL', 'missing provider has explicit reason');
check(Object.isFrozen(disabled) && Object.isFrozen(disabled.checks), 'activation result and checks are immutable');

const enabled = evaluateScopeHandoffActivation(exact);
equal(enabled.boundary, true, 'exact staging preview satisfies immutable boundary');
equal(enabled.runtimeEnabled, true, 'exact runtime switch enables runtime only inside boundary');
equal(enabled.uiEnabled, true, 'exact UI switch enables UI only after runtime');
equal(enabled.uiMarker, SCOPE_HANDOFF_R1_ACTIVATION_MODE, 'enabled UI emits exact versioned marker');
equal(enabled.runtimeReason, 'ENABLED', 'runtime enabled reason is explicit');
equal(enabled.uiReason, 'ENABLED', 'UI enabled reason is explicit');
const runtimeOnly = evaluateScopeHandoffActivation({ ...exact, SCOPE_HANDOFF_R1_UI_ENABLED:'false' });
equal(runtimeOnly.runtimeEnabled, true, 'runtime may be isolated from the browser UI');
equal(runtimeOnly.uiEnabled, false, 'UI switch remains separately required');
equal(runtimeOnly.uiReason, 'UI_SWITCH_OFF', 'UI-off reason is explicit');

const uiWithoutRuntime = evaluateScopeHandoffActivation({ ...exact, SCOPE_HANDOFF_R1_ENABLED:'false' });
equal(uiWithoutRuntime.runtimeEnabled, false, 'runtime switch remains mandatory');
equal(uiWithoutRuntime.uiEnabled, false, 'UI cannot enable without runtime');
equal(uiWithoutRuntime.runtimeReason, 'RUNTIME_SWITCH_OFF', 'runtime-off reason is explicit');

const productionProject = evaluateScopeHandoffActivation({
  ...exact,
  VERCEL_PROJECT_ID:'prj_U2iHyiwhJlO33r0u4uN65PpdzEiv'
});
equal(productionProject.boundary, false, 'production project cannot satisfy staging binding');
equal(productionProject.runtimeEnabled, false, 'production project runtime stays disabled despite all opt-ins');
equal(productionProject.uiEnabled, false, 'production project UI stays disabled despite all opt-ins');
equal(productionProject.runtimeReason, 'PROJECT_MISMATCH', 'project mismatch is explicit');

const productionEnv = evaluateScopeHandoffActivation({ ...exact, VERCEL_ENV:'production', VERCEL_TARGET_ENV:'production' });
equal(productionEnv.runtimeEnabled, false, 'production environment cannot activate');
equal(productionEnv.uiEnabled, false, 'production environment cannot expose UI');
equal(productionEnv.runtimeReason, 'VERCEL_ENV_NOT_PREVIEW', 'production environment reason is explicit');

const targetMismatch = evaluateScopeHandoffActivation({ ...exact, VERCEL_TARGET_ENV:'staging' });
equal(targetMismatch.runtimeEnabled, false, 'custom target cannot masquerade as preview');
equal(targetMismatch.runtimeReason, 'VERCEL_TARGET_ENV_NOT_PREVIEW', 'target mismatch is explicit');

const modeMismatch = evaluateScopeHandoffActivation({ ...exact, SCOPE_HANDOFF_R1_ACTIVATION_MODE:'isolated_staging_preview_r2' });
equal(modeMismatch.runtimeEnabled, false, 'wrong activation version fails closed');
equal(modeMismatch.uiEnabled, false, 'wrong activation version blocks UI');
equal(modeMismatch.runtimeReason, 'ACTIVATION_MODE_MISMATCH', 'mode mismatch is explicit');

for (const [key, value] of [
  ['VERCEL', 'true'],
  ['SCOPE_HANDOFF_R1_ENABLED', 'TRUE'],
  ['SCOPE_HANDOFF_R1_UI_ENABLED', ' true'],
  ['VERCEL_ENV', 'Preview'],
  ['VERCEL_TARGET_ENV', 'preview ']
]) {
  const result = evaluateScopeHandoffActivation({ ...exact, [key]:value });
  check(!result.runtimeEnabled || key === 'SCOPE_HANDOFF_R1_UI_ENABLED', `${key}: exact matching is required for runtime`);
  equal(result.uiEnabled, false, `${key}: non-exact value cannot enable UI`);
}
const hostileRuntime = new Proxy({}, { get(){ throw new Error('hostile runtime getter'); } });
equal(readScopeHandoffRuntimeEnvironment(hostileRuntime), undefined, 'hostile runtime global fails closed');
equal(readScopeHandoffRuntimeEnvironment({ process:{ env:exact } }), exact, 'runtime environment helper returns the exact object without copying');

const hostile = new Proxy({}, { get(){ throw new Error('hostile getter'); } });
const hostileResult = evaluateScopeHandoffActivation(hostile);
equal(hostileResult.runtimeEnabled, false, 'hostile environment getter fails closed');
equal(hostileResult.uiEnabled, false, 'hostile environment getter cannot enable UI');

check(isScopeHandoffUiMarkerEnabled(SCOPE_HANDOFF_R1_ACTIVATION_MODE), 'exact UI marker is accepted');
for (const marker of [undefined, null, '', 'enabled', 'true', 'isolated_staging_preview_r2', `${SCOPE_HANDOFF_R1_ACTIVATION_MODE} `]) {
  equal(isScopeHandoffUiMarkerEnabled(marker), false, `marker ${String(marker)} fails closed`);
}

const api = await readFile(new URL('../api/scope-handoff.ts', import.meta.url), 'utf8');
const client = await readFile(new URL('../public/scope-handoff-r1.js', import.meta.url), 'utf8');
const enPage = await readFile(new URL('../src/pages/audit-intake.astro', import.meta.url), 'utf8');
const ruPage = await readFile(new URL('../src/pages/ru/audit-intake.astro', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const enDist = await readFile(new URL('../dist/audit-intake/index.html', import.meta.url), 'utf8');
const ruDist = await readFile(new URL('../dist/ru/audit-intake/index.html', import.meta.url), 'utf8');

check(api.includes("evaluateScopeHandoffActivation"), 'API imports the shared activation evaluator');
check(api.includes('activation.runtimeEnabled'), 'API requires the shared runtime decision');
check(!api.includes("runtimeGlobal.process?.env?.SCOPE_HANDOFF_R1_ENABLED === 'true'"), 'legacy single-variable runtime bypass is absent');
check(client.includes(`const ACTIVATION_MODE = '${SCOPE_HANDOFF_R1_ACTIVATION_MODE}'`), 'browser marker is version-bound');
check(client.includes('doc?.currentScript'), 'browser activation is bound to its build-emitted script marker');
check(client.includes('const UI_ENABLED = isUiActivationMarkerEnabled(BOOTSTRAP_ACTIVATION_MARKER)'), 'browser default is resolved by exact marker only');
check(client.includes('if (!TEST_MODE && UI_ENABLED && typeof document'), 'automatic mount remains fail-closed');
check(!client.includes(SCOPE_HANDOFF_R1_STAGING_PROJECT_ID), 'staging project ID is not exposed to browser source');

for (const [locale, page] of [['EN', enPage], ['RU', ruPage]]) {
  check(page.includes('evaluateScopeHandoffActivation(process.env)'), `${locale}: page evaluates shared build boundary`);
  check(page.includes('data-scope-handoff-r1-activation={scopeHandoffActivation.uiMarker}'), `${locale}: page emits only public-safe marker`);
}
check(pkg.scripts?.['verify:core']?.includes('verify-scope-handoff-r1-activation.mjs'), 'activation gate is wired into verify:core');

const current = evaluateScopeHandoffActivation(process.env);
const expectedAttribute = `data-scope-handoff-r1-activation="${current.uiMarker}"`;
for (const [locale, html] of [['EN', enDist], ['RU', ruDist]]) {
  check(html.includes(expectedAttribute), `${locale}: built page marker matches evaluated environment`);
  check(html.includes('src="/scope-handoff-r1.js"'), `${locale}: shared controller remains external and same-origin`);
}

console.log(`SCOPE_HANDOFF_R1_ACTIVATION_GATE=PASS checks=${checks} exact_staging_project=BOUND preview_only=PASS runtime_default=DISABLED ui_default=DISABLED current_runtime=${current.runtimeEnabled ? 'ENABLED' : 'DISABLED'} current_ui=${current.uiEnabled ? 'ENABLED' : 'DISABLED'} current_marker=${current.uiMarker} provider_writes=0`);
