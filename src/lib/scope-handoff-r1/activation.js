export const SCOPE_HANDOFF_R1_ACTIVATION_SCHEMA = 'bitevo.scope-handoff.activation.v1';
export const SCOPE_HANDOFF_R1_ACTIVATION_MODE = 'isolated_staging_preview_r1';
export const SCOPE_HANDOFF_R1_PRODUCTION_ACTIVATION_MODE = 'production_scope_review_r1';
export const SCOPE_HANDOFF_R1_STAGING_PROJECT_ID = 'prj_zQ1Mb8RJA6zCrZbPfC2z3dWFcfZI';
export const SCOPE_HANDOFF_R1_PRODUCTION_PROJECT_ID = 'prj_U2iHyiwhJlO33r0u4uN65PpdzEiv';
export const SCOPE_HANDOFF_R1_DISABLED_MARKER = 'disabled';

function readExact(env, key) {
  try {
    const value = env && typeof env === 'object' ? env[key] : undefined;
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

export function parseScopeHandoffRetentionDays(env = {}) {
  const raw = readExact(env, 'SCOPE_HANDOFF_R1_RETENTION_DAYS');
  if (!/^[1-9][0-9]*$/.test(raw)) return Object.freeze({ ok:false, days:null });
  const days = Number(raw);
  return Object.freeze({ ok:Number.isSafeInteger(days) && days > 0, days:Number.isSafeInteger(days) && days > 0 ? days : null });
}

export function readScopeHandoffRuntimeEnvironment(runtimeGlobal = globalThis) {
  try {
    const env = runtimeGlobal && typeof runtimeGlobal === 'object' ? runtimeGlobal.process?.env : undefined;
    return env && typeof env === 'object' ? env : undefined;
  } catch {
    return undefined;
  }
}

function activationProfile(env) {
  const mode = readExact(env, 'SCOPE_HANDOFF_R1_ACTIVATION_MODE');
  if (mode === SCOPE_HANDOFF_R1_PRODUCTION_ACTIVATION_MODE) {
    return Object.freeze({
      name:'production',
      mode:SCOPE_HANDOFF_R1_PRODUCTION_ACTIVATION_MODE,
      projectId:SCOPE_HANDOFF_R1_PRODUCTION_PROJECT_ID,
      environment:'production',
      target:'production'
    });
  }
  return Object.freeze({
    name:'staging',
    mode:SCOPE_HANDOFF_R1_ACTIVATION_MODE,
    projectId:SCOPE_HANDOFF_R1_STAGING_PROJECT_ID,
    environment:'preview',
    target:'preview'
  });
}

function boundaryReason(checks, profile) {
  if (!checks.vercel) return 'NOT_VERCEL';
  if (!checks.project) return 'PROJECT_MISMATCH';
  if (!checks.environment) return profile.name === 'production' ? 'VERCEL_ENV_NOT_PRODUCTION' : 'VERCEL_ENV_NOT_PREVIEW';
  if (!checks.target) return profile.name === 'production' ? 'VERCEL_TARGET_ENV_NOT_PRODUCTION' : 'VERCEL_TARGET_ENV_NOT_PREVIEW';
  if (!checks.mode) return 'ACTIVATION_MODE_MISMATCH';
  return 'BOUND';
}

function productionReadinessReason(checks) {
  if (!checks.operatorReviewSwitch) return 'OPERATOR_REVIEW_SWITCH_OFF';
  if (!checks.operatorReviewToken) return 'OPERATOR_REVIEW_TOKEN_MISSING';
  if (!checks.storageOwner) return 'STORAGE_OWNER_MISSING';
  if (!checks.retentionConfigured) return 'RETENTION_NOT_CONFIGURED';
  return 'READY';
}

export function evaluateScopeHandoffActivation(env = {}) {
  const profile = activationProfile(env);
  const retention = parseScopeHandoffRetentionDays(env);
  const storageOwner = readExact(env, 'SCOPE_HANDOFF_R1_STORAGE_OWNER');
  const checks = Object.freeze({
    vercel: readExact(env, 'VERCEL') === '1',
    project: readExact(env, 'VERCEL_PROJECT_ID') === profile.projectId,
    environment: readExact(env, 'VERCEL_ENV') === profile.environment,
    target: readExact(env, 'VERCEL_TARGET_ENV') === profile.target,
    mode: readExact(env, 'SCOPE_HANDOFF_R1_ACTIVATION_MODE') === profile.mode,
    runtimeSwitch: readExact(env, 'SCOPE_HANDOFF_R1_ENABLED') === 'true',
    uiSwitch: readExact(env, 'SCOPE_HANDOFF_R1_UI_ENABLED') === 'true',
    operatorReviewSwitch: readExact(env, 'SCOPE_HANDOFF_R1_OPERATOR_REVIEW_ENABLED') === 'true',
    operatorReviewToken: readExact(env, 'SCOPE_HANDOFF_R1_OPERATOR_REVIEW_TOKEN').length >= 32,
    storageOwner: storageOwner.length >= 3,
    retentionConfigured: retention.ok
  });
  const boundary = checks.vercel && checks.project && checks.environment && checks.target && checks.mode;
  const productionReady = profile.name !== 'production' ||
    (checks.operatorReviewSwitch && checks.operatorReviewToken && checks.storageOwner && checks.retentionConfigured);
  const runtimeEnabled = boundary && checks.runtimeSwitch && productionReady;
  const uiEnabled = runtimeEnabled && checks.uiSwitch;
  const operatorReviewEnabled = profile.name === 'production' && runtimeEnabled && checks.operatorReviewSwitch;

  let runtimeReason = boundary ? (checks.runtimeSwitch ? 'ENABLED' : 'RUNTIME_SWITCH_OFF') : boundaryReason(checks, profile);
  if (boundary && checks.runtimeSwitch && !productionReady) runtimeReason = productionReadinessReason(checks);
  const uiReason = runtimeEnabled ? (checks.uiSwitch ? 'ENABLED' : 'UI_SWITCH_OFF') : runtimeReason;

  return Object.freeze({
    schema:SCOPE_HANDOFF_R1_ACTIVATION_SCHEMA,
    profile:profile.name,
    mode:profile.mode,
    checks,
    boundary,
    productionReady,
    runtimeEnabled,
    uiEnabled,
    operatorReviewEnabled,
    storageOwner:profile.name === 'production' && checks.storageOwner ? storageOwner : null,
    retentionDays:retention.days,
    runtimeReason,
    uiReason,
    uiMarker:uiEnabled ? profile.mode : SCOPE_HANDOFF_R1_DISABLED_MARKER
  });
}

export function isScopeHandoffUiMarkerEnabled(marker) {
  return marker === SCOPE_HANDOFF_R1_ACTIVATION_MODE ||
    marker === SCOPE_HANDOFF_R1_PRODUCTION_ACTIVATION_MODE;
}
