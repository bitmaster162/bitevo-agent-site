import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {
  SCOPE_HANDOFF_R1_ACTIVATION_GLOBAL,
  SCOPE_HANDOFF_R1_ACTIVATION_MODE,
  SCOPE_HANDOFF_R1_ACTIVATION_SCHEMA,
  SCOPE_HANDOFF_R1_STAGING_PROJECT_ID,
  evaluateScopeHandoffActivation,
  isScopeHandoffRuntimeEnabled,
  isScopeHandoffUiEnabled,
  renderScopeHandoffActivationBootstrap,
  toPublicScopeHandoffActivation
} from '../src/lib/scope-handoff-r1/activation.js';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)), message);
  checks += 1;
};

const exactBase = Object.freeze({
  VERCEL:'1',
  VERCEL_PROJECT_ID:SCOPE_HANDOFF_R1_STAGING_PROJECT_ID,
  VERCEL_ENV:'preview',
  VERCEL_TARGET_ENV:'preview',
  SCOPE_HANDOFF_R1_ACTIVATION_MODE:SCOPE_HANDOFF_R1_ACTIVATION_MODE
});
const fullActivation = Object.freeze({
  ...exactBase,
  SCOPE_HANDOFF_R1_ENABLED:'true',
  SCOPE_HANDOFF_R1_UI_ENABLED:'true'
});
const disabled = evaluateScopeHandoffActivation({});
check(Object.isFrozen(disabled), 'activation evaluation is immutable');
check(disabled.schema === SCOPE_HANDOFF_R1_ACTIVATION_SCHEMA, 'activation schema is exact');
check(disabled.activation_mode === SCOPE_HANDOFF_R1_ACTIVATION_MODE, 'activation mode is exact');
check(disabled.runtime_enabled === false && disabled.ui_enabled === false, 'empty environment fails closed');
check(disabled.testing_authorization === false, 'activation never grants testing authorization');

const wrongProject = evaluateScopeHandoffActivation({
  ...fullActivation,
  VERCEL_PROJECT_ID:'prj_wrong'
});
check(!wrongProject.project_bound && !wrongProject.activation_bound, 'wrong project fails closed');
check(!wrongProject.runtime_enabled && !wrongProject.ui_enabled, 'wrong project cannot activate runtime or UI');

const production = evaluateScopeHandoffActivation({
  ...fullActivation,
  VERCEL_ENV:'production',
  VERCEL_TARGET_ENV:'production'
});
check(!production.preview_bound && !production.activation_bound, 'production environment fails closed');
check(!production.runtime_enabled && !production.ui_enabled, 'production cannot activate runtime or UI');

const mixedTarget = evaluateScopeHandoffActivation({
  ...fullActivation,
  VERCEL_TARGET_ENV:'production'
});
check(!mixedTarget.preview_bound && !mixedTarget.runtime_enabled, 'non-preview target fails closed');

const missingProvider = evaluateScopeHandoffActivation({ ...fullActivation, VERCEL:'' });
check(!missingProvider.preview_bound && !missingProvider.runtime_enabled, 'missing Vercel marker fails closed');

const wrongMode = evaluateScopeHandoffActivation({
  ...fullActivation,
  SCOPE_HANDOFF_R1_ACTIVATION_MODE:'other'
});
check(!wrongMode.activation_bound && !wrongMode.runtime_enabled, 'wrong activation mode fails closed');
const runtimeOnly = evaluateScopeHandoffActivation({
  ...exactBase,
  SCOPE_HANDOFF_R1_ENABLED:'true'
});
check(runtimeOnly.activation_bound && runtimeOnly.runtime_enabled, 'exact staging preview may enable runtime explicitly');
check(runtimeOnly.ui_enabled === false, 'runtime activation alone cannot enable UI');

const uiWithoutRuntime = evaluateScopeHandoffActivation({
  ...exactBase,
  SCOPE_HANDOFF_R1_UI_ENABLED:'true'
});
check(!uiWithoutRuntime.runtime_enabled && !uiWithoutRuntime.ui_enabled, 'UI flag alone cannot activate anything');

const enabled = evaluateScopeHandoffActivation(fullActivation);
check(enabled.provider === 'vercel', 'enabled record is Vercel-bound');
check(enabled.project_id === SCOPE_HANDOFF_R1_STAGING_PROJECT_ID, 'enabled record carries exact staging project');
check(enabled.environment === 'preview' && enabled.target_environment === 'preview', 'enabled record is preview-only');
check(enabled.project_bound && enabled.preview_bound && enabled.activation_bound, 'all binding gates are exact');
check(enabled.runtime_enabled && enabled.ui_enabled, 'exact explicit staging preview activation succeeds');
check(isScopeHandoffRuntimeEnabled(fullActivation), 'runtime helper accepts exact activation');
check(isScopeHandoffUiEnabled(fullActivation), 'UI helper accepts exact activation');
check(!isScopeHandoffRuntimeEnabled({ ...fullActivation, SCOPE_HANDOFF_R1_ENABLED:'TRUE' }), 'runtime flag is exact lowercase true');
check(!isScopeHandoffUiEnabled({ ...fullActivation, SCOPE_HANDOFF_R1_UI_ENABLED:'TRUE' }), 'UI flag is exact lowercase true');

const publicRecord = toPublicScopeHandoffActivation(fullActivation);
check(Object.isFrozen(publicRecord), 'public activation record is immutable');
equal(publicRecord, enabled, 'public activation record preserves evaluated boundary');
const bootstrap = renderScopeHandoffActivationBootstrap(publicRecord);
check(!bootstrap.includes('process.env'), 'browser bootstrap contains no environment lookup');
check(!bootstrap.includes('BLOB_READ_WRITE_TOKEN'), 'browser bootstrap contains no storage credential name');
const bootstrapContext = { Object };
bootstrapContext.globalThis = bootstrapContext;
vm.runInNewContext(bootstrap, bootstrapContext, { filename:'scope-handoff-r1-activation.js' });
equal(bootstrapContext[SCOPE_HANDOFF_R1_ACTIVATION_GLOBAL], publicRecord, 'bootstrap publishes exact public activation');
check(Object.isFrozen(bootstrapContext[SCOPE_HANDOFF_R1_ACTIVATION_GLOBAL]), 'published activation is frozen');

const generatedSource = await readFile(new URL('../public/scope-handoff-r1-activation.js', import.meta.url), 'utf8');
const generatedContext = { Object };
generatedContext.globalThis = generatedContext;
vm.runInNewContext(generatedSource, generatedContext, { filename:'generated-scope-handoff-r1-activation.js' });
const generatedRecord = generatedContext[SCOPE_HANDOFF_R1_ACTIVATION_GLOBAL];
const expectedGenerated = toPublicScopeHandoffActivation(process.env);
equal(generatedRecord, expectedGenerated, 'generated browser activation matches current build environment');
check(generatedRecord.testing_authorization === false, 'generated activation cannot grant testing authorization');

const enIntake = await readFile(new URL('../src/pages/audit-intake.astro', import.meta.url), 'utf8');
const ruIntake = await readFile(new URL('../src/pages/ru/audit-intake.astro', import.meta.url), 'utf8');
for (const [locale, source] of [['en', enIntake], ['ru', ruIntake]]) {
  const activationIndex = source.indexOf('/scope-handoff-r1-activation.js');
  const controllerIndex = source.indexOf('/scope-handoff-r1.js');
  check(activationIndex >= 0, `${locale}: activation bootstrap is referenced`);
  check(controllerIndex > activationIndex, `${locale}: activation bootstrap loads before controller`);
}

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
check(pkg.scripts?.['generate:scope-handoff-activation']?.includes('generate-scope-handoff-r1-activation.mjs'), 'activation generator script is registered');
check(pkg.scripts?.['build:site']?.includes('generate:scope-handoff-activation'), 'activation generator runs before site build');
check(pkg.scripts?.['verify:core']?.includes('verify-scope-handoff-r1-activation.mjs'), 'activation verifier is wired into core validation');

const distActivationSource = await readFile(new URL('../dist/scope-handoff-r1-activation.js', import.meta.url), 'utf8');
const distActivationContext = { Object };
distActivationContext.globalThis = distActivationContext;
vm.runInNewContext(distActivationSource, distActivationContext, { filename:'dist/scope-handoff-r1-activation.js' });
equal(distActivationContext[SCOPE_HANDOFF_R1_ACTIVATION_GLOBAL], expectedGenerated, 'dist contains the exact generated activation record');
check(!distActivationSource.includes('BLOB_READ_WRITE_TOKEN'), 'dist activation contains no storage credential name');
for (const [locale, relativePath] of [['en', '../dist/audit-intake/index.html'], ['ru', '../dist/ru/audit-intake/index.html']]) {
  const html = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  const activationIndex = html.indexOf('/scope-handoff-r1-activation.js');
  const controllerIndex = html.indexOf('/scope-handoff-r1.js');
  check(activationIndex >= 0 && controllerIndex > activationIndex, `${locale}: built activation bootstrap precedes controller`);
}
console.log(`SCOPE_HANDOFF_R1_ACTIVATION_GATE=PASS checks=${checks} project=${SCOPE_HANDOFF_R1_STAGING_PROJECT_ID} exact_preview_binding=PASS runtime_default=DISABLED ui_default=DISABLED generated_runtime=${generatedRecord.runtime_enabled ? 'ENABLED' : 'DISABLED'} generated_ui=${generatedRecord.ui_enabled ? 'ENABLED' : 'DISABLED'} testing_authorization=false`);
