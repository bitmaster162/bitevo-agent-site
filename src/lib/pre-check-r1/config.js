export const PRECHECK_R1_SCHEMA = 'bitevo.pre-check.r1';
export const PRECHECK_R1_ENABLED_VALUE = 'true';
export const PRECHECK_R1_DAILY_WINDOW_SECONDS = 86_400;

function positiveInteger(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseModels(value) {
  if (typeof value !== 'string' || !value.trim()) return [];
  const models = value.split(',').map(item => item.trim()).filter(Boolean);
  if (!models.length || new Set(models).size !== models.length) return [];
  for (const model of models) {
    if (model.length > 160 || !/^[A-Za-z0-9._:/-]+$/.test(model)) return [];
    if (model !== 'openrouter/free' && !model.endsWith(':free')) return [];
  }
  return models;
}

export function readPreCheckRuntimeEnvironment(runtimeGlobal = globalThis) {
  const env = runtimeGlobal && typeof runtimeGlobal === 'object' ? runtimeGlobal.process?.env : null;
  return env && typeof env === 'object' ? env : {};
}

export function parsePreCheckRuntimeConfig(env) {
  const source = env && typeof env === 'object' ? env : {};
  const enabled = source.PRECHECK_R1_ENABLED === PRECHECK_R1_ENABLED_VALUE;
  const dailyLimit = positiveInteger(source.PRECHECK_R1_DAILY_LIMIT);
  const keySecret = typeof source.PRECHECK_R1_RATE_LIMIT_KEY_SECRET === 'string'
    ? source.PRECHECK_R1_RATE_LIMIT_KEY_SECRET
    : '';
  const models = parseModels(source.PRECHECK_R1_OPENROUTER_MODELS);
  const apiKey = typeof source.OPENROUTER_API_KEY === 'string' ? source.OPENROUTER_API_KEY.trim() : '';
  const errors = [];
  if (enabled) {
    if (dailyLimit === null) errors.push('DAILY_LIMIT_REQUIRED');
    if (keySecret.length < 32) errors.push('RATE_LIMIT_KEY_SECRET_REQUIRED');
  }
  return Object.freeze({
    enabled,
    ok: errors.length === 0,
    errors:Object.freeze(errors),
    dailyLimit,
    keySecret,
    models:Object.freeze(models),
    apiKey,
    providerConfigured:Boolean(apiKey && models.length)
  });
}
