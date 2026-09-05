import fs from 'node:fs';
import path from 'node:path';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const read = rel => fs.readFileSync(path.resolve(rel), 'utf8');

const specPath = 'docs/SCOPE_HANDOFF_R1_SPEC_20260903.md';
const threatPath = 'docs/SCOPE_HANDOFF_R1_THREAT_MODEL_20260903.md';
const schemaPath = 'src/data/scope-handoff-r1.schema.json';
const enPath = 'src/pages/audit-intake.astro';
const ruPath = 'src/pages/ru/audit-intake.astro';
const nativeEndpointPath = 'api/scope-handoff.ts';
const runtimeGatePath = 'scripts/verify-scope-handoff-r1-runtime.mjs';
const rateLimitPath = 'src/lib/scope-handoff-r1/rate-limit.js';
const rateLimitGatePath = 'scripts/verify-scope-handoff-r1-rate-limit.mjs';
const activationPath = 'src/lib/scope-handoff-r1/activation.js';
const activationGatePath = 'scripts/verify-scope-handoff-r1-activation.mjs';

for (const rel of [specPath, threatPath, schemaPath, enPath, ruPath]) {
  check(fs.existsSync(path.resolve(rel)), `required P1 spec artifact missing: ${rel}`);
}

const spec = read(specPath);
const threat = read(threatPath);
const schema = JSON.parse(read(schemaPath));
const en = read(enPath);
const ru = read(ruPath);

check(spec.includes('SPEC_ONLY / NO_ENDPOINT / NO_PRODUCTION_EFFECT'), 'historical spec phase boundary missing');
check(spec.includes('submission_intent = scope_review_only'), 'scope-review-only intent missing');
check(spec.includes('testing_authorization = false'), 'testing authorization false boundary missing');
check(spec.includes('UNKNOWN / RECONCILE'), 'false-green unknown/reconcile state missing');
check(spec.includes('same server `submission_id`'), 'idempotent receipt semantics missing');
check(spec.includes('local brief generation'), 'local fallback preservation missing');
check(spec.includes('no hidden CRM fan-out'), 'no-CRM-fanout R1 boundary missing');
check(spec.includes('P1_SCOPE_HANDOFF_R1 = SPEC_ONLY / ENDPOINT_NOT_IMPLEMENTED / PRODUCTION_UNCHANGED / ZERO_EXTERNAL_EFFECT'), 'historical spec terminal missing');

for (const marker of [
  'T1 — Secret submission',
  'T2 — Duplicate submit / double click',
  'T3 — Replay after uncertain response',
  'T4 — False Green receipt',
  'T5 — Authority escalation by text or client tampering',
  'T8 — Spam / resource exhaustion',
  'T9 — CSRF / cross-origin abuse',
  'T10 — PII/privacy over-retention',
  'T13 — Regression of local fallback',
  'T14 — Automated downstream commitment',
  'P1_SCOPE_HANDOFF_R1_THREAT_MODEL = COMPLETE_FOR_SPEC_PHASE / IMPLEMENTATION_NOT_AUTHORIZED'
]) {
  check(threat.includes(marker), `threat-model marker missing: ${marker}`);
}

check(schema.type === 'object', 'request schema must be an object');
check(schema.additionalProperties === false, 'request schema must reject additional properties');
check(schema.properties?.schema_version?.const === 'bitevo.scope-handoff.r1', 'schema version constant missing');
check(schema.properties?.submission_intent?.const === 'scope_review_only', 'submission intent must be scope_review_only');
check(schema.properties?.testing_authorization?.const === false, 'testing_authorization must be constant false');
check(schema.properties?.secret_confirmation?.const === true, 'secret_confirmation must be constant true');
check(schema.properties?.consent_scope_review?.const === true, 'consent_scope_review must be constant true');
check(JSON.stringify(schema.properties?.locale?.enum) === JSON.stringify(['en', 'ru']), 'locale enum must be EN/RU only');
check(JSON.stringify(schema.properties?.intake_depth?.enum) === JSON.stringify(['entry', 'primary']), 'intake depth enum must be Entry/Primary only');

const required = new Set(schema.required || []);
for (const field of [
  'schema_version', 'client_submission_id', 'submission_intent', 'testing_authorization', 'locale', 'intake_depth',
  'secret_confirmation', 'consent_scope_review', 'company', 'business_contact', 'role', 'owner_decision', 'workflow',
  'critical_action', 'target_object', 'authority_owner', 'expensive_error', 'environment'
]) {
  check(required.has(field), `required Entry field missing from schema: ${field}`);
}

const primaryThen = schema.allOf?.find(x => x?.if?.properties?.intake_depth?.const === 'primary')?.then?.required || [];
for (const field of [
  'access_approver', 'external_systems', 'forbidden_effects', 'pre_action_evidence', 'freshness_rule',
  'object_binding_evidence', 'external_confirmation', 'uncertainty_behavior', 'staging_available',
  'safe_replay_available', 'allowed_tests', 'prohibited_audit_actions', 'data_classification',
  'minimum_necessary_data', 'secret_handling_boundary'
]) {
  check(primaryThen.includes(field), `Primary conditional field missing from schema: ${field}`);
}

const forbiddenPayloadFields = [
  'brief', 'raw_brief', 'generated_brief', 'mapper', 'mapper_json', 'session', 'session_storage', 'local_storage',
  'cookie', 'cookies', 'fingerprint', 'analytics_id', 'api_key', 'password', 'token', 'private_key', 'wallet_seed',
  'payment', 'booking', 'approved', 'engagement_status'
];
for (const field of forbiddenPayloadFields) {
  check(!Object.prototype.hasOwnProperty.call(schema.properties || {}, field), `forbidden payload field present: ${field}`);
}

for (const [name, definition] of Object.entries(schema.properties || {})) {
  if (definition?.type === 'string' && definition.maxLength !== undefined) {
    check(definition.maxLength <= 4000, `string field exceeds R1 max length ceiling: ${name}`);
  }
}

for (const [locale, source] of [['EN', en], ['RU', ru]]) {
  check(!/<form[^>]+(?:action|method)=/i.test(source), `${locale}: form action/method must remain absent`);
  for (const primitive of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'FormData(']) {
    check(!source.includes(primitive), `${locale}: page source must not embed network primitive ${primitive}`);
  }
}
check(en.includes('nothing here transmits data or authorizes testing'), 'EN current local-only/no-testing baseline missing');
check(ru.includes('Ничего не отправляется'), 'RU current local-only baseline missing');
check(ru.includes('не даёт testing authorization'), 'RU current no-testing boundary missing');

const forbiddenAstroEndpointPatterns = [
  'src/pages/api/scope-handoff.ts',
  'src/pages/api/scope-handoff.js',
  'src/pages/api/scope-handoff.mjs',
  'src/pages/api/scope-handoff/index.ts',
  'src/pages/api/scope-handoff/index.js',
  'src/pages/api/scope-handoff/index.mjs'
];
for (const rel of forbiddenAstroEndpointPatterns) {
  check(!fs.existsSync(path.resolve(rel)), `Astro runtime endpoint would violate static dist contract: ${rel}`);
}

const nativeEndpointPresent = fs.existsSync(path.resolve(nativeEndpointPath));
let phase = 'SPEC_ONLY';
let endpointState = 'ABSENT';
if (nativeEndpointPresent) {
  phase = 'IMPLEMENTATION_SOURCE_PRESENT_EXACT_STAGING_PREVIEW_BOUND_RATE_LIMIT_REQUIRED';
  endpointState = 'NATIVE_VERCEL_SOURCE_PRESENT';
  check(fs.existsSync(path.resolve(runtimeGatePath)), 'native endpoint requires runtime verifier');
  check(fs.existsSync(path.resolve(rateLimitPath)), 'native endpoint requires global rate-limit source');
  check(fs.existsSync(path.resolve(rateLimitGatePath)), 'native endpoint requires focused rate-limit verifier');
  check(fs.existsSync(path.resolve(activationPath)), 'native endpoint requires shared activation source');
  check(fs.existsSync(path.resolve(activationGatePath)), 'native endpoint requires focused activation verifier');
  const endpoint = read(nativeEndpointPath);
  const rateLimit = read(rateLimitPath);
  const activation = read(activationPath);
  check(endpoint.includes('evaluateScopeHandoffActivation') && endpoint.includes('activation.runtime_enabled'), 'native endpoint missing shared activation gate');
  check(activation.includes('VERCEL_PROJECT_ID') && activation.includes('prj_zQ1Mb8RJA6zCrZbPfC2z3dWFcfZI'), 'activation source missing exact staging project binding');
  check(activation.includes('VERCEL_ENV') && activation.includes('VERCEL_TARGET_ENV') && activation.includes("'preview'"), 'activation source missing preview environment binding');
  check(activation.includes('SCOPE_HANDOFF_R1_ACTIVATION_MODE') && activation.includes('staging_preview_r1'), 'activation source missing exact activation mode');
  check(activation.includes('SCOPE_HANDOFF_R1_ENABLED') && activation.includes('SCOPE_HANDOFF_R1_UI_ENABLED'), 'activation source missing explicit runtime and UI flags');
  check(endpoint.includes('parseGlobalRateLimitConfig'), 'native endpoint missing strict limiter config parser');
  check(endpoint.includes('createVercelBlobGlobalRateLimitStore'), 'native endpoint missing Blob CAS limiter adapter');
  check(endpoint.includes('enabled:false'), 'native endpoint missing disabled-before-I/O path');
  check(rateLimit.includes('blob_global_fixed_window_v1'), 'global limiter mode missing');
  check(rateLimit.includes('scope-handoff/r1-rate-limit/global.json'), 'global limiter pathname missing');
}

if (failures.length) {
  console.error(`SCOPE_HANDOFF_R1_SPEC_GATE=FAIL failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`SCOPE_HANDOFF_R1_SPEC_GATE=PASS phase=${phase} schema=BOUNDED additional_properties=DENY endpoint=${endpointState} locales=2 explicit_submit=REQUIRED idempotency=REQUIRED false_green=FAIL_CLOSED local_fallback=PRESERVED production_effect=0`);
