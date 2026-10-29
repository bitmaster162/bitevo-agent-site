import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test, after } from 'node:test';
import { readFile } from 'node:fs/promises';
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
// R50-D: pins were independently derived with git show BASE:path before edits.
// Fixed normalized SHA-256 checks preserve the same source boundary without
// requiring historical Git objects in a shallow CI/provider checkout.
const r50ProtectedSources = Object.freeze({
  "src/layouts/Layout.astro": "b8adee5a71826d31f02aeac33b12b94884f3059206a880296eecfa72255b3e29",
  "src/layouts/RuLayout.astro": "0c9804bba6ed3b082b7c2f0abdf62bff72bdc067ac78d75439a801d33f3ebe37",
  "public/bitevo-event-counter.js": "f9940a3c44169fbdc3bf8bee61997341bc45021831973721aabe545fba9c6a65",
  "public/triage-click.js": "20f8b779fd4061ac05e3f326d260559323b72bc93cc07e0a2e597d11b4ddc8e3",
  "worker/index.mjs": "79f7d73f85075ff39fb8213c993bd5b0cb553cd9d82b095e362b7800b1af9eeb",
  "wrangler.jsonc": "033eeab43f06ba96be050fcb3731dc0b54f6f756b88c205cb5d1ecc4e6f0487b",
  "vercel.json": "0c34591c2ae51e4901912f9f1e4c04747be3d5acdb3a6fecc08c5e18a2625797",
  "schema/bitevo_public_event_daily.sql": "f5f5e624d661108018bc65dcc9acf9e48afd4454ad14849af01b97df6495f581",
  "src/data/bitevo-event-coverage.json": "e1f9a32de3535afb7ccbac2aeec17e6b2d530c287c627200cf6a2784aa5aff47",
  "src/pages/privacy.astro": "74da034a3f0688295fb82978415d2f1f83c7b9c2accf50ae9af759988a42e3f6",
  "src/pages/ru/privacy.astro": "b48cf1a34dc5488fc2a2956142fde6f560a117ecf71986898a0d276ae8a7a439",
  "package-lock.json": "ac271324d12cc0504e6685e08ac8bc3f75ff82cdb4900078f2e25d0dea45d3b1",
  "src/data/verifier-release-manifest.json": "b7d324dc047937d0a27984b332936319a0ed919e74e6b163ac5cfb3360fd07d2",
  "scripts/verify-b1-2-event-counter.mjs": "38995a0577b9bf5ea17cb634b90701f94cd8b0b0c77b9ba09e62594bf9b0c0c1",
  "scripts/verify-r47a-privacy.mjs": "1a17201db3cd530bee7b08503a32ca18fa6dd4582441e8786265ef89314c1689"
});
// R50-D exact successor for combined Guides #3+#4: preserve every historical protected SHA.
// The changed verifier scripts are admitted ONLY for the precisely pinned guides34 registry+manifest.
const r50Guides34SuccessorSha = Object.freeze({
  'worker/index.mjs': '10e8fa276340b1543d5ee7686487e8304dcc1314a943bd4eaff248de6071d71a',
  'vercel.json': 'bf83bbc3639655eee38a4f29dc069d6d93631e6f1124bf994bd2cffd9631ab04',
  'scripts/verify-r47a-privacy.mjs': '07381869e4593992e16877eed64912bb2a8ceeb89ec851ee0188edbfeaaa0b57',
  'scripts/verify-b1-2-event-counter.mjs': '3512ac77634cffa3df0b9cf49bf589fc6959ae8f51951a7ba499074c30088cc9'
});
const { isExactGuides34Successor } = await import('../scripts/guides34-route-successor-r1.mjs');
const { isExactRGapsSuccessor } = await import('../scripts/r-gaps1-route-successor-r1.mjs');
const r50RGapsSuccessorSha = Object.freeze({
  "src/layouts/Layout.astro": "7d6927461ae2c3e274393b200ff9056413d4303a8719f239d9e24a36d1510f6d",
  "vercel.json": "09ca9e9c0a10efdd1439c9dd9702fb887853f3c2e8f4f66b87770a30c25c5c3b",
  "scripts/verify-r47a-privacy.mjs": "2eb06888fca1b8d7c18ab67f17ffa3768ae8d2b9c356b7c7491a9600696f1e17",
  "scripts/verify-b1-2-event-counter.mjs": "9eb75a437ab0ed6705a9bf9b8787fee178200965c0e716ca5d4c182b031bd0fa"
});
function r50ProtectedShaAccepted(path, sha) {
  if (sha === r50ProtectedSources[path]) return true;
  return (isExactGuides34Successor() && r50Guides34SuccessorSha[path] === sha) ||
    (isExactRGapsSuccessor() && (r50RGapsSuccessorSha[path] === sha || r50Guides34SuccessorSha[path] === sha));
}

const r50RequiredCommand = 'node --test --test-reporter=tap tests/b1-2-r50-operator-admission.test.mjs tests/b1-2-r50-durable-grant.test.mjs tests/b1-2-r50-package-runtime.test.mjs';
const r50RequiredSuffix = ' && ' + r50RequiredCommand;
const r50PinnedPackageDigest = '4e60d233a8f495bfe02ff270a2c01834b1ffcc2daa7c8e4900f7e4c81880e9a8';
function r50PackageIsExact(candidate) {
  try {
    const copy = structuredClone(candidate);
    const core = copy.scripts['verify:core'];
    if (typeof core !== 'string' || !core.endsWith(r50RequiredSuffix)
      || core.split(r50RequiredCommand).length !== 2) return false;
    copy.scripts['verify:core'] = core.slice(0, -r50RequiredSuffix.length);
    return digest(JSON.stringify(copy)) === r50PinnedPackageDigest;
  } catch { return false; }
}

test('R50-B preserves public OFF source, five-column schema and existing release contracts',async()=>{
  for (const [path, expected] of Object.entries(r50ProtectedSources)) {
    const current = (await readFile(new URL('../'+path,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
    assert.ok(r50ProtectedShaAccepted(path,digest(current)), path+' outside R50-D scope; historic pinned at '+BASE+' sha='+expected);
  }
  const pkg = JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.ok(r50PackageIsExact(pkg), 'only exact R50 required-test suffix may differ from pinned package');
  assert.equal(coverage.defaultMode,'disabled');assert.equal(coverage.routes.length,24);
  assert.equal(coverage.routes.reduce((n,r)=>n+r.events.length,0),31);
});
test('Guides34 R50-D successor exact SHA only; alien verifier fails',()=>{
  for (const [path,sha] of Object.entries(r50Guides34SuccessorSha)) {
    assert.ok(r50ProtectedShaAccepted(path,r50ProtectedSources[path]));
    assert.ok(r50ProtectedShaAccepted(path,sha));
    assert.equal(r50ProtectedShaAccepted(path,'0'.repeat(64)),false);
  }
  assert.equal(r50ProtectedShaAccepted('vercel.json',r50Guides34SuccessorSha['scripts/verify-r47a-privacy.mjs']),false);
});

test('R-GAPS-1 R50 exact pins admit only the new protected files and preserve historical pins',()=>{
  assert.equal(isExactRGapsSuccessor(), true);
  for(const [path,currentSha] of Object.entries(r50RGapsSuccessorSha)) {
    assert.ok(r50ProtectedShaAccepted(path,r50ProtectedSources[path]));
    assert.ok(r50ProtectedShaAccepted(path,currentSha));
    assert.equal(r50ProtectedShaAccepted(path,'0'.repeat(64)),false);
  }
  assert.equal(r50ProtectedShaAccepted('vercel.json',r50RGapsSuccessorSha['src/layouts/Layout.astro']), false);
});
test('R50-D required test pair is reached by unchanged build:core and required quality job',async()=>{
  const pkg = JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  const workflow = await readFile(new URL('../.github/workflows/quality-gate.yml',import.meta.url),'utf8');
  assert.ok(r50PackageIsExact(pkg));
  assert.equal(pkg.scripts['build:core'], 'npm run build:site && npm run verify:core');
  assert.ok(workflow.includes('name: quality-gate'));
  assert.ok(workflow.includes('run: npm run build:core'));
  assert.ok(!r50RequiredCommand.includes('test-name-pattern'));
});
test('R50-D rejects missing, duplicated, skipped suites and unrelated package changes',async()=>{
  const pkg = JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  const changes = [
    p => { p.scripts['verify:core'] = p.scripts['verify:core'].slice(0,-r50RequiredSuffix.length); },
    p => { p.scripts['verify:core'] += r50RequiredSuffix; },
    p => { p.scripts['verify:core'] = p.scripts['verify:core'].replace(' tests/b1-2-r50-durable-grant.test.mjs',''); },
    p => { p.scripts['verify:core'] = p.scripts['verify:core'].replace(' tests/b1-2-r50-package-runtime.test.mjs',''); },
    p => { p.scripts['verify:core'] += ' || true'; },
    p => { p.scripts['verify:core'] = p.scripts['verify:core'].replace('--test-reporter=tap','--test-reporter=tap --test-name-pattern=none'); },
    p => { p.scripts['build:core'] = 'echo skipped'; },
    p => { p.scripts['verify:core'] = p.scripts['verify:core'].replace('node scripts/verify-r47a-privacy.mjs','echo skipped-privacy'); },
    p => { p.name = 'unexpected-package'; }
  ];
  for (const mutate of changes) {
    const altered = structuredClone(pkg); mutate(altered);
    assert.equal(r50PackageIsExact(altered), false);
  }
});
