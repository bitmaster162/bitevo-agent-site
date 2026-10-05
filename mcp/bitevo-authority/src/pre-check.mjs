export const BITEVO_PRECHECK_ENDPOINT = 'https://bitevo.work/api/pre-check';
export const PRECHECK_MAX_INPUT_CHARS = 8_000;

const EFFECTS = new Set(['read','write_internal','write_external','money','message','delete','admin']);
const GATES = new Set([
  'Authority Budget','Object binding','Authority owner','Evidence Before Effect',
  'Freshness','External confirmation','Recovery'
]);
const OFFERS = new Set(['Free triage','Entry Audit','Security Control Validation','Not enough information']);

export const PRECHECK_SECRET_PATTERNS = Object.freeze([
  Object.freeze(['PRIVATE_KEY', /-----BEGIN/i]),
  Object.freeze(['OPENAI_STYLE_KEY', /\bsk-(?:proj-)?[A-Za-z0-9_-]{8,}\b/]),
  Object.freeze(['GITHUB_CLASSIC_TOKEN', /\bghp_[A-Za-z0-9]{16,}\b/]),
  Object.freeze(['GITHUB_FINE_GRAINED_TOKEN', /\bgithub_pat_[A-Za-z0-9_]{16,}\b/]),
  Object.freeze(['SLACK_TOKEN', /\bxox[a-z]-[A-Za-z0-9-]{12,}\b/i]),
  Object.freeze(['AWS_ACCESS_KEY', /\bAKIA[0-9A-Z]{16}\b/]),
  Object.freeze(['JWT', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/]),
  Object.freeze(['LONG_HEX_SECRET', /\b[A-Fa-f0-9]{32,}\b/])
]);

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function boundedString(value, min, max) {
  return typeof value === 'string' && value.length >= min && value.length <= max;
}

export function detectPreCheckSecret(text) {
  if (typeof text !== 'string') return null;
  for (const [name, pattern] of PRECHECK_SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) return name;
  }
  return null;
}

export function validatePreCheckResult(value) {
  if (!plainObject(value) || typeof value.status !== 'string') return false;
  if (value.status === 'secret_detected' || value.status === 'out_of_scope') {
    return Object.keys(value).length === 1;
  }
  if (value.status !== 'ok') return false;
  const keys = Object.keys(value).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['actions','hypotheses','next_step','status','unknowns'])) return false;

  if (!Array.isArray(value.actions) || value.actions.length < 1 || value.actions.length > 12) return false;
  for (const action of value.actions) {
    if (!plainObject(action)) return false;
    if (!boundedString(action.name,1,120) || !EFFECTS.has(action.effect) ||
        !boundedString(action.object,1,240) || !boundedString(action.owner,1,160) ||
        !boundedString(action.evidence_before,1,500) || !boundedString(action.evidence_after,1,500)) return false;
  }

  if (!Array.isArray(value.hypotheses) || value.hypotheses.length !== 3) return false;
  for (const hypothesis of value.hypotheses) {
    if (!plainObject(hypothesis) || !GATES.has(hypothesis.gate) || !boundedString(hypothesis.text,1,700)) return false;
  }

  if (!Array.isArray(value.unknowns) || value.unknowns.length > 20 ||
      !value.unknowns.every(item => boundedString(item,1,500))) return false;

  return plainObject(value.next_step) &&
    OFFERS.has(value.next_step.offer) &&
    boundedString(value.next_step.reason,1,500);
}

function normalizeLocale(value) {
  return value === 'ru' ? 'ru' : 'en';
}

export async function callPreCheck(text, localeValue = 'en', options = {}) {
  const locale = normalizeLocale(localeValue);
  if (!boundedString(text,1,PRECHECK_MAX_INPUT_CHARS)) {
    return Object.freeze({ ok:false, status:'invalid_input', error:'TEXT_INVALID' });
  }

  const secret = detectPreCheckSecret(text);
  if (secret) {
    return Object.freeze({
      ok:true,
      status:'secret_detected',
      result:Object.freeze({ status:'secret_detected' }),
      local_secret_pattern:secret,
      upstream_calls:0
    });
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const endpoint = options.endpoint || BITEVO_PRECHECK_ENDPOINT;
  if (typeof fetchImpl !== 'function') {
    return Object.freeze({ ok:false, status:'unavailable', error:'FETCH_UNAVAILABLE' });
  }

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Accept':'application/json',
        'User-Agent':'bitevo-authority-mcp/0.1.0'
      },
      body:JSON.stringify({ text, locale }),
      signal:typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(15_000) : undefined
    });
  } catch {
    return Object.freeze({ ok:false, status:'unavailable', error:'PRECHECK_NETWORK_ERROR', upstream_calls:1 });
  }

  let body = null;
  try { body = await response.json(); } catch {}

  if (response.status === 429) {
    const retry = Number(body?.retry_after_seconds);
    return Object.freeze({
      ok:false,
      status:'rate_limited',
      error:'RATE_LIMITED',
      retry_after_seconds:Number.isFinite(retry) && retry > 0 ? retry : null,
      upstream_calls:1
    });
  }

  if (response.status === 503) {
    return Object.freeze({
      ok:false,
      status:'unavailable',
      error:typeof body?.error === 'string' ? body.error : 'PRECHECK_UNAVAILABLE',
      upstream_calls:1
    });
  }

  if (!response.ok) {
    return Object.freeze({
      ok:false,
      status:'upstream_error',
      error:'PRECHECK_HTTP_' + response.status,
      upstream_calls:1
    });
  }

  if (!validatePreCheckResult(body)) {
    return Object.freeze({
      ok:false,
      status:'upstream_error',
      error:'PRECHECK_RESULT_INVALID',
      upstream_calls:1
    });
  }

  return Object.freeze({
    ok:true,
    status:body.status,
    result:body,
    upstream_calls:1
  });
}
