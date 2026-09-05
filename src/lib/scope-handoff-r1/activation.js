export const SCOPE_HANDOFF_R1_ACTIVATION_SCHEMA = 'bitevo.scope-handoff.activation.v1';
export const SCOPE_HANDOFF_R1_ACTIVATION_MODE = 'isolated_staging_preview_r1';
export const SCOPE_HANDOFF_R1_STAGING_PROJECT_ID = 'prj_zQ1Mb8RJA6zCrZbPfC2z3dWFcfZI';
export const SCOPE_HANDOFF_R1_DISABLED_MARKER = 'disabled';

function readExact(env, key) {
  try {
    const value = env && typeof env === 'object' ? env[key] : undefined;
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

export function readScopeHandoffRuntimeEnvironment(runtimeGlobal = globalThis) {
  try {
    const env = runtimeGlobal && typeof runtimeGlobal === 'object' ? runtimeGlobal.process?.env : undefined;
    return env && typeof env === 'object' ? env : undefined;
  } catch {
    return undefined;
  }
}

function boundaryReason(checks) {
  if (!checks.vercel) return 'NOT_VERCEL';
  if (!checks.project) return 'PROJECT_MISMATCH';
  if (!checks.environment) return 'VERCEL_ENV_NOT_PREVIEW';
  if (!checks.target) return 'VERCEL_TARGET_ENV_NOT_PREVIEW';
  if (!checks.mode) return 'ACTIVATION_MODE_MISMATCH';
  return 'BOUND';
}

export function evaluateScopeHandoffActivation(env = {}) {
  const checks = Object.freeze({
    vercel: readExact(env, 'VERCEL') === '1',
    project: readExact(env, 'VERCEL_PROJECT_ID') === SCOPE_HANDOFF_R1_STAGING_PROJECT_ID,
    environment: readExact(env, 'VERCEL_ENV') === 'preview',
    target: readExact(env, 'VERCEL_TARGET_ENV') === 'preview',
    mode: readExact(env, 'SCOPE_HANDOFF_R1_ACTIVATION_MODE') === SCOPE_HANDOFF_R1_ACTIVATION_MODE,
    runtimeSwitch: readExact(env, 'SCOPE_HANDOFF_R1_ENABLED') === 'true',
    uiSwitch: readExact(env, 'SCOPE_HANDOFF_R1_UI_ENABLED') === 'true'
  });
  const boundary = checks.vercel && checks.project && checks.environment && checks.target && checks.mode;
  const runtimeEnabled = boundary && checks.runtimeSwitch;
  const uiEnabled = runtimeEnabled && checks.uiSwitch;
  const runtimeReason = boundary ? (checks.runtimeSwitch ? 'ENABLED' : 'RUNTIME_SWITCH_OFF') : boundaryReason(checks);
  const uiReason = runtimeEnabled ? (checks.uiSwitch ? 'ENABLED' : 'UI_SWITCH_OFF') : runtimeReason;

  return Object.freeze({
    schema: SCOPE_HANDOFF_R1_ACTIVATION_SCHEMA,
    mode: SCOPE_HANDOFF_R1_ACTIVATION_MODE,
    checks,
    boundary,
    runtimeEnabled,
    uiEnabled,
    runtimeReason,
    uiReason,
    uiMarker: uiEnabled ? SCOPE_HANDOFF_R1_ACTIVATION_MODE : SCOPE_HANDOFF_R1_DISABLED_MARKER
  });
}

export function isScopeHandoffUiMarkerEnabled(marker) {
  return marker === SCOPE_HANDOFF_R1_ACTIVATION_MODE;
}
