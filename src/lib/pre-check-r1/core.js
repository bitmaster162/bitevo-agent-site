export const PRECHECK_R1_MAX_INPUT_CHARS = 8_000;
export const PRECHECK_R1_MAX_BODY_BYTES = 12 * 1024;
export const PRECHECK_R1_EFFECTS = Object.freeze([
  'read','write_internal','write_external','money','message','delete','admin'
]);
export const PRECHECK_R1_GATES = Object.freeze([
  'Authority Budget','Object binding','Authority owner','Evidence Before Effect',
  'Freshness','External confirmation','Recovery'
]);
export const PRECHECK_R1_NEXT_STEPS = Object.freeze([
  'Free triage','Entry Audit','Security Control Validation','Not enough information'
]);

const EFFECTS = new Set(PRECHECK_R1_EFFECTS);
const GATES = new Set(PRECHECK_R1_GATES);
const NEXT_STEPS = new Set(PRECHECK_R1_NEXT_STEPS);
const REQUEST_FIELDS = new Set(['text','locale']);
const OK_FIELDS = new Set(['status','actions','hypotheses','unknowns','next_step']);
const ACTION_FIELDS = new Set(['name','effect','object','owner','evidence_before','evidence_after']);
const HYPOTHESIS_FIELDS = new Set(['gate','text']);
const NEXT_FIELDS = new Set(['offer','reason']);

export const PRECHECK_R1_SECRET_PATTERNS = Object.freeze([
  ['PRIVATE_KEY', /-----BEGIN/i],
  ['OPENAI_STYLE_KEY', /\bsk-(?:proj-)?[A-Za-z0-9_-]{8,}\b/],
  ['GITHUB_CLASSIC_TOKEN', /\bghp_[A-Za-z0-9]{16,}\b/],
  ['GITHUB_FINE_GRAINED_TOKEN', /\bgithub_pat_[A-Za-z0-9_]{16,}\b/],
  ['SLACK_TOKEN', /\bxox[a-z]-[A-Za-z0-9-]{12,}\b/i],
  ['AWS_ACCESS_KEY', /\bAKIA[0-9A-Z]{16}\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/],
  ['LONG_HEX_SECRET', /\b[A-Fa-f0-9]{32,}\b/]
]);

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactFields(value, allowed) {
  return plainObject(value) && Object.keys(value).every(key => allowed.has(key));
}

function boundedString(value, min, max) {
  return typeof value === 'string' && value.length >= min && value.length <= max;
}

function jsonResponse(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store',
      'X-Robots-Tag':'noindex',
      'X-Content-Type-Options':'nosniff',
      ...headers
    }
  });
}

export function validatePreCheckRequest(payload) {
  const errors = [];
  if (!plainObject(payload)) return { ok:false, errors:['BODY_NOT_OBJECT'] };
  for (const key of Object.keys(payload)) if (!REQUEST_FIELDS.has(key)) errors.push(`UNEXPECTED_FIELD:${key}`);
  if (!boundedString(payload.text, 1, PRECHECK_R1_MAX_INPUT_CHARS)) errors.push('TEXT_INVALID');
  if (!['en','ru'].includes(payload.locale)) errors.push('LOCALE_INVALID');
  return { ok:errors.length === 0, errors };
}

export function detectPreCheckSecret(text) {
  if (typeof text !== 'string') return null;
  for (const [name, pattern] of PRECHECK_R1_SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) return name;
  }
  return null;
}

function validateAction(value) {
  if (!exactFields(value, ACTION_FIELDS) || Object.keys(value).length !== ACTION_FIELDS.size) return false;
  return boundedString(value.name, 1, 120) &&
    EFFECTS.has(value.effect) &&
    boundedString(value.object, 1, 240) &&
    boundedString(value.owner, 1, 160) &&
    boundedString(value.evidence_before, 1, 500) &&
    boundedString(value.evidence_after, 1, 500);
}

function validateHypothesis(value) {
  return exactFields(value, HYPOTHESIS_FIELDS) &&
    Object.keys(value).length === HYPOTHESIS_FIELDS.size &&
    GATES.has(value.gate) &&
    boundedString(value.text, 1, 700);
}

export function validatePreCheckResult(value) {
  if (!plainObject(value) || typeof value.status !== 'string') return { ok:false, reason:'RESULT_NOT_OBJECT' };
  if (value.status === 'secret_detected' || value.status === 'out_of_scope') {
    const valid = Object.keys(value).length === 1;
    return { ok:valid, reason:valid ? null : 'TERMINAL_STATUS_EXTRA_FIELDS' };
  }
  if (value.status !== 'ok') return { ok:false, reason:'STATUS_INVALID' };
  if (!exactFields(value, OK_FIELDS) || Object.keys(value).length !== OK_FIELDS.size) return { ok:false, reason:'RESULT_FIELDS_INVALID' };
  if (!Array.isArray(value.actions) || value.actions.length < 1 || value.actions.length > 12 || !value.actions.every(validateAction)) {
    return { ok:false, reason:'ACTIONS_INVALID' };
  }
  if (!Array.isArray(value.hypotheses) || value.hypotheses.length !== 3 || !value.hypotheses.every(validateHypothesis)) {
    return { ok:false, reason:'HYPOTHESES_INVALID' };
  }
  if (!Array.isArray(value.unknowns) || value.unknowns.length > 20 ||
      !value.unknowns.every(item => boundedString(item, 1, 500))) {
    return { ok:false, reason:'UNKNOWNS_INVALID' };
  }
  if (!exactFields(value.next_step, NEXT_FIELDS) || Object.keys(value.next_step).length !== NEXT_FIELDS.size ||
      !NEXT_STEPS.has(value.next_step.offer) || !boundedString(value.next_step.reason, 1, 500)) {
    return { ok:false, reason:'NEXT_STEP_INVALID' };
  }
  return { ok:true, reason:null };
}

function normalizeActionPhrase(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function extractActionNames(text) {
  const found = [];
  const push = value => {
    const item = normalizeActionPhrase(value);
    if (!item || found.some(existing => existing.toLowerCase() === item.toLowerCase())) return;
    found.push(item);
  };
  for (const match of text.matchAll(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/gi)) {
    const value = match[0];
    if (/^(?:mcp_server|client_secret|access_token|api_key)$/i.test(value)) continue;
    push(value);
    if (found.length >= 8) return found;
  }
  const verb = /\b(update|write|delete|remove|send|create|refund|issue\s+refund|post|transfer|book|cancel|approve|change)\s+(?:the\s+)?([A-Za-z][A-Za-z0-9 _-]{0,48})/gi;
  for (const match of text.matchAll(verb)) {
    const tail = match[2].split(/[.;,\n{}[\]]/)[0].trim();
    push(`${match[1]} ${tail}`);
    if (found.length >= 8) break;
  }
  return found;
}

function classifyEffect(action, text) {
  const value = `${action} ${text}`.toLowerCase();
  if (/refund|pay|payment|charge|transfer|purchase|order/.test(value)) return 'money';
  if (/delete|remove|erase|drop/.test(value)) return 'delete';
  if (/send|message|email|post|notify/.test(value)) return 'message';
  if (/admin|permission|role|credential|account/.test(value)) return 'admin';
  if (/file|local|filesystem|config/.test(value)) return 'write_internal';
  if (/write|update|create|change|approve|book|cancel/.test(value)) return 'write_external';
  return 'read';
}

function isAgentContext(text) {
  return /\b(agent|assistant|workflow|tool|mcp|function|automation|autonomous)\b/i.test(text);
}

export function buildFallbackPreCheck(text, locale = 'en') {
  if (typeof text !== 'string' || !isAgentContext(text)) return Object.freeze({ status:'out_of_scope' });
  const names = extractActionNames(text);
  if (!names.length) return Object.freeze({ status:'out_of_scope' });
  const actions = names.map(name => Object.freeze({
    name,
    effect:classifyEffect(name, text),
    object:'unknown',
    owner:'unknown',
    evidence_before:`Rule or approval evidence authorizing ${name} before effect.`,
    evidence_after:`Read-back or external confirmation tied to the object changed by ${name}.`
  }));
  const first = actions[0];
  const hypotheses = Object.freeze([
    Object.freeze({
      gate:'Authority Budget',
      text:`When the agent attempts ${first.name}, only the authority explicitly described for that action should be usable; evidence: attempted action plus allow/refuse rule result.`
    }),
    Object.freeze({
      gate:'Object binding',
      text:`When ${first.name} targets an object, execution should stay bound to the intended object identifier; evidence: identifier checked before effect plus identifier actually changed.`
    }),
    Object.freeze({
      gate:'External confirmation',
      text:`The workflow should not report ${first.name} as complete until an independent confirmation exists; evidence: confirmation separate from the tool acknowledgement.`
    })
  ]);
  const unknowns = Object.freeze([
    'Exact target object or object identifier',
    'Authority owner or approver',
    'Minimum evidence required before the action',
    'Independent confirmation source after the action'
  ]);
  const result = {
    status:'ok',
    actions,
    hypotheses,
    unknowns,
    next_step:{
      offer:'Free triage',
      reason:locale === 'ru'
        ? 'В описании остаются существенные неизвестные; сначала нужен ручной разбор границ.'
        : 'Material authority facts remain unknown; start with a human scoping review.'
    }
  };
  return Object.freeze(result);
}

function compactText(value, max) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized.length <= max ? normalized : normalized.slice(0, Math.max(0, max - 1)) + '…';
}

export function buildScopeResultSummary(result) {
  const validation = validatePreCheckResult(result);
  if (!validation.ok || result.status !== 'ok') return null;
  const summary = {
    status:'ok',
    actions:result.actions.slice(0, 4).map(action => [compactText(action.name, 52), action.effect]),
    gates:result.hypotheses.map(item => item.gate),
    unknown_count:result.unknowns.length,
    next:result.next_step.offer
  };
  let encoded = JSON.stringify(summary);
  while (encoded.length > 600 && summary.actions.length > 1) {
    summary.actions.pop();
    encoded = JSON.stringify(summary);
  }
  return encoded.length <= 600 ? encoded : null;
}

function contentLengthTooLarge(request) {
  const raw = request.headers.get('content-length');
  if (!raw || !/^\d+$/.test(raw)) return false;
  return Number(raw) > PRECHECK_R1_MAX_BODY_BYTES;
}

export async function handlePreCheckRequest(request, options = {}) {
  const { enabled = false, limiter = null, provider = null } = options;
  if (!enabled) return jsonResponse({ error:'PRECHECK_DISABLED' }, 503);
  if (!request || request.method !== 'POST') return jsonResponse({ error:'METHOD_NOT_ALLOWED' }, 405, { Allow:'POST' });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return jsonResponse({ error:'ORIGIN_REJECTED' }, 403);
  const contentType = request.headers.get('content-type') || '';
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) return jsonResponse({ error:'CONTENT_TYPE_REQUIRED' }, 415);
  if (contentLengthTooLarge(request)) return jsonResponse({ error:'BODY_TOO_LARGE' }, 413);

  let raw;
  try { raw = await request.text(); } catch { return jsonResponse({ error:'BODY_READ_FAILED' }, 400); }
  if (new TextEncoder().encode(raw).byteLength > PRECHECK_R1_MAX_BODY_BYTES) return jsonResponse({ error:'BODY_TOO_LARGE' }, 413);
  let payload;
  try { payload = JSON.parse(raw); } catch { return jsonResponse({ error:'JSON_INVALID' }, 400); }
  const requestValidation = validatePreCheckRequest(payload);
  if (!requestValidation.ok) return jsonResponse({ error:'REQUEST_REJECTED', reasons:requestValidation.errors }, 422);

  if (detectPreCheckSecret(payload.text)) return jsonResponse({ status:'secret_detected' }, 200);
  if (!limiter || typeof limiter.consume !== 'function') return jsonResponse({ error:'RATE_LIMIT_CONFIG_INVALID' }, 503);

  let limit;
  try { limit = await limiter.consume(); }
  catch { return jsonResponse({ error:'RATE_LIMIT_UNKNOWN' }, 503); }
  if (!limit || limit.decision === 'UNKNOWN') return jsonResponse({ error:'RATE_LIMIT_UNKNOWN' }, 503);
  if (limit.decision === 'DENY') {
    const retry = Number.isSafeInteger(limit.retryAfterSeconds) && limit.retryAfterSeconds > 0 ? limit.retryAfterSeconds : 1;
    return jsonResponse({ error:'RATE_LIMITED', retry_after_seconds:retry }, 429, { 'Retry-After':String(retry) });
  }
  if (limit.decision !== 'ALLOW') return jsonResponse({ error:'RATE_LIMIT_UNKNOWN' }, 503);

  if (provider && typeof provider.run === 'function') {
    let outcome;
    try { outcome = await provider.run(payload.text, payload.locale); }
    catch { outcome = { kind:'unavailable' }; }
    if (outcome?.kind === 'ok') {
      const resultValidation = validatePreCheckResult(outcome.result);
      if (resultValidation.ok) return jsonResponse(outcome.result, 200);
    }
  }

  const fallback = buildFallbackPreCheck(payload.text, payload.locale);
  return jsonResponse(fallback, 200);
}
