import { createHash, randomUUID } from 'node:crypto';

export const MAX_BODY_BYTES = 64 * 1024;
export const RECEIPT_STATUS = 'RECEIVED_FOR_SCOPE_REVIEW';
export const DELIVERY_STATUS = 'INTAKE_RECORD_ACCEPTED';
export const HUMAN_REVIEW_STATUS = 'NOT_CONFIRMED';

const BASE_REQUIRED = [
  'schema_version','client_submission_id','submission_intent','testing_authorization','locale','intake_depth',
  'secret_confirmation','consent_scope_review','company','business_contact','role','owner_decision','workflow',
  'critical_action','target_object','authority_owner','expensive_error','environment'
];

const PRIMARY_REQUIRED = [
  'access_approver','external_systems','forbidden_effects','pre_action_evidence','freshness_rule',
  'object_binding_evidence','external_confirmation','uncertainty_behavior','staging_available',
  'safe_replay_available','allowed_tests','prohibited_audit_actions','data_classification',
  'minimum_necessary_data','secret_handling_boundary'
];

const STRING_LIMITS = {
  client_submission_id:[16,80], company:[1,200], business_contact:[1,200], role:[1,160], owner_decision:[1,2000],
  workflow:[1,3000], critical_action:[1,2000], target_object:[1,2000], authority_owner:[1,500], expensive_error:[1,2000],
  environment:[1,500], access_approver:[1,500], external_systems:[1,3000], forbidden_effects:[1,3000],
  pre_action_evidence:[1,4000], freshness_rule:[1,2000], object_binding_evidence:[1,2000], external_confirmation:[1,2000],
  uncertainty_behavior:[1,2000], allowed_tests:[1,4000], prohibited_audit_actions:[1,4000], data_classification:[1,500],
  minimum_necessary_data:[1,3000], secret_handling_boundary:[1,3000]
};

const CONSTS = {
  schema_version:'bitevo.scope-handoff.r1', submission_intent:'scope_review_only', testing_authorization:false,
  secret_confirmation:true, consent_scope_review:true
};

const ENUMS = {
  locale:new Set(['en','ru']), intake_depth:new Set(['entry','primary']),
  staging_available:new Set(['yes','no','partial','unknown']), safe_replay_available:new Set(['yes','no','unknown'])
};

export const ALLOWED_FIELDS = Object.freeze([...BASE_REQUIRED, ...PRIMARY_REQUIRED]);
const ALLOWED_SET = new Set(ALLOWED_FIELDS);

const SECRET_PATTERNS = [
  ['PRIVATE_KEY', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i],
  ['OPENAI_STYLE_KEY', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ['GITHUB_TOKEN', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ['AWS_ACCESS_KEY', /\bAKIA[0-9A-Z]{16}\b/],
  ['SLACK_TOKEN', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['STRIPE_SECRET', /\bsk_live_[A-Za-z0-9]{16,}\b/]
];

function response(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store',
      'X-Robots-Tag':'noindex',
      'X-Content-Type-Options':'nosniff',
      ...extraHeaders
    }
  });
}

export function validateScopePayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok:false, errors:['BODY_NOT_OBJECT'] };
  for (const key of Object.keys(payload)) if (!ALLOWED_SET.has(key)) errors.push(`UNEXPECTED_FIELD:${key}`);
  const required = payload.intake_depth === 'primary' ? [...BASE_REQUIRED, ...PRIMARY_REQUIRED] : BASE_REQUIRED;
  for (const key of required) if (!(key in payload)) errors.push(`MISSING_FIELD:${key}`);
  for (const [key, expected] of Object.entries(CONSTS)) if (key in payload && payload[key] !== expected) errors.push(`CONST_MISMATCH:${key}`);
  for (const [key, set] of Object.entries(ENUMS)) if (key in payload && !set.has(payload[key])) errors.push(`ENUM_INVALID:${key}`);
  for (const [key, [min,max]] of Object.entries(STRING_LIMITS)) {
    if (!(key in payload)) continue;
    if (typeof payload[key] !== 'string') errors.push(`TYPE_INVALID:${key}`);
    else if (payload[key].length < min || payload[key].length > max) errors.push(`LENGTH_INVALID:${key}`);
  }
  if ('client_submission_id' in payload && typeof payload.client_submission_id === 'string' && !/^[A-Za-z0-9_-]+$/.test(payload.client_submission_id)) errors.push('PATTERN_INVALID:client_submission_id');
  if (payload.intake_depth === 'entry') for (const key of PRIMARY_REQUIRED) if (key in payload) errors.push(`ENTRY_PRIMARY_FIELD_FORBIDDEN:${key}`);
  return { ok:errors.length === 0, errors };
}

export function detectSecret(payload) {
  if (!payload || typeof payload !== 'object') return null;
  for (const [key,value] of Object.entries(payload)) {
    if (typeof value !== 'string') continue;
    for (const [name, pattern] of SECRET_PATTERNS) if (pattern.test(value)) return { field:key, pattern:name };
  }
  return null;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  return value;
}

export function canonicalDigest(payload) {
  return createHash('sha256').update(JSON.stringify(canonicalize(payload))).digest('hex');
}

export function makeSubmissionId() {
  return `sh_r1_${randomUUID().replaceAll('-','')}`;
}

function successReceipt(record, replayed, statusCode) {
  return response({
    schema_version: record.schema_version,
    status: RECEIPT_STATUS,
    delivery_status: DELIVERY_STATUS,
    human_review_status: HUMAN_REVIEW_STATUS,
    testing_authorization: false,
    submission_id: record.submission_id,
    client_submission_id: record.client_submission_id,
    accepted_at: record.accepted_at,
    replayed
  }, statusCode);
}

export async function handleScopeHandoffRequest(request, options = {}) {
  const {
    enabled = false, store = null, rateLimiter = null,
    now = () => new Date().toISOString(), idFactory = makeSubmissionId
  } = options;
  if (!enabled) return response({ status:'SERVICE_DISABLED', provider_io:0, testing_authorization:false }, 503);
  if (request.method !== 'POST') return response({ error:'METHOD_NOT_ALLOWED' }, 405, { Allow:'POST' });
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin && origin !== requestUrl.origin) return response({ error:'CROSS_ORIGIN_REJECTED' }, 403);
  const mediaType = (request.headers.get('content-type') || '').split(';',1)[0].trim().toLowerCase();
  if (mediaType !== 'application/json') return response({ error:'CONTENT_TYPE_REQUIRED' }, 415);
  const lengthHeader = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(lengthHeader) && lengthHeader > MAX_BODY_BYTES) return response({ error:'BODY_TOO_LARGE' }, 413);
  if (!rateLimiter || typeof rateLimiter.consume !== 'function') {
    return response({ status:'RATE_LIMIT_CONFIG_INVALID', provider_io:0, testing_authorization:false }, 503);
  }
  let admission;
  try { admission = await rateLimiter.consume(); }
  catch { return response({ status:'RATE_LIMIT_UNKNOWN_RECONCILE', testing_authorization:false }, 503); }
  const limiterIoValid = Number.isSafeInteger(admission?.providerIo) && admission.providerIo >= 0;
  if (!limiterIoValid) {
    return response({ status:'RATE_LIMIT_UNKNOWN_RECONCILE', testing_authorization:false }, 503);
  }
  const limiterIo = admission.providerIo;
  if (admission?.decision === 'DENY') {
    if (!Number.isSafeInteger(admission.retryAfterSeconds) || admission.retryAfterSeconds < 1) {
      return response({ status:'RATE_LIMIT_UNKNOWN_RECONCILE', provider_io:limiterIo, testing_authorization:false }, 503);
    }
    return response({ error:'RATE_LIMITED', testing_authorization:false }, 429, { 'Retry-After':String(admission.retryAfterSeconds) });
  }
  if (admission?.decision !== 'ALLOW') {
    return response({ status:'RATE_LIMIT_UNKNOWN_RECONCILE', provider_io:limiterIo, testing_authorization:false }, 503);
  }
  let text;
  try { text = await request.text(); } catch { return response({ error:'BODY_READ_FAILED' }, 400); }
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return response({ error:'BODY_TOO_LARGE' }, 413);
  let payload;
  try { payload = JSON.parse(text); } catch { return response({ error:'MALFORMED_JSON' }, 400); }
  const validation = validateScopePayload(payload);
  if (!validation.ok) return response({ error:'SCHEMA_REJECTED', reasons:validation.errors.slice(0,12) }, 422);
  const secret = detectSecret(payload);
  if (secret) return response({ error:'SECRET_BOUNDARY_REJECTED', field:secret.field, pattern:secret.pattern }, 422);
  if (!store || typeof store.read !== 'function' || typeof store.createIfAbsent !== 'function') return response({ status:'UNKNOWN_RECONCILE', reason:'STORE_UNAVAILABLE' }, 503);

  const digest = canonicalDigest(payload);
  const pathname = `scope-handoff/r1/${payload.client_submission_id}.json`;
  let existing;
  try { existing = await store.read(pathname); }
  catch { return response({ status:'UNKNOWN_RECONCILE', reason:'STORE_READ_UNCERTAIN' }, 503); }
  if (existing) {
    if (existing.request_digest !== digest) return response({ error:'IDEMPOTENCY_CONFLICT', client_submission_id:payload.client_submission_id }, 409);
    return successReceipt(existing, true, 200);
  }

  const record = {
    schema_version: payload.schema_version,
    submission_id: idFactory(),
    client_submission_id: payload.client_submission_id,
    request_digest: digest,
    accepted_at: now(),
    locale: payload.locale,
    intake_depth: payload.intake_depth,
    status: RECEIPT_STATUS,
    delivery_status: DELIVERY_STATUS,
    human_review_status: HUMAN_REVIEW_STATUS,
    testing_authorization: false,
    request: payload
  };

  let created;
  try { created = await store.createIfAbsent(pathname, record); }
  catch { return response({ status:'UNKNOWN_RECONCILE', reason:'STORE_WRITE_UNCERTAIN' }, 503); }
  if (created?.created === true) return successReceipt(record, false, 201);

  let reconciled;
  try { reconciled = await store.read(pathname); }
  catch { return response({ status:'UNKNOWN_RECONCILE', reason:'STORE_RECONCILE_UNCERTAIN' }, 503); }
  if (!reconciled) return response({ status:'UNKNOWN_RECONCILE', reason:'WRITE_CONFLICT_WITHOUT_RECORD' }, 503);
  if (reconciled.request_digest !== digest) return response({ error:'IDEMPOTENCY_CONFLICT', client_submission_id:payload.client_submission_id }, 409);
  return successReceipt(reconciled, true, 200);
}
