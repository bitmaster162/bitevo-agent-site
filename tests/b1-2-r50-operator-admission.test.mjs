import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test, after } from 'node:test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import coverage from '../src/data/bitevo-event-coverage.json' with { type: 'json' };

let realNetworkAttempts = 0;
globalThis.fetch = async () => { realNetworkAttempts++; throw Error('offline suite forbids network'); };
after(() => assert.equal(realNetworkAttempts, 0));
const { handleBitEvoPublicEvent } = await import('../api/event.ts');
const { inspectR50Admission } = await import('../src/lib/b1-2/r50-operator-admission.ts');
const { handleBitEvoWorkerEvent } = await import('../worker/index.mjs');
const BASE = 'b34f31a984efa26676c00deae16b904c42fb29c8';
const PROJECT = 'prj_U2iHyiwhJlO33r0u4uN65PpdzEiv';
const ENDPOINT = 'https://bitevo-agent-site.mirokonkr.workers.dev/b1-2/event';
// Public deterministic fixtures, never a real operator token/signing secret.
const TOKEN = 'a'.repeat(64);
const SIGNING = 'offline-only-r50-signing-secret-not-for-production';
const ID = '11111111-2222-4333-8444-555555555555';
const NOW = Date.parse('2026-10-20T12:00:00.000Z');
const START = '2026-10-20T11:59:00.000Z';
const END = '2026-10-20T12:01:00.000Z';
const EVENT = Object.freeze({ event: 'triage_click', page: '/agent-authority-audit', locale: 'en' });
const digest = x => createHash('sha256').update(x).digest('hex');
const baseEnv = {
  BITEVO_EVENT_COUNTER_ENABLED: 'true', BITEVO_EVENT_COUNTER_PROVIDER_READY: 'true',
  BITEVO_EVENT_COUNTER_SIGNING_SECRET: SIGNING,
  BITEVO_EVENT_COUNTER_ALLOWED_PROJECT_ID: PROJECT, BITEVO_EVENT_COUNTER_WORKER_URL: ENDPOINT,
  VERCEL: '1', VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production',
  VERCEL_PROJECT_ID: PROJECT, VERCEL_GIT_COMMIT_SHA: BASE,
  BITEVO_EVENT_COUNTER_R50_MODE: 'operator-only', BITEVO_EVENT_COUNTER_R50_TRIAL_ID: ID,
  BITEVO_EVENT_COUNTER_R50_OPERATOR_TOKEN_SHA256: digest(TOKEN),
  BITEVO_EVENT_COUNTER_R50_APPROVED_SHA: BASE,
  BITEVO_EVENT_COUNTER_R50_NOT_BEFORE: START, BITEVO_EVENT_COUNTER_R50_EXPIRES_AT: END
};
function request(body = EVENT, headers = {}, url = 'https://bitevo.work/api/event') {
  const all = { 'content-type': 'application/json', origin: 'https://bitevo.work',
    'x-bitevo-r50-operator-token': TOKEN, 'x-bitevo-r50-trial-id': ID, ...headers };
  for (const [k,v] of Object.entries(all)) if (v === undefined) delete all[k];
  return new Request(url, { method: 'POST', headers: all, body: typeof body === 'string' ? body : JSON.stringify(body) });
}
function fixture() {
  const env = { ...baseEnv };
  const calls = { send: 0, claim: 0, ip: 0, fakeWrites: [], envelope: null };
  let spent = false;
  let approved;
  // A LOCAL MODEL of an atomic, pre-provisioned store, not a production adapter.
  const store = {
    async consumeOnce(claim) {
      calls.claim++;
      assert.equal(Object.isFrozen(claim), true);
      if (!approved || spent || claim.claimKey !== approved.claimKey || claim.policyDigest !== approved.policyDigest
        || claim.nowMs < approved.notBeforeMs || claim.nowMs >= approved.expiresAtMs) return { outcome: 'denied' };
      spent = true; // No await between check and state transition in this local model.
      return { outcome: 'consumed', claimKey: claim.claimKey, policyDigest: claim.policyDigest, consumedAtMs: claim.nowMs };
    }
  };
  const inspected = inspectR50Admission(request(), env, 'disabled', NOW, store);
  assert.equal(inspected.kind, 'trial');
  approved = inspected.policy;
  const deps = {
    now: () => NOW, uuid: () => ID, r50GrantStore: store,
    clientIp: () => { calls.ip++; return '203.0.113.17'; },
    send: async (_url, options) => {
      calls.send++; calls.envelope = options;
      return Response.json({ ok: true, counted: true });
    }
  };
  return { env, calls, deps, store, policy: approved, spent: () => spent,
    revoke: () => { approved = undefined; } };
}

const envFailures = [
  ['missing mode', 'BITEVO_EVENT_COUNTER_R50_MODE', undefined],
  ['empty mode', 'BITEVO_EVENT_COUNTER_R50_MODE', ''],
  ['unknown mode', 'BITEVO_EVENT_COUNTER_R50_MODE', 'public'],
  ['weak token digest', 'BITEVO_EVENT_COUNTER_R50_OPERATOR_TOKEN_SHA256', 'short'],
  ['zero digest', 'BITEVO_EVENT_COUNTER_R50_OPERATOR_TOKEN_SHA256', '0'.repeat(64)],
  ['signing key reused as operator token', 'BITEVO_EVENT_COUNTER_R50_OPERATOR_TOKEN_SHA256', digest(SIGNING)],
  ['missing operator digest', 'BITEVO_EVENT_COUNTER_R50_OPERATOR_TOKEN_SHA256', undefined],
  ['missing trial identity', 'BITEVO_EVENT_COUNTER_R50_TRIAL_ID', undefined],
  ['invalid trial identity', 'BITEVO_EVENT_COUNTER_R50_TRIAL_ID', '../../trial'],
  ['unapproved source', 'VERCEL_GIT_COMMIT_SHA', 'b'.repeat(40)],
  ['missing source approval', 'BITEVO_EVENT_COUNTER_R50_APPROVED_SHA', undefined],
  ['zero source approval', 'BITEVO_EVENT_COUNTER_R50_APPROVED_SHA', '0'.repeat(40)],
  ['wrong project', 'VERCEL_PROJECT_ID', 'prj_other'],
  ['wrong allowed project', 'BITEVO_EVENT_COUNTER_ALLOWED_PROJECT_ID', 'prj_other'],
  ['preview', 'VERCEL_ENV', 'preview'],
  ['preview target', 'VERCEL_TARGET_ENV', 'preview'],
  ['not Vercel', 'VERCEL', '0'],
  ['not ready', 'BITEVO_EVENT_COUNTER_PROVIDER_READY', 'false'],
  ['missing signing secret', 'BITEVO_EVENT_COUNTER_SIGNING_SECRET', undefined],
  ['short signing secret', 'BITEVO_EVENT_COUNTER_SIGNING_SECRET', 'short'],
  ['different valid workers host', 'BITEVO_EVENT_COUNTER_WORKER_URL', 'https://other.workers.dev/b1-2/event'],
  ['receiver query', 'BITEVO_EVENT_COUNTER_WORKER_URL', ENDPOINT + '?trial=x'],
  ['missing start', 'BITEVO_EVENT_COUNTER_R50_NOT_BEFORE', undefined],
  ['invalid calendar time', 'BITEVO_EVENT_COUNTER_R50_NOT_BEFORE', '2026-02-30T12:00:00.000Z'],
  ['missing expiry', 'BITEVO_EVENT_COUNTER_R50_EXPIRES_AT', undefined],
  ['noncanonical expiry', 'BITEVO_EVENT_COUNTER_R50_EXPIRES_AT', '2026-10-20T12:01:00Z'],
  ['reversed window', 'BITEVO_EVENT_COUNTER_R50_EXPIRES_AT', '2026-10-20T11:58:00.000Z'],
  ['cross UTC day', 'BITEVO_EVENT_COUNTER_R50_EXPIRES_AT', '2026-10-21T00:01:00.000Z'],
  ['unknown setting does not broaden admission', 'BITEVO_EVENT_COUNTER_R50_IGNORE_SCOPE', 'true']
];
for (const [name,key,value] of envFailures) test('R50 rejects ' + name + ' without claim/send', async () => {
  const f = fixture();
  f.env[key] = value;
  const response = await handleBitEvoPublicEvent(request(), f.env, f.deps);
  assert.equal(response.status, 503);
  assert.equal(f.calls.claim, 0); assert.equal(f.calls.send, 0);
});
for (const [name,headers] of [
  ['no operator token', { 'x-bitevo-r50-operator-token': undefined }],
  ['wrong token', { 'x-bitevo-r50-operator-token': 'b'.repeat(64) }],
  ['malformed token', { 'x-bitevo-r50-operator-token': 'no' }],
  ['missing trial id', { 'x-bitevo-r50-trial-id': undefined }],
  ['wrong trial id', { 'x-bitevo-r50-trial-id': 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' }],
  ['wrong origin', { origin: 'https://attacker.example' }]
]) test('R50 rejects ' + name, async () => {
  const f = fixture();
  const response = await handleBitEvoPublicEvent(request(EVENT,headers),f.env,f.deps);
  assert.equal(response.status,403); assert.equal(f.calls.claim,0); assert.equal(f.calls.send,0);
});
for (const url of ['https://bitevo.work/api/event?token=x','https://bitevo.work/api/event/',
  'https://other.example/api/event','https://bitevo.work/api/other']) test('R50 exact request URL: '+url, async () => {
  const f=fixture();
  assert.equal((await handleBitEvoPublicEvent(request(EVENT,{},url),f.env,f.deps)).status,403);
  assert.equal(f.calls.claim,0); assert.equal(f.calls.send,0);
});
for (const now of [Date.parse(START)-1,Date.parse(END),Date.parse(END)+1,NaN,Infinity]) test('R50 time denial '+now, async () => {
  const f=fixture(); f.deps.now=()=>now;
  assert.equal((await handleBitEvoPublicEvent(request(),f.env,f.deps)).status,403);
  assert.equal(f.calls.claim,0); assert.equal(f.calls.send,0);
});
for (const body of [{...EVENT,event:'mailto_click'}, {...EVENT,page:'/pricing'},
  {...EVENT,locale:'ru'}, {...EVENT,token:TOKEN}, 'not-json']) test('R50 narrow payload '+JSON.stringify(body), async () => {
  const f=fixture();
  const response=await handleBitEvoPublicEvent(request(body),f.env,f.deps);
  assert.ok([400,403].includes(response.status)); assert.equal(f.calls.claim,0); assert.equal(f.calls.send,0);
});

test('R50 absent provider adapter is runtime HOLD, not fallback to public ingress', async () => {
  const response=await handleBitEvoPublicEvent(request(),{...baseEnv});
  assert.equal(response.status,503); assert.equal((await response.json()).error,'R50_NOT_READY');
});
test('R50 closed global switch never consumes a grant', async () => {
  const f=fixture(); f.env.BITEVO_EVENT_COUNTER_ENABLED='false';
  assert.equal((await handleBitEvoPublicEvent(request(),f.env,f.deps)).status,404);
  assert.equal(f.calls.claim,0); assert.equal(f.calls.send,0);
});
test('operator headers alone cannot fall through to legacy enabled admission', async () => {
  const f=fixture(); for(const k of Object.keys(f.env)) if(k.includes('_R50_')) delete f.env[k];
  assert.equal((await handleBitEvoPublicEvent(request(),f.env,f.deps)).status,503);
  assert.equal(f.calls.send,0);
});
test('R50 refuses public browser source mode enabled', () => {
  const f=fixture();
  assert.equal(inspectR50Admission(request(),f.env,'enabled',NOW,f.store).kind,'denied');
});
test('valid grant admits one synthetic envelope; duplicate invocation denied', async () => {
  const f=fixture();
  assert.equal((await handleBitEvoPublicEvent(request(),f.env,f.deps)).status,200);
  assert.equal((await handleBitEvoPublicEvent(request(),f.env,f.deps)).status,503);
  assert.equal(f.calls.send,1); assert.equal(f.calls.claim,2); assert.equal(f.spent(),true);
  assert.equal(JSON.stringify(f.calls.envelope).includes(TOKEN),false);
  assert.equal(JSON.stringify(f.calls.envelope).includes('operator-token'),false);
  assert.equal(JSON.stringify(f.calls.envelope).includes('203.0.113.17'),false);
});
test('parallel invocations across two handlers share one grant in local atomic model', async () => {
  const f=fixture(); const deps2={...f.deps,r50GrantStore:f.store};
  const responses=await Promise.all(Array.from({length:16},(_,i)=>handleBitEvoPublicEvent(request(),f.env,i%2?deps2:f.deps)));
  assert.equal(responses.filter(r=>r.status===200).length,1);
  assert.equal(responses.filter(r=>r.status===503).length,15); assert.equal(f.calls.send,1);
});
test('revoked or absent pre-provisioned grant cannot self-create', async () => {
  const f=fixture(); f.revoke();
  assert.equal((await handleBitEvoPublicEvent(request(),f.env,f.deps)).status,503);
  assert.equal(f.calls.send,0); assert.equal(f.spent(),false);
});
test('token rotation or expiry extension cannot reset the same trial consumption key', async () => {
  const f=fixture(); const one=inspectR50Admission(request(),f.env,'disabled',NOW,f.store);
  const rotated={...f.env,BITEVO_EVENT_COUNTER_R50_OPERATOR_TOKEN_SHA256:digest('b'.repeat(64)),BITEVO_EVENT_COUNTER_R50_EXPIRES_AT:'2026-10-20T12:05:00.000Z'};
  const two=inspectR50Admission(request(EVENT,{'x-bitevo-r50-operator-token':'b'.repeat(64)}),rotated,'disabled',NOW,f.store);
  assert.equal(one.kind,'trial'); assert.equal(two.kind,'trial');
  assert.equal(one.policy.claimKey,two.policy.claimKey); assert.notEqual(one.policy.policyDigest,two.policy.policyDigest);
  assert.equal((await handleBitEvoPublicEvent(request(EVENT,{'x-bitevo-r50-operator-token':'b'.repeat(64)}),rotated,f.deps)).status,503);
  assert.equal(f.calls.send,0);
});
for (const outcome of ['throw','502','unconfirmed','malformed']) test('downstream '+outcome+' burns allowance; no retry', async () => {
  const f=fixture();
  f.deps.send=async()=>{f.calls.send++; if(outcome==='throw') throw Error('uncertain delivery');
    if(outcome==='502') return new Response('',{status:502});
    if(outcome==='malformed') return new Response('not-json');
    return Response.json({ok:true,counted:false});};
  assert.equal((await handleBitEvoPublicEvent(request(),f.env,f.deps)).status,502);
  assert.equal((await handleBitEvoPublicEvent(request(),f.env,f.deps)).status,503);
  assert.equal(f.calls.send,1); assert.equal(f.spent(),true);
});
test('ambiguous claim failure after consumption is not retried/released', async () => {
  const f=fixture(); const original=f.store.consumeOnce;
  let first=true; f.store.consumeOnce=async claim=>{const r=await original(claim);if(first){first=false;throw Error('lost response');}return r;};
  for(let i=0;i<2;i++) assert.equal((await handleBitEvoPublicEvent(request(),f.env,f.deps)).status,503);
  assert.equal(f.calls.send,0); assert.equal(f.spent(),true);
});
for (const value of [true,{outcome:'consumed'}, {outcome:'consumed',claimKey:'wrong',policyDigest:'wrong',consumedAtMs:NOW},null]) {
  test('malformed store receipt denied '+JSON.stringify(value),async()=>{
    const f=fixture();f.store.consumeOnce=async()=>value;
    assert.equal((await handleBitEvoPublicEvent(request(),f.env,f.deps)).status,503);assert.equal(f.calls.send,0);
  });
}
test('no IP or invalid media cannot consume the one-shot allowance', async () => {
  const f=fixture(); f.deps.clientIp=()=>null;
  assert.equal((await handleBitEvoPublicEvent(request(),f.env,f.deps)).status,503);
  assert.equal(f.calls.claim,0);
  assert.equal((await handleBitEvoPublicEvent(request(EVENT,{'content-type':'text/plain'}),f.env,f.deps)).status,415);
  assert.equal(f.calls.claim,0);assert.equal(f.calls.send,0);
});
test('window expiring during atomic claim blocks forwarding but never rearms',async()=>{
  const f=fixture();let now=NOW;f.deps.now=()=>now;const original=f.store.consumeOnce;
  f.store.consumeOnce=async claim=>{const r=await original(claim);now=Date.parse(END);return r;};
  assert.equal((await handleBitEvoPublicEvent(request(),f.env,f.deps)).status,403);
  assert.equal(f.calls.send,0);assert.equal(f.spent(),true);
});
test('OFF after successful trial denies further sends without grant reset',async()=>{
  const f=fixture();assert.equal((await handleBitEvoPublicEvent(request(),f.env,f.deps)).status,200);
  f.env.BITEVO_EVENT_COUNTER_ENABLED='false';
  assert.equal((await handleBitEvoPublicEvent(request(),f.env,f.deps)).status,404);
  f.env.BITEVO_EVENT_COUNTER_ENABLED='true';
  assert.equal((await handleBitEvoPublicEvent(request(),f.env,f.deps)).status,503);assert.equal(f.calls.send,1);
});
test('synthetic HMAC path reaches unchanged Worker and fake aggregate exactly once',async()=>{
  const f=fixture();
  const workerEnv={BITEVO_EVENT_COUNTER_RECEIVER_ENABLED:'true',BITEVO_EVENT_COUNTER_SIGNING_SECRET:SIGNING,
    BITEVO_EVENT_RATE_LIMITER:{limit:async()=>({success:true})},
    BITEVO_EVENT_DB:{prepare(sql){assert.ok(sql.startsWith('INSERT INTO bitevo_public_event_daily'));
      return {bind(...values){return {run:async()=>{f.calls.fakeWrites.push(values);return {success:true,meta:{changes:1}};}};}};}}
  };
  f.deps.send=async(url,init)=>{f.calls.send++;assert.equal(url,ENDPOINT);return handleBitEvoWorkerEvent(new Request(url,init),workerEnv,NOW);};
  const response=await handleBitEvoPublicEvent(request(),f.env,f.deps);
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,counted:true});
  assert.deepEqual(f.calls.fakeWrites,[['2026-10-20','triage_click','/agent-authority-audit','en']]);
  assert.equal((await handleBitEvoPublicEvent(request(),f.env,f.deps)).status,503);assert.equal(f.calls.fakeWrites.length,1);
});
test('R50-B preserves public OFF source, five-column schema and existing release contracts',async()=>{
  const paths=['src/layouts/Layout.astro','src/layouts/RuLayout.astro','public/bitevo-event-counter.js',
    'public/triage-click.js','worker/index.mjs','wrangler.jsonc','vercel.json','schema/bitevo_public_event_daily.sql',
    'src/data/bitevo-event-coverage.json','src/pages/privacy.astro','src/pages/ru/privacy.astro',
    'package.json','package-lock.json','src/data/verifier-release-manifest.json',
    'scripts/verify-b1-2-event-counter.mjs','scripts/verify-r47a-privacy.mjs'];
  for(const path of paths){
    const current=(await readFile(new URL('../'+path,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
    const pinned=execFileSync('git',['show',BASE+':'+path],{cwd:new URL('../',import.meta.url),encoding:'utf8'}).replace(/\r\n/g,'\n');
    assert.equal(current,pinned,path+' is outside R50-B scope');
  }
  assert.equal(coverage.defaultMode,'disabled');assert.equal(coverage.routes.length,24);
  assert.equal(coverage.routes.reduce((n,r)=>n+r.events.length,0),31);
});
