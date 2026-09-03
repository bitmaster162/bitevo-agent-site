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

for (const rel of [specPath, threatPath, schemaPath, enPath, ruPath]) {
  check(fs.existsSync(path.resolve(rel)), `required P1 spec artifact missing: ${rel}`);
}

const spec = read(specPath);
const threat = read(threatPath);
const schema = JSON.parse(read(schemaPath));
const en = read(enPath);
const ru = read(ruPath);

check(spec.includes('SPEC_ONLY / NO_ENDPOINT / NO_PRODUCTION_EFFECT'), 'spec phase boundary missing');
check(spec.includes('submission_intent = scope_review_only'), 'scope-review-only intent missing');
check(spec.includes('testing_authorization = false'), 'testing authorization false boundary missing');
check(spec.includes('UNKNOWN / RECONCILE'), 'false-green unknown/reconcile state missing');
check(spec.includes('same `submission_id`'), 'idempotent receipt semantics missing');
check(spec.includes('local brief generation'), 'local fallback preservation missing');
check(spec.includes('no CRM fan-out'), 'no-CRM-fanout R1 boundary missing');
check(spec.includes('P1_SCOPE_HANDOFF_R1 = SPEC_ONLY / ENDPOINT_NOT_IMPLEMENTED / PRODUCTION_UNCHANGED / ZERO_EXTERNAL_EFFECT'), 'spec terminal missing');

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
  check(!/<form[^>]+(?:action|method)=/i.test(source), `${locale}: spec phase must not add form action/method`);
  for (const primitive of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'FormData(']) {
    check(!source.includes(primitive), `${locale}: spec phase must not add network primitive ${primitive}`);
  }
}
check(en.includes('nothing here transmits data or authorizes testing'), 'EN current local-only/no-testing baseline missing');
check(ru.includes('Ничего не отправляется'), 'RU current local-only baseline missing');
check(ru.includes('не даёт testing authorization'), 'RU current no-testing boundary missing');

const endpointPatterns = [
  'src/pages/api/scope-handoff.ts',
  'src/pages/api/scope-handoff.js',
  'src/pages/api/scope-handoff.mjs',
  'src/pages/api/scope-handoff/index.ts',
  'src/pages/api/scope-handoff/index.js',
  'src/pages/api/scope-handoff/index.mjs'
];
for (const rel of endpointPatterns) {
  check(!fs.existsSync(path.resolve(rel)), `endpoint implementation is forbidden in spec phase: ${rel}`);
}

if (failures.length) {
  console.error(`SCOPE_HANDOFF_R1_SPEC_GATE=FAIL failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('SCOPE_HANDOFF_R1_SPEC_GATE=PASS phase=SPEC_ONLY schema=BOUNDED additional_properties=DENY endpoint=ABSENT locales=2 explicit_submit=REQUIRED idempotency=REQUIRED false_green=FAIL_CLOSED local_fallback=PRESERVED production_effect=0');
