import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleScopeHandoffRequest, MAX_BODY_BYTES, RECEIPT_STATUS, DELIVERY_STATUS, HUMAN_REVIEW_STATUS } from '../src/lib/scope-handoff-r1/core.js';
import {
  SCOPE_HANDOFF_R1_ACTIVATION_MODE,
  SCOPE_HANDOFF_R1_STAGING_PROJECT_ID,
  evaluateScopeHandoffActivation
} from '../src/lib/scope-handoff-r1/activation.js';
import { InMemoryScopeHandoffStore, createVercelBlobGlobalRateLimitStore, createVercelBlobScopeHandoffStore } from '../src/lib/scope-handoff-r1/stores.js';

class FakeStore {
  constructor() { this.records=new Map(); this.readCount=0; this.writeCount=0; this.failRead=false; this.failWrite=false; }
  async read(path) { this.readCount++; if (this.failRead) throw new Error('read uncertain'); const v=this.records.get(path); return v ? structuredClone(v) : null; }
  async createIfAbsent(path, record) { this.writeCount++; if (this.failWrite) throw new Error('write uncertain'); if (this.records.has(path)) return {created:false}; this.records.set(path, structuredClone(record)); return {created:true}; }
}

const entry = (id='client_submit_00000001') => ({
  schema_version:'bitevo.scope-handoff.r1', client_submission_id:id, submission_intent:'scope_review_only', testing_authorization:false,
  locale:'en', intake_depth:'entry', secret_confirmation:true, consent_scope_review:true, company:'Example Co', business_contact:'Jane Doe <jane@example.com>', role:'CTO',
  owner_decision:'Decide whether the workflow should retain write authority.', workflow:'Agent prepares an update for an external system.', critical_action:'Write one approved record.',
  target_object:'Exact staging record bound by immutable ID.', authority_owner:'CTO', expensive_error:'Wrong production object changed.', environment:'staging'
});
const primary = (id='client_submit_00000002') => ({...entry(id), intake_depth:'primary', access_approver:'Security Lead', external_systems:'staging API', forbidden_effects:'No production writes',
  pre_action_evidence:'Fresh owner approval and exact object state', freshness_rule:'Approval and object state must be current for this attempt', object_binding_evidence:'Immutable target ID', external_confirmation:'Independent readback', uncertainty_behavior:'Stop and reconcile',
  staging_available:'yes', safe_replay_available:'yes', allowed_tests:'One bounded staging write and readback', prohibited_audit_actions:'No production actions', data_classification:'internal', minimum_necessary_data:'One redacted staging record', secret_handling_boundary:'No credentials in payload or evidence'
});
const req = (body, opts={}) => new Request('https://bitevo.work/api/scope-handoff', { method:opts.method || 'POST', headers:{ 'Content-Type':opts.contentType || 'application/json', ...(opts.origin ? {Origin:opts.origin}:{}), ...(opts.headers||{}) }, body:opts.method && opts.method !== 'POST' ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
const json = async res => ({ status:res.status, body:await res.json(), headers:res.headers });
let checks=0; const check=(value,msg)=>{ assert.ok(value,msg); checks++; };
const allowLimiter = Object.freeze({ consume:async () => ({ decision:'ALLOW', providerIo:0 }) });

{
  const store=new FakeStore(); const out=await json(await handleScopeHandoffRequest(req(entry()),{enabled:false,store}));
  check(out.status===503 && out.body.status==='SERVICE_DISABLED','disabled -> 503'); check(store.readCount===0 && store.writeCount===0,'disabled before store I/O');
}
{
  const store=new FakeStore(); const p=entry(); const first=await json(await handleScopeHandoffRequest(req(p),{enabled:true,store,rateLimiter:allowLimiter,idFactory:()=> 'sh_r1_fixed',now:()=> '2026-09-03T00:00:00.000Z'}));
  check(first.status===201 && first.body.status===RECEIPT_STATUS,'first accept'); check(first.body.delivery_status===DELIVERY_STATUS && first.body.human_review_status===HUMAN_REVIEW_STATUS && first.body.testing_authorization===false,'receipt constants');
  const replay=await json(await handleScopeHandoffRequest(req(p),{enabled:true,store,rateLimiter:allowLimiter,idFactory:()=> 'SHOULD_NOT_MINT'}));
  check(replay.status===200 && replay.body.replayed===true && replay.body.submission_id==='sh_r1_fixed','exact replay same id');
  const conflict=await json(await handleScopeHandoffRequest(req({...p,company:'Changed Co'}),{enabled:true,store,rateLimiter:allowLimiter})); check(conflict.status===409 && conflict.body.error==='IDEMPOTENCY_CONFLICT','changed payload conflict');
}
{
  const store=new FakeStore(); const out=await json(await handleScopeHandoffRequest(req(primary()),{enabled:true,store,rateLimiter:allowLimiter})); check(out.status===201,'primary accepted');
}
{
  const store=new FakeStore(); const bad={...entry(),unexpected:'x'}; const out=await json(await handleScopeHandoffRequest(req(bad),{enabled:true,store,rateLimiter:allowLimiter})); check(out.status===422 && out.body.error==='SCHEMA_REJECTED','additional property rejected');
  const deferred={...entry(),access_approver:'Should not travel in Entry'}; const deferredOut=await json(await handleScopeHandoffRequest(req(deferred),{enabled:true,store,rateLimiter:allowLimiter})); check(deferredOut.status===422 && deferredOut.body.reasons?.some(x=>x.startsWith('ENTRY_PRIMARY_FIELD_FORBIDDEN')),'Entry rejects deferred Primary fields');
}
{
  const store=new FakeStore(); const out=await json(await handleScopeHandoffRequest(req({...entry(),consent_scope_review:false}),{enabled:true,store,rateLimiter:allowLimiter})); check(out.status===422,'consent required');
  const out2=await json(await handleScopeHandoffRequest(req({...entry(),testing_authorization:true}),{enabled:true,store,rateLimiter:allowLimiter})); check(out2.status===422,'testing authorization cannot be granted');
}
{
  const store=new FakeStore(); const malformed=await json(await handleScopeHandoffRequest(req('{bad'),{enabled:true,store,rateLimiter:allowLimiter})); check(malformed.status===400,'malformed JSON');
  const type=await json(await handleScopeHandoffRequest(req(JSON.stringify(entry()),{contentType:'text/plain'}),{enabled:true,store,rateLimiter:allowLimiter})); check(type.status===415,'content type');
  const huge='x'.repeat(MAX_BODY_BYTES+1); const large=await json(await handleScopeHandoffRequest(req(huge),{enabled:true,store,rateLimiter:allowLimiter})); check(large.status===413,'body ceiling');
}
{
  const store=new FakeStore(); const out=await json(await handleScopeHandoffRequest(req({...entry(),workflow:'Use key sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'}),{enabled:true,store,rateLimiter:allowLimiter})); check(out.status===422 && out.body.error==='SECRET_BOUNDARY_REJECTED','secret pattern');
}
{
  const store=new FakeStore(); const method=await json(await handleScopeHandoffRequest(req(null,{method:'GET'}),{enabled:true,store,rateLimiter:allowLimiter})); check(method.status===405 && method.headers.get('allow')==='POST','method fail closed');
  const origin=await json(await handleScopeHandoffRequest(req(entry(),{origin:'https://evil.example'}),{enabled:true,store,rateLimiter:allowLimiter})); check(origin.status===403,'cross origin rejected');
}
{
  const store=new FakeStore(); const p=entry('client_submit_concurrent_01'); const [a,b]=await Promise.all([
    handleScopeHandoffRequest(req(p),{enabled:true,store,rateLimiter:allowLimiter,idFactory:()=> 'sh_r1_a'}),
    handleScopeHandoffRequest(req(p),{enabled:true,store,rateLimiter:allowLimiter,idFactory:()=> 'sh_r1_b'})
  ]); const aa=await json(a), bb=await json(b);
  check(new Set([aa.status,bb.status]).size===2 && [aa.status,bb.status].includes(201) && [aa.status,bb.status].includes(200),'concurrent one create one replay');
  check(aa.body.submission_id===bb.body.submission_id,'concurrent reconciliation same authoritative id');
}
{
  const store=new FakeStore(); store.failRead=true; const out=await json(await handleScopeHandoffRequest(req(entry('client_submit_unknown_01')),{enabled:true,store,rateLimiter:allowLimiter})); check(out.status===503 && out.body.status==='UNKNOWN_RECONCILE','unknown read fail closed');
}
{
  const store = new InMemoryScopeHandoffStore();
  check(typeof store.read === 'function' && typeof store.createIfAbsent === 'function','in-memory provider import smoke');
  const blobStore = createVercelBlobScopeHandoffStore();
  check(typeof blobStore.read === 'function' && typeof blobStore.createIfAbsent === 'function','Blob adapter import smoke without I/O');
  const rateStore = createVercelBlobGlobalRateLimitStore();
  check(typeof rateStore.read === 'function' && typeof rateStore.createIfAbsent === 'function' && typeof rateStore.replaceIfMatch === 'function','Blob CAS limiter adapter import smoke without I/O');
}

const astroConfig=await readFile(new URL('../astro.config.mjs', import.meta.url),'utf8');
const pkg=JSON.parse(await readFile(new URL('../package.json', import.meta.url),'utf8'));
const wrangler=await readFile(new URL('../wrangler.jsonc', import.meta.url),'utf8');
const worker=await readFile(new URL('../worker/index.mjs', import.meta.url),'utf8');
const api=await readFile(new URL('../api/scope-handoff.ts', import.meta.url),'utf8');
const rateLimit=await readFile(new URL('../src/lib/scope-handoff-r1/rate-limit.js', import.meta.url),'utf8');
const client=await readFile(new URL('../public/scope-handoff-r1.js', import.meta.url),'utf8');
const enIntake=await readFile(new URL('../src/pages/audit-intake.astro', import.meta.url),'utf8');
const ruIntake=await readFile(new URL('../src/pages/ru/audit-intake.astro', import.meta.url),'utf8');
check(
  astroConfig.includes('defineConfig({') &&
  !astroConfig.includes('@astrojs/vercel') &&
  !/\boutput\s*:\s*['"]server['"]/.test(astroConfig) &&
  !/\badapter\s*:/.test(astroConfig),
  'static Astro output preserved without server adapter'
);
check(
  !pkg.dependencies?.['@astrojs/vercel'] &&
  pkg.dependencies?.['@vercel/blob'] === '2.8.0' &&
  pkg.dependencies?.astro === '7.2.10' &&
  pkg.devDependencies?.esbuild === '0.28.1' &&
  pkg.engines?.node === '>=22.19.0',
  'dependency and runtime baseline'
);
check(wrangler.includes('worker/index.mjs') && !wrangler.includes('scope-handoff'),'Cloudflare config unchanged for scope handoff');
check(!worker.includes('scope-handoff'),'Cloudflare worker unchanged for scope handoff');
const exactPreviewEnv = {
  VERCEL:'1',
  VERCEL_PROJECT_ID:SCOPE_HANDOFF_R1_STAGING_PROJECT_ID,
  VERCEL_ENV:'preview',
  VERCEL_TARGET_ENV:'preview',
  SCOPE_HANDOFF_R1_ACTIVATION_MODE:SCOPE_HANDOFF_R1_ACTIVATION_MODE,
  SCOPE_HANDOFF_R1_ENABLED:'true'
};
check(
  !api.includes('node:process') &&
  api.includes('type RuntimeGlobal') &&
  api.includes('evaluateScopeHandoffActivation') &&
  api.includes('activation.runtime_enabled') &&
  api.includes('parseGlobalRateLimitConfig') &&
  api.includes('createVercelBlobGlobalRateLimitStore') &&
  api.includes('enabled:false'),
  'API uses the shared preview-only activation gate before storage construction'
);
check(
  rateLimit.includes('blob_global_fixed_window_v1') &&
  rateLimit.includes('scope-handoff/r1-rate-limit/global.json') &&
  rateLimit.includes('CAS_RETRY_EXHAUSTED'),
  'global Blob CAS limiter source markers'
);
check(
  evaluateScopeHandoffActivation({}).runtime_enabled === false &&
  evaluateScopeHandoffActivation({ SCOPE_HANDOFF_R1_ENABLED:'true' }).runtime_enabled === false &&
  evaluateScopeHandoffActivation({ ...exactPreviewEnv, VERCEL_PROJECT_ID:'prj_wrong' }).runtime_enabled === false &&
  evaluateScopeHandoffActivation({ ...exactPreviewEnv, VERCEL_ENV:'production', VERCEL_TARGET_ENV:'production' }).runtime_enabled === false &&
  evaluateScopeHandoffActivation({ ...exactPreviewEnv, VERCEL_TARGET_ENV:'production' }).runtime_enabled === false &&
  evaluateScopeHandoffActivation({ ...exactPreviewEnv, SCOPE_HANDOFF_R1_ACTIVATION_MODE:'wrong' }).runtime_enabled === false &&
  evaluateScopeHandoffActivation(exactPreviewEnv).runtime_enabled === true,
  'API runtime activates only for exact staging project and exact preview boundary'
);
check(
  client.includes('const UI_DEFAULT_ENABLED = false') &&
  client.includes('isBoundStagingPreviewActivation') &&
  client.includes(SCOPE_HANDOFF_R1_STAGING_PROJECT_ID) &&
  client.includes("fetch('/api/scope-handoff'") &&
  client.includes('testing_authorization:false'),
  'client remains default-off and exact-project activation-bound'
);
check(client.includes('const baseIds') && client.includes('const primaryIds') && client.includes("if (depth === 'primary')"),'Entry/Primary client payload separation');
check(client.includes("#ruIntake") && client.includes("#secretCheck") && client.includes("v === 'да'") && client.includes("v === 'нет'"),'RU DOM and enum parity');
for (const [locale, source] of [['en', enIntake], ['ru', ruIntake]]) {
  const activationIndex = source.indexOf('/scope-handoff-r1-activation.js');
  const controllerIndex = source.indexOf('/scope-handoff-r1.js');
  check(activationIndex >= 0 && controllerIndex > activationIndex, `${locale}: activation bootstrap precedes controller`);
}

console.log(`SCOPE_HANDOFF_R1_RUNTIME_GATE=PASS checks=${checks} fake_provider_io_only=1 real_provider_writes=0 astro_static=1 cloudflare_unchanged=1 runtime_default=DISABLED ui_default=DISABLED activation=EXACT_STAGING_PREVIEW_BOUND rate_limit=REQUIRED_SOURCE_PRESENT`);
