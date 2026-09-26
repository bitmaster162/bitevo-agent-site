import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SCOPE_HANDOFF_R1_PRODUCTION_ACTIVATION_MODE,
  SCOPE_HANDOFF_R1_PRODUCTION_PROJECT_ID,
  evaluateScopeHandoffActivation,
  parseScopeHandoffRetentionDays
} from '../src/lib/scope-handoff-r1/activation.js';
import { handleScopeHandoffRequest } from '../src/lib/scope-handoff-r1/core.js';
import {
  SCOPE_HANDOFF_R1_RETENTION_DECISION_STATUS,
  SCOPE_HANDOFF_R1_PROPOSED_RETENTION_DAYS,
  SCOPE_HANDOFF_R1_PROPOSED_STORAGE_OWNER,
  SCOPE_HANDOFF_R1_RETENTION_DAYS,
  SCOPE_HANDOFF_R1_STORAGE_OWNER,
  SCOPE_HANDOFF_R1_STORAGE_OWNER_EMAIL
} from '../src/lib/scope-handoff-r1/policy.js';
import {
  deletionDecision,
  operatorTokenMatches,
  OPERATOR_DELIVERY_STATUS,
  REVIEW_QUEUE_STATUS,
  reviewQueuePath
} from '../src/lib/scope-handoff-r1/review.js';
import { InMemoryScopeHandoffStore } from '../src/lib/scope-handoff-r1/stores.js';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks += 1; };

const production = Object.freeze({
  VERCEL:'1',
  VERCEL_PROJECT_ID:SCOPE_HANDOFF_R1_PRODUCTION_PROJECT_ID,
  VERCEL_ENV:'production',
  VERCEL_TARGET_ENV:'production',
  SCOPE_HANDOFF_R1_ACTIVATION_MODE:SCOPE_HANDOFF_R1_PRODUCTION_ACTIVATION_MODE,
  SCOPE_HANDOFF_R1_ENABLED:'true',
  SCOPE_HANDOFF_R1_UI_ENABLED:'true',
  SCOPE_HANDOFF_R1_OPERATOR_REVIEW_ENABLED:'true',
  SCOPE_HANDOFF_R1_OPERATOR_REVIEW_TOKEN:'x'.repeat(48),
  SCOPE_HANDOFF_R1_STORAGE_OWNER:SCOPE_HANDOFF_R1_STORAGE_OWNER,
  SCOPE_HANDOFF_R1_RETENTION_DAYS:String(SCOPE_HANDOFF_R1_RETENTION_DAYS)
});

const enabled = evaluateScopeHandoffActivation(production);
equal(enabled.profile, 'production', 'production profile selected only by exact mode');
equal(enabled.boundary, true, 'production provider boundary binds exact project/env/target');
equal(enabled.productionReady, true, 'existing evaluator is mechanically ready when review controls and proposal comparison values match');
equal(enabled.runtimeEnabled, true, 'pure evaluator can enable only when every existing production gate is true; owner-decision provenance is tracked separately');
equal(enabled.uiEnabled, true, 'UI remains a separate explicit switch');
equal(enabled.operatorReviewEnabled, true, 'operator queue is required in production profile');
equal(SCOPE_HANDOFF_R1_RETENTION_DECISION_STATUS, 'ROBERT_DECISION_PENDING', 'retention/data-owner provenance remains pending');
equal(SCOPE_HANDOFF_R1_RETENTION_DAYS, SCOPE_HANDOFF_R1_PROPOSED_RETENTION_DAYS, 'compatibility retention value matches the source proposal');
equal(SCOPE_HANDOFF_R1_STORAGE_OWNER, SCOPE_HANDOFF_R1_PROPOSED_STORAGE_OWNER, 'compatibility storage-owner value matches the source proposal');
equal(enabled.storageOwner, SCOPE_HANDOFF_R1_STORAGE_OWNER, 'production storage owner must exactly match the current source proposal');
equal(enabled.retentionDays, SCOPE_HANDOFF_R1_RETENTION_DAYS, 'production retention must exactly match the current source proposal');

for (const [key, reason] of [
  ['SCOPE_HANDOFF_R1_OPERATOR_REVIEW_ENABLED','OPERATOR_REVIEW_SWITCH_OFF'],
  ['SCOPE_HANDOFF_R1_OPERATOR_REVIEW_TOKEN','OPERATOR_REVIEW_TOKEN_MISSING'],
  ['SCOPE_HANDOFF_R1_STORAGE_OWNER','STORAGE_OWNER_POLICY_MISMATCH'],
  ['SCOPE_HANDOFF_R1_RETENTION_DAYS','RETENTION_POLICY_MISMATCH']
]) {
  const value = key === 'SCOPE_HANDOFF_R1_OPERATOR_REVIEW_ENABLED' ? 'false' : '';
  const result = evaluateScopeHandoffActivation({ ...production, [key]:value });
  equal(result.runtimeEnabled, false, `${key}: missing production prerequisite blocks runtime`);
  equal(result.uiEnabled, false, `${key}: missing production prerequisite blocks UI`);
  equal(result.runtimeReason, reason, `${key}: failure reason is explicit`);
}
equal(parseScopeHandoffRetentionDays({ SCOPE_HANDOFF_R1_RETENTION_DAYS:'0' }).ok, false, 'zero retention is rejected');
equal(parseScopeHandoffRetentionDays({ SCOPE_HANDOFF_R1_RETENTION_DAYS:'30 ' }).ok, false, 'retention parsing is exact');
equal(evaluateScopeHandoffActivation({ ...production, SCOPE_HANDOFF_R1_STORAGE_OWNER:'Another Owner' }).runtimeReason, 'STORAGE_OWNER_POLICY_MISMATCH', 'wrong named owner fails closed');
equal(evaluateScopeHandoffActivation({ ...production, SCOPE_HANDOFF_R1_RETENTION_DAYS:'29' }).runtimeReason, 'RETENTION_POLICY_MISMATCH', 'wrong retention horizon fails closed');

const entry = id => ({
  schema_version:'bitevo.scope-handoff.r1',
  client_submission_id:id,
  submission_intent:'scope_review_only',
  testing_authorization:false,
  locale:'en',
  intake_depth:'entry',
  secret_confirmation:true,
  consent_scope_review:true,
  company:'Example Co',
  business_contact:'Jane Doe',
  role:'CTO',
  owner_decision:'Decide whether the workflow should retain write authority.',
  workflow:'Agent prepares a bounded update.',
  critical_action:'Write one approved staging record.',
  target_object:'Exact staging record ID.',
  authority_owner:'CTO',
  expensive_error:'Wrong object changed.',
  environment:'staging'
});
const req = body => new Request('https://bitevo.work/api/scope-handoff', {
  method:'POST',
  headers:{ 'Content-Type':'application/json' },
  body:JSON.stringify(body)
});
const json = async res => ({ status:res.status, body:await res.json() });
const allowLimiter = Object.freeze({ consume:async () => ({ decision:'ALLOW', providerIo:0 }) });

{
  const store = new InMemoryScopeHandoffStore();
  const queue = new InMemoryScopeHandoffStore();
  const payload = entry('client_submit_prod_0001');
  const out = await json(await handleScopeHandoffRequest(req(payload), {
    enabled:true,
    store,
    reviewQueue:queue,
    storageOwner:SCOPE_HANDOFF_R1_STORAGE_OWNER,
    retentionDays:SCOPE_HANDOFF_R1_RETENTION_DAYS,
    rateLimiter:allowLimiter,
    idFactory:()=> 'sh_r1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    now:()=> '2026-09-26T00:00:00.000Z'
  }));
  equal(out.status, 201, 'first production-style accept returns 201 only after queueing');
  equal(out.body.operator_delivery_status, OPERATOR_DELIVERY_STATUS, 'receipt proves queue delivery, not human review');
  equal(out.body.human_review_status, 'NOT_CONFIRMED', 'human review remains unclaimed');
  equal(out.body.retention_until, '2026-10-26T00:00:00.000Z', 'receipt exposes explicit retention horizon');
  const queued = await queue.read(reviewQueuePath(payload.client_submission_id));
  equal(queued?.status, REVIEW_QUEUE_STATUS, 'durable queue entry exists');
  const stored = [...store.records.values()][0];
  equal(queued?.request_digest, stored.request_digest, 'queue binds exact stored request digest');
  equal(stored.storage_owner, SCOPE_HANDOFF_R1_STORAGE_OWNER, 'accepted record binds the exact accountable storage owner');
  check(!Object.prototype.hasOwnProperty.call(queued || {}, 'company'), 'queue metadata does not duplicate company/contact payload data');
}

{
  const store = new InMemoryScopeHandoffStore();
  const queue = new InMemoryScopeHandoffStore();
  queue.failWrite = true;
  const payload = entry('client_submit_prod_0002');
  const first = await json(await handleScopeHandoffRequest(req(payload), {
    enabled:true,
    store,
    reviewQueue:queue,
    storageOwner:SCOPE_HANDOFF_R1_STORAGE_OWNER,
    retentionDays:SCOPE_HANDOFF_R1_RETENTION_DAYS,
    rateLimiter:allowLimiter,
    idFactory:()=> 'sh_r1_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    now:()=> '2026-09-26T00:00:00.000Z'
  }));
  equal(first.status, 503, 'queue uncertainty never produces an acceptance receipt');
  equal(first.body.status, 'REVIEW_QUEUE_UNKNOWN_RECONCILE', 'queue failure is explicit');
  equal(store.records.size, 1, 'stored record remains available for same-ID reconciliation');
  queue.failWrite = false;
  const retry = await json(await handleScopeHandoffRequest(req(payload), {
    enabled:true, store, reviewQueue:queue, storageOwner:SCOPE_HANDOFF_R1_STORAGE_OWNER, retentionDays:SCOPE_HANDOFF_R1_RETENTION_DAYS, rateLimiter:allowLimiter
  }));
  equal(retry.status, 200, 'same request reconciles without a second record');
  equal(retry.body.replayed, true, 'reconciliation preserves idempotency');
  equal(retry.body.submission_id, 'sh_r1_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'server submission ID is stable');
}

check(operatorTokenMatches('z'.repeat(48), 'z'.repeat(48)), 'exact operator bearer token matches');
check(!operatorTokenMatches('z'.repeat(48), 'y'.repeat(48)), 'wrong operator bearer token is rejected');
check(!operatorTokenMatches('short', 'z'.repeat(48)), 'short presented token is rejected');
equal(deletionDecision({ retention_until:'2026-10-26T00:00:00.000Z' }, 'retention_expired', '2026-10-25T23:59:59.000Z').reason, 'RETENTION_NOT_EXPIRED', 'retention delete fails before horizon');
equal(deletionDecision({ retention_until:'2026-10-26T00:00:00.000Z' }, 'retention_expired', '2026-10-26T00:00:00.000Z').allowed, true, 'retention delete opens at horizon');
equal(deletionDecision({ retention_until:'2026-10-26T00:00:00.000Z' }, 'privacy_request', '2026-09-26T00:00:00.000Z').allowed, true, 'privacy deletion does not wait for retention horizon');

const operatorApi = await readFile(new URL('../api/scope-handoff-review.ts', import.meta.url), 'utf8');
const reviewSource = await readFile(new URL('../src/lib/scope-handoff-r1/review.js', import.meta.url), 'utf8');
const publicClient = await readFile(new URL('../public/scope-handoff-r1.js', import.meta.url), 'utf8');
const vercel = await readFile(new URL('../vercel.json', import.meta.url), 'utf8');
const enDist = await readFile(new URL('../dist/audit-intake/index.html', import.meta.url), 'utf8');
const ruDist = await readFile(new URL('../dist/ru/audit-intake/index.html', import.meta.url), 'utf8');
const doc = await readFile(new URL('../docs/SCOPE_HANDOFF_R1_PRODUCTION_READINESS_P24_20260926.md', import.meta.url), 'utf8');

check(operatorApi.includes('OPERATOR_AUTH_REQUIRED') && operatorApi.includes("request.method === 'GET'"), 'operator retrieval is authenticated and explicit');
check(operatorApi.includes("request.method === 'DELETE'") && operatorApi.includes('deletionDecision') && operatorApi.includes('RETENTION_NOT_EXPIRED'), 'operator delete route is bound to explicit deletion policy');
check(reviewSource.includes("reason === 'privacy_request'") && reviewSource.includes("reason !== 'retention_expired'") && reviewSource.includes('RETENTION_NOT_EXPIRED'), 'bounded privacy/retention deletion policy exists');
check(publicClient.includes("PRODUCTION_ACTIVATION_MODE = 'production_scope_review_r1'"), 'browser accepts only versioned production marker');
check(!vercel.includes('SCOPE_HANDOFF_R1_OPERATOR_REVIEW_TOKEN'), 'production secret is not committed to provider config');
check(!vercel.includes('SCOPE_HANDOFF_R1_RETENTION_DAYS'), 'retention value is not silently selected in source');
check(!vercel.includes('SCOPE_HANDOFF_R1_STORAGE_OWNER'), 'storage owner is not silently selected in source');
for (const [locale, html] of [['EN',enDist],['RU',ruDist]]) {
  check(html.includes('data-scope-handoff-r1-activation="disabled"'), `${locale}: local build remains default-off`);
  check(html.includes('mailto:robert@bitevo.work?subject=BitEvo%20scope%20review'), `${locale}: manual fallback preserved`);
}
for (const marker of [
  'P24_SOURCE_MERGED_DEPLOYED / DEFAULT_OFF / NO_RUNTIME_EFFECT',
  'production_scope_review_r1',
  'RETENTION_DAYS = OPERATOR_CONFIG_REQUIRED',
  'STORAGE_OWNER = OPERATOR_CONFIG_REQUIRED',
  `PRIVACY_CONTACT = ${SCOPE_HANDOFF_R1_STORAGE_OWNER_EMAIL}`,
  'ROBERT_DECISION_PENDING',
  'implementation proposals',
  'AUTO_PURGE_SOURCE = PRESENT',
  'HUMAN_REVIEW = NOT_CONFIRMED',
  'PRODUCTION_ENABLE = NOT_AUTHORIZED',
  'PR #158',
  '4300657ee025e2cf65912302606c1daf548982a4',
  '503 SERVICE_DISABLED',
  'provider_io=0',
  'testing_authorization=false'
]) check(doc.includes(marker), `P24 doc marker missing: ${marker}`);
for (const stale of [
  'Production source deployment: 0',
  'Pull request: 0',
  'Merge: 0',
  'The production retention decision is now explicit',
  '`RETENTION_DAYS = 30`',
  '`STORAGE_OWNER = Robert Dumanyan, Founder, BitEvo`',
  'RETENTION_POLICY_30_DAYS',
  'STORAGE_OWNER_ROBERT_DUMANYAN'
]) check(!doc.includes(stale), `P24 doc stale claim remains: ${stale}`);

console.log(`SCOPE_HANDOFF_R1_PRODUCTION_READINESS_GATE=PASS checks=${checks} production_mode=SOURCE_READY default_off=PASS operator_queue=BOUND retention_proposal=${SCOPE_HANDOFF_R1_PROPOSED_RETENTION_DAYS} owner_proposal=ROBERT_DUMANYAN decision=${SCOPE_HANDOFF_R1_RETENTION_DECISION_STATUS} human_review=NOT_CONFIRMED provider_writes=0 production_enable=0`);
