import { createHash, randomUUID } from 'node:crypto';

export const GLOBAL_RATE_LIMIT_MODE = 'blob_global_fixed_window_v1';
export const GLOBAL_RATE_LIMIT_SCHEMA = 'bitevo.scope-handoff.rate-limit.v1';
export const GLOBAL_RATE_LIMIT_PATHNAME = 'scope-handoff/r1-rate-limit/global.json';
export const GLOBAL_RATE_LIMIT_CAS_MAX_ATTEMPTS = 8;

const MAX_DATE_MS = 8_640_000_000_000_000;
const STATE_FIELDS = Object.freeze([
  'schema', 'window_start_ms', 'window_end_ms', 'count', 'updated_at',
  'configuration_digest', 'mutation_id'
]);
const STATE_FIELD_SET = new Set(STATE_FIELDS);

/** @typedef {{mode:string,maxRequests:number,windowSeconds:number,windowMs:number,configurationDigest:string}} GlobalRateLimitConfig */
/** @typedef {{decision:'ALLOW',providerIo:number,count:number,windowEndMs:number}|{decision:'DENY',providerIo:number,retryAfterSeconds:number,windowEndMs:number}|{decision:'UNKNOWN',providerIo:number,reason:string}} GlobalRateLimitDecision */

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parsePositiveSafeInteger(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
export function globalRateLimitConfigurationDigest(maxRequests, windowSeconds) {
  return createHash('sha256').update(JSON.stringify({
    mode: GLOBAL_RATE_LIMIT_MODE,
    max_requests: maxRequests,
    window_seconds: windowSeconds
  })).digest('hex');
}

export function parseGlobalRateLimitConfig(env) {
  if (!isPlainObject(env)) return { ok:false, reason:'ENV_UNAVAILABLE' };
  if (env.SCOPE_HANDOFF_R1_RATE_LIMIT_MODE !== GLOBAL_RATE_LIMIT_MODE) {
    return { ok:false, reason:'MODE_INVALID' };
  }
  const maxRequests = parsePositiveSafeInteger(env.SCOPE_HANDOFF_R1_RATE_LIMIT_MAX_REQUESTS);
  const windowSeconds = parsePositiveSafeInteger(env.SCOPE_HANDOFF_R1_RATE_LIMIT_WINDOW_SECONDS);
  if (maxRequests === null || windowSeconds === null) return { ok:false, reason:'NUMERIC_CONFIG_INVALID' };
  const windowMs = windowSeconds * 1000;
  if (!Number.isSafeInteger(windowMs) || windowMs > MAX_DATE_MS) {
    return { ok:false, reason:'WINDOW_RANGE_INVALID' };
  }
  const configurationDigest = globalRateLimitConfigurationDigest(maxRequests, windowSeconds);
  return {
    ok:true,
    config:Object.freeze({
      mode:GLOBAL_RATE_LIMIT_MODE, maxRequests, windowSeconds, windowMs, configurationDigest
    })
  };
}
export function isGlobalRateLimitConfig(config) {
  return isPlainObject(config) &&
    config.mode === GLOBAL_RATE_LIMIT_MODE &&
    Number.isSafeInteger(config.maxRequests) && config.maxRequests > 0 &&
    Number.isSafeInteger(config.windowSeconds) && config.windowSeconds > 0 &&
    Number.isSafeInteger(config.windowMs) && config.windowMs === config.windowSeconds * 1000 &&
    config.windowMs <= MAX_DATE_MS &&
    config.configurationDigest === globalRateLimitConfigurationDigest(config.maxRequests, config.windowSeconds);
}

export function makeGlobalRateLimitMutationId() {
  return `rl_${randomUUID().replaceAll('-', '')}`;
}

function normalizeNow(now) {
  let value;
  try { value = Number(now()); } catch { return null; }
  return Number.isSafeInteger(value) && value >= 0 && value < MAX_DATE_MS ? value : null;
}

function makeState(config, nowMs, count, mutationIdFactory) {
  const windowStart = Math.floor(nowMs / config.windowMs) * config.windowMs;
  const windowEnd = windowStart + config.windowMs;
  if (!Number.isSafeInteger(windowStart) || !Number.isSafeInteger(windowEnd) || windowEnd > MAX_DATE_MS) return null;
  return {
    schema:GLOBAL_RATE_LIMIT_SCHEMA, window_start_ms:windowStart, window_end_ms:windowEnd,
    count, updated_at:new Date(nowMs).toISOString(), configuration_digest:config.configurationDigest,
    mutation_id:mutationIdFactory()
  };
}
export function validateGlobalRateLimitState(value, config, options = {}) {
  if (!isGlobalRateLimitConfig(config)) return { ok:false, reason:'CONFIG_INVALID' };
  if (!isPlainObject(value)) return { ok:false, reason:'STATE_NOT_OBJECT' };
  const keys = Object.keys(value);
  if (keys.length !== STATE_FIELDS.length || keys.some(key => !STATE_FIELD_SET.has(key))) {
    return { ok:false, reason:'STATE_FIELDS_INVALID' };
  }
  if (value.schema !== GLOBAL_RATE_LIMIT_SCHEMA) return { ok:false, reason:'STATE_SCHEMA_INVALID' };
  if (!Number.isSafeInteger(value.window_start_ms) || value.window_start_ms < 0) {
    return { ok:false, reason:'WINDOW_START_INVALID' };
  }
  if (!Number.isSafeInteger(value.window_end_ms) || value.window_end_ms <= value.window_start_ms) {
    return { ok:false, reason:'WINDOW_END_INVALID' };
  }
  if (value.window_end_ms - value.window_start_ms !== config.windowMs || value.window_start_ms % config.windowMs !== 0) {
    return { ok:false, reason:'WINDOW_SHAPE_INVALID' };
  }
  if (!Number.isSafeInteger(value.count) || value.count < 1 || value.count > config.maxRequests) {
    return { ok:false, reason:'COUNT_INVALID' };
  }
  if (value.configuration_digest !== config.configurationDigest) {
    return { ok:false, reason:'CONFIGURATION_DIGEST_MISMATCH' };
  }
  if (typeof value.mutation_id !== 'string' || !/^rl_[a-f0-9]{32}$/.test(value.mutation_id)) {
    return { ok:false, reason:'MUTATION_ID_INVALID' };
  }
  if (typeof value.updated_at !== 'string') return { ok:false, reason:'UPDATED_AT_INVALID' };
  const updatedAtMs = Date.parse(value.updated_at);
  if (!Number.isFinite(updatedAtMs) || updatedAtMs < value.window_start_ms || updatedAtMs >= value.window_end_ms) {
    return { ok:false, reason:'UPDATED_AT_OUTSIDE_WINDOW' };
  }
  if (options.nowMs !== undefined && options.nowMs < value.window_start_ms) {
    return { ok:false, reason:'CLOCK_BEFORE_WINDOW' };
  }
  return { ok:true, state:value };
}

function validateSnapshot(snapshot, config, nowMs) {
  if (!isPlainObject(snapshot) || typeof snapshot.etag !== 'string' || snapshot.etag.length === 0) {
    return { ok:false, reason:'SNAPSHOT_INVALID' };
  }
  return validateGlobalRateLimitState(snapshot.value, config, { nowMs });
}

function allow(state, providerIo) {
  return { decision:'ALLOW', providerIo, count:state.count, windowEndMs:state.window_end_ms };
}

function deny(state, nowMs, providerIo) {
  return {
    decision:'DENY', providerIo, windowEndMs:state.window_end_ms,
    retryAfterSeconds:Math.max(1, Math.ceil((state.window_end_ms - nowMs) / 1000))
  };
}

function unknown(reason, providerIo) {
  return { decision:'UNKNOWN', providerIo, reason };
}
export async function consumeGlobalFixedWindow(options = {}) {
  const {
    store, config, now = Date.now, mutationIdFactory = makeGlobalRateLimitMutationId,
    maxAttempts = GLOBAL_RATE_LIMIT_CAS_MAX_ATTEMPTS
  } = options;
  let providerIo = 0;
  if (!isGlobalRateLimitConfig(config)) return unknown('CONFIG_INVALID', providerIo);
  if (!store || typeof store.read !== 'function' || typeof store.createIfAbsent !== 'function' ||
      typeof store.replaceIfMatch !== 'function') return unknown('STORE_INVALID', providerIo);
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > GLOBAL_RATE_LIMIT_CAS_MAX_ATTEMPTS) {
    return unknown('ATTEMPT_BUDGET_INVALID', providerIo);
  }
  const nowMs = normalizeNow(now);
  if (nowMs === null) return unknown('CLOCK_INVALID', providerIo);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let snapshot;
    try {
      providerIo += 1;
      snapshot = await store.read(GLOBAL_RATE_LIMIT_PATHNAME);
    } catch {
      return unknown('READ_UNCERTAIN', providerIo);
    }

    if (snapshot === null) {
      let candidate;
      try { candidate = makeState(config, nowMs, 1, mutationIdFactory); }
      catch { return unknown('MUTATION_ID_FACTORY_FAILED', providerIo); }
      if (!candidate) return unknown('WINDOW_CONSTRUCTION_INVALID', providerIo);
      const candidateValidation = validateGlobalRateLimitState(candidate, config, { nowMs });
      if (!candidateValidation.ok) return unknown(`CANDIDATE_${candidateValidation.reason}`, providerIo);
      let result;
      try {
        providerIo += 1;
        result = await store.createIfAbsent(GLOBAL_RATE_LIMIT_PATHNAME, candidate);
      } catch {
        let converged;
        try {
          providerIo += 1;
          converged = await store.read(GLOBAL_RATE_LIMIT_PATHNAME);
        } catch {
          return unknown('CREATE_RECONCILE_READ_UNCERTAIN', providerIo);
        }
        if (converged !== null) {
          const valid = validateSnapshot(converged, config, nowMs);
          if (valid.ok && valid.state.mutation_id === candidate.mutation_id) {
            return allow(valid.state, providerIo);
          }
        }
        return unknown('CREATE_OUTCOME_UNCERTAIN', providerIo);
      }
      if (result?.created === true) return allow(candidate, providerIo);
      if (result?.created === false) continue;
      return unknown('CREATE_RESULT_INVALID', providerIo);
    }

    const valid = validateSnapshot(snapshot, config, nowMs);
    if (!valid.ok) return unknown(valid.reason, providerIo);
    const state = valid.state;
    if (nowMs < state.window_start_ms) return unknown('CLOCK_BEFORE_WINDOW', providerIo);
    if (nowMs < state.window_end_ms && state.count >= config.maxRequests) {
      return deny(state, nowMs, providerIo);
    }

    let candidate;
    try {
      candidate = nowMs >= state.window_end_ms
        ? makeState(config, nowMs, 1, mutationIdFactory)
        : { ...state, count:state.count + 1, updated_at:new Date(nowMs).toISOString(), mutation_id:mutationIdFactory() };
    } catch {
      return unknown('MUTATION_ID_FACTORY_FAILED', providerIo);
    }
    if (!candidate) return unknown('WINDOW_CONSTRUCTION_INVALID', providerIo);
    const candidateValidation = validateGlobalRateLimitState(candidate, config, { nowMs });
    if (!candidateValidation.ok) return unknown(`CANDIDATE_${candidateValidation.reason}`, providerIo);
    let result;
    try {
      providerIo += 1;
      result = await store.replaceIfMatch(GLOBAL_RATE_LIMIT_PATHNAME, candidate, snapshot.etag);
    } catch {
      let converged;
      try {
        providerIo += 1;
        converged = await store.read(GLOBAL_RATE_LIMIT_PATHNAME);
      } catch {
        return unknown('REPLACE_RECONCILE_READ_UNCERTAIN', providerIo);
      }
      if (converged !== null) {
        const reconciled = validateSnapshot(converged, config, nowMs);
        if (reconciled.ok && reconciled.state.mutation_id === candidate.mutation_id) {
          return allow(reconciled.state, providerIo);
        }
      }
      return unknown('REPLACE_OUTCOME_UNCERTAIN', providerIo);
    }
    if (result?.replaced === true) return allow(candidate, providerIo);
    if (result?.replaced === false) continue;
    return unknown('REPLACE_RESULT_INVALID', providerIo);
  }

  return unknown('CAS_RETRY_EXHAUSTED', providerIo);
}

export function createGlobalFixedWindowLimiter(options) {
  return Object.freeze({ consume:() => consumeGlobalFixedWindow(options) });
}
