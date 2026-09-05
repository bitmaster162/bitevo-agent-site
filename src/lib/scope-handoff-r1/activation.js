export const SCOPE_HANDOFF_R1_ACTIVATION_SCHEMA = 'bitevo.scope-handoff.activation.v1';
export const SCOPE_HANDOFF_R1_ACTIVATION_MODE = 'staging_preview_r1';
export const SCOPE_HANDOFF_R1_STAGING_PROJECT_ID = 'prj_zQ1Mb8RJA6zCrZbPfC2z3dWFcfZI';
export const SCOPE_HANDOFF_R1_ACTIVATION_GLOBAL = '__BITEVO_SCOPE_HANDOFF_R1_ACTIVATION__';

const exact = (env, key, expected) => env?.[key] === expected;

export function evaluateScopeHandoffActivation(env = {}) {
  const providerBound = exact(env, 'VERCEL', '1');
  const projectBound = exact(env, 'VERCEL_PROJECT_ID', SCOPE_HANDOFF_R1_STAGING_PROJECT_ID);
  const environmentBound = exact(env, 'VERCEL_ENV', 'preview');
  const targetEnvironmentBound = exact(env, 'VERCEL_TARGET_ENV', 'preview');
  const modeBound = exact(env, 'SCOPE_HANDOFF_R1_ACTIVATION_MODE', SCOPE_HANDOFF_R1_ACTIVATION_MODE);
  const runtimeRequested = exact(env, 'SCOPE_HANDOFF_R1_ENABLED', 'true');
  const uiRequested = exact(env, 'SCOPE_HANDOFF_R1_UI_ENABLED', 'true');
  const previewBound = providerBound && environmentBound && targetEnvironmentBound;
  const activationBound = previewBound && projectBound && modeBound;
  const runtimeEnabled = activationBound && runtimeRequested;
  const uiEnabled = runtimeEnabled && uiRequested;

  return Object.freeze({
    schema:SCOPE_HANDOFF_R1_ACTIVATION_SCHEMA,
    activation_mode:SCOPE_HANDOFF_R1_ACTIVATION_MODE,
    provider:providerBound ? 'vercel' : 'unbound',
    project_id:projectBound ? SCOPE_HANDOFF_R1_STAGING_PROJECT_ID : '',
    environment:environmentBound ? 'preview' : 'unbound',
    target_environment:targetEnvironmentBound ? 'preview' : 'unbound',
    project_bound:projectBound,
    preview_bound:previewBound,
    activation_bound:activationBound,
    runtime_enabled:runtimeEnabled,
    ui_enabled:uiEnabled,
    testing_authorization:false
  });
}

export function isScopeHandoffRuntimeEnabled(env = {}) {
  return evaluateScopeHandoffActivation(env).runtime_enabled;
}

export function isScopeHandoffUiEnabled(env = {}) {
  return evaluateScopeHandoffActivation(env).ui_enabled;
}

export function toPublicScopeHandoffActivation(env = {}) {
  const evaluated = evaluateScopeHandoffActivation(env);
  return Object.freeze({ ...evaluated });
}

export function renderScopeHandoffActivationBootstrap(record) {
  const serialized = JSON.stringify(record);
  return `(() => {\n  'use strict';\n  const value = Object.freeze(${serialized});\n  Object.defineProperty(globalThis, '${SCOPE_HANDOFF_R1_ACTIVATION_GLOBAL}', { configurable:false, enumerable:false, writable:false, value });\n})();\n`;
}
