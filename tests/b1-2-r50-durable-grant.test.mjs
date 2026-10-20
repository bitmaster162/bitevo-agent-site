import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createR50DurableGrantStore, R50_CLAIM_DOMAIN } from '../src/lib/b1-2/r50-durable-grant-transport.ts';
import { R50_CONSUME_SQL, handleR50GrantClaim } from '../worker/r50-grant-claim.mjs';
import { inspectR50Admission } from '../src/lib/b1-2/r50-operator-admission.ts';

const BASE = 'b34f31a984efa26676c00deae16b904c42fb29c8';
const PROJECT = 'prj_U2iHyiwhJlO33r0u4uN65PpdzEiv';
const SECRET = 'LOCAL-ONLY-r50-claim-protocol-signing-not-production';
const TOKEN = 'a'.repeat(64);
const ID = '11111111-2222-4333-8444-555555555555';
const NOW = Date.parse('2026-10-20T12:00:00.000Z');
const START = '2026-10-20T11:59:00.000Z';
const END = '2026-10-20T12:01:00.000Z';
const CLAIM_URL = 'https://bitevo-r50-claim.local-fixture.workers.dev/r50/claim';
let actualNetworkCalls = 0;
globalThis.fetch = async () => { actualNetworkCalls++; throw Error('LIVE_NETWORK_FORBIDDEN'); };
after(() => assert.equal(actualNetworkCalls, 0));
const hash = x => createHash('sha256').update(x).digest('hex');
const fixtureEnv = {
  BITEVO_EVENT_COUNTER_ENABLED: 'true',
  BITEVO_EVENT_COUNTER_PROVIDER_READY: 'true',
  BITEVO_EVENT_COUNTER_R50_MODE: 'operator-only',
  BITEVO_EVENT_COUNTER_SIGNING_SECRET: SECRET,
  BITEVO_EVENT_COUNTER_R50_TRIAL_ID: ID,
  BITEVO_EVENT_COUNTER_R50_OPERATOR_TOKEN_SHA256: hash(TOKEN),
  BITEVO_EVENT_COUNTER_R50_APPROVED_SHA: BASE,
  BITEVO_EVENT_COUNTER_R50_NOT_BEFORE: START,
  BITEVO_EVENT_COUNTER_R50_EXPIRES_AT: END,
  BITEVO_EVENT_COUNTER_ALLOWED_PROJECT_ID: PROJECT,
  BITEVO_EVENT_COUNTER_WORKER_URL: 'https://bitevo-agent-site.mirokonkr.workers.dev/b1-2/event',
  BITEVO_EVENT_GRANT_CLAIM_URL: CLAIM_URL,
  VERCEL: '1', VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production',
  VERCEL_PROJECT_ID: PROJECT, VERCEL_GIT_COMMIT_SHA: BASE
};
function operatorRequest() {
  return new Request('https://bitevo.work/api/event', {
    method: 'POST', headers: {
      origin: 'https://bitevo.work', 'content-type': 'application/json',
      'x-bitevo-r50-operator-token': TOKEN, 'x-bitevo-r50-trial-id': ID
    },
    body: JSON.stringify({ event: 'triage_click', page: '/agent-authority-audit', locale: 'en' })
  });
}
const inspection = inspectR50Admission(operatorRequest(), fixtureEnv, 'disabled', NOW, {
  consumeOnce: async () => ({ outcome:'denied' })
});
assert.equal(inspection.kind, 'trial');
const policy = inspection.policy;
const claim = Object.freeze({
  claimKey: policy.claimKey, policyDigest: policy.policyDigest,
  nowMs: NOW, expiresAtMs: policy.expiresAtMs
});

const tempRoot=mkdtempSync(join(process.env.R50_LOCAL_TMP_ROOT || tmpdir(), 'bitevo-r50-local-'));
const file=join(tempRoot,'durable-claim.sqlite');
const one=new DatabaseSync(file);
one.exec(readFileSync(new URL('../schema/bitevo_r50_operator_grants.sql', import.meta.url),'utf8'));
let two=new DatabaseSync(file);
after(()=>{try{two.close();}catch{}try{one.close();}catch{}rmSync(tempRoot,{recursive:true,force:true});});
function reset({revoked=false,digest=claim.policyDigest}={}) {
  one.prepare('DELETE FROM bitevo_r50_operator_grants').run();
  one.prepare('INSERT INTO bitevo_r50_operator_grants (claim_key,policy_digest,not_before_ms,expires_at_ms,consumed_at_ms,revoked_at_ms) VALUES (?,?,?,?,NULL,?)')
    .run(claim.claimKey,digest,NOW-1000,Date.parse(END),revoked?NOW-100:null);
}
function d1For(db) {
  return {
    prepare(sql) {
      assert.equal(sql, R50_CONSUME_SQL);
      return {
        bind(...params) {
          assert.equal(params.length,6);
          assert.equal(params[0],NOW);
          assert.equal(params[1],claim.claimKey);
          assert.equal(params[3],NOW);
          assert.equal(params[4],claim.expiresAtMs);
          assert.equal(params[5],NOW);
          return {
            async run() {
              const changed=Number(db.prepare(sql).run(...params).changes);
              return { success:true,meta:{changes:changed,rows_written:changed,changed_db:changed===1} };
            }
          };
        }
      };
    }
  };
}
function signedClaimRequest(body=JSON.stringify(claim),options={}) {
  const id=randomUUID(),timestamp=String(Math.floor(NOW/1000));
  const hmac=createHmac('sha256',options.secret||SECRET)
    .update(R50_CLAIM_DOMAIN+'.'+timestamp+'.'+id+'.'+body).digest('hex');
  return new Request(options.url||CLAIM_URL,{
    method:'POST',headers:{
      'Content-Type':'application/json',
      'X-BitEvo-R50-Claim-Timestamp':timestamp,
      'X-BitEvo-R50-Claim-Request-Id':id,
      'X-BitEvo-R50-Claim-Signature':'v1='+hmac
    },body
  });
}
async function claimWorker(req,db,now=NOW,envExtra={}) {
  return handleR50GrantClaim(req,{
    BITEVO_EVENT_COUNTER_SIGNING_SECRET:SECRET,
    BITEVO_R50_GRANT_RECEIVER_ENABLED:'true',
    BITEVO_R50_GRANT_DB:d1For(db),...envExtra
  },now);
}

test('production OFF and unverified companion URL cannot construct a durable adapter', ()=>{
  for(const env of [
    {...fixtureEnv,BITEVO_EVENT_COUNTER_ENABLED:'false'},
    {...fixtureEnv,BITEVO_EVENT_COUNTER_R50_MODE:'disabled'},
    {...fixtureEnv,BITEVO_EVENT_GRANT_CLAIM_URL:undefined},
    {...fixtureEnv,BITEVO_EVENT_GRANT_CLAIM_URL:'http://localhost/r50/claim'},
    {...fixtureEnv,BITEVO_EVENT_GRANT_CLAIM_URL:'https://bitevo-agent-site.mirokonkr.workers.dev/r50/claim'},
    {...fixtureEnv,BITEVO_EVENT_GRANT_CLAIM_URL:'https://bad.org/r50/claim'},
    {...fixtureEnv,BITEVO_EVENT_GRANT_CLAIM_URL:CLAIM_URL+'?anything=1'},
    {...fixtureEnv,BITEVO_EVENT_COUNTER_SIGNING_SECRET:'short'}
  ]) assert.equal(createR50DurableGrantStore(env),undefined);
});

test('standalone receiver OFF, missing DB, invalid signature, invalid grant fail closed',async ()=>{
  reset();
  assert.equal((await handleR50GrantClaim(signedClaimRequest(),{BITEVO_EVENT_COUNTER_SIGNING_SECRET:SECRET},NOW)).status,404);
  assert.equal((await handleR50GrantClaim(signedClaimRequest(),{
    BITEVO_R50_GRANT_RECEIVER_ENABLED:'true',BITEVO_EVENT_COUNTER_SIGNING_SECRET:SECRET
  },NOW)).status,503);
  assert.equal((await claimWorker(signedClaimRequest(),one,NOW,{BITEVO_EVENT_COUNTER_SIGNING_SECRET:'wrong-secret-that-is-still-long-enough'})).status,401);
  assert.equal((await claimWorker(signedClaimRequest(JSON.stringify({...claim,policyDigest:'f'.repeat(64)})),one)).status,409);
  assert.equal((await claimWorker(signedClaimRequest(),one,NOW+45_000)).status,401);
  assert.equal(one.prepare('SELECT consumed_at_ms FROM bitevo_r50_operator_grants').get().consumed_at_ms,null);
});

test('file-backed SQLite consumes once across two connections and restart',async ()=>{
  reset();
  const adapter=createR50DurableGrantStore(fixtureEnv,async (url,options)=>claimWorker(new Request(url,options),two));
  assert.ok(adapter);
  const results=await Promise.all([adapter.consumeOnce(claim),adapter.consumeOnce(claim)]);
  assert.equal(results.filter(x=>x?.outcome==='consumed').length,1);
  assert.equal(one.prepare('SELECT consumed_at_ms FROM bitevo_r50_operator_grants').get().consumed_at_ms,NOW);
  assert.equal(await adapter.consumeOnce(claim),null);
  two.close();
  two=new DatabaseSync(file);
  assert.equal(two.prepare('SELECT consumed_at_ms FROM bitevo_r50_operator_grants').get().consumed_at_ms,NOW);
  assert.equal(await adapter.consumeOnce(claim),null);
});

test('revocation and policy mismatch deny with zero data changes',async ()=>{
  reset({revoked:true});
  const adapter=createR50DurableGrantStore(fixtureEnv,async(url,options)=>claimWorker(new Request(url,options),one));
  assert.equal(await adapter.consumeOnce(claim),null);
  reset({digest:'f'.repeat(64)});
  assert.equal(await adapter.consumeOnce(claim),null);
  assert.equal(one.prepare('SELECT consumed_at_ms FROM bitevo_r50_operator_grants').get().consumed_at_ms,null);
});

test('lost response after committed UPDATE never retries or refunds',async ()=>{
  reset();
  let attempts=0;
  const adapter=createR50DurableGrantStore(fixtureEnv,async(url,options)=>{
    attempts++;
    const response=await claimWorker(new Request(url,options),one);
    assert.equal(response.status,200);
    throw Error('response lost after committed update');
  });
  assert.equal(await adapter.consumeOnce(claim),null);
  assert.equal(attempts,1);
  assert.equal(one.prepare('SELECT consumed_at_ms FROM bitevo_r50_operator_grants').get().consumed_at_ms,NOW);
});

test('malformed D1 receipt, extra keys, wrong identity and time cannot pass',async ()=>{
  for(const data of [
    {outcome:'consumed'},
    {outcome:'consumed',claimKey:claim.claimKey,policyDigest:claim.policyDigest,consumedAtMs:NOW,extra:1},
    {outcome:'consumed',claimKey:'wrong',policyDigest:claim.policyDigest,consumedAtMs:NOW},
    {outcome:'consumed',claimKey:claim.claimKey,policyDigest:claim.policyDigest,consumedAtMs:NOW-1}
  ]) {
    const adapter=createR50DurableGrantStore(fixtureEnv,async()=>Response.json(data));
    assert.equal(await adapter.consumeOnce(claim),null);
  }
});

test('sidecar schema isolated; no public Worker routes/config or secret defaults',()=>{
  const source=readFileSync(new URL('../schema/bitevo_r50_operator_grants.sql',import.meta.url),'utf8');
  const original=readFileSync(new URL('../schema/bitevo_public_event_daily.sql',import.meta.url),'utf8');
  const wrangler=JSON.parse(readFileSync(new URL('../wrangler.r50-grant.jsonc',import.meta.url),'utf8'));
  assert.ok(source.includes('consumed_at_ms INTEGER DEFAULT NULL'));
  assert.ok(source.includes('revoked_at_ms INTEGER DEFAULT NULL'));
  assert.ok(original.includes('PRIMARY KEY (day, event_name, page, locale)'));
  assert.equal(wrangler.name,'bitevo-r50-grant-candidate');
  assert.equal(wrangler.main,'worker/r50-grant-claim.mjs');
  assert.equal(wrangler.vars,undefined);
  assert.equal(actualNetworkCalls,0);
});

test('full offline R50 chain: operator admission -> durable claim -> original Worker -> fake aggregate once',async()=>{
  reset();
  const {handleBitEvoPublicEvent}=await import('../api/event.ts');
  const {handleBitEvoWorkerEvent}=await import('../worker/index.mjs');
  const grantStore=createR50DurableGrantStore(fixtureEnv,
    async(url,options)=>claimWorker(new Request(url,options),two));
  let aggregate=0,downstream=0;
  const workerEnv={
    BITEVO_EVENT_COUNTER_RECEIVER_ENABLED:'true',
    BITEVO_EVENT_COUNTER_SIGNING_SECRET:SECRET,
    BITEVO_EVENT_RATE_LIMITER:{limit:async()=>({success:true})},
    BITEVO_EVENT_DB:{prepare(sql){
      assert.ok(sql.startsWith('INSERT INTO bitevo_public_event_daily'));
      return {bind(...values){
        assert.equal(values[1],'triage_click');
        assert.equal(values[2],'/agent-authority-audit');
        assert.equal(values[3],'en');
        return {async run(){aggregate++;return {success:true,meta:{changes:1}};}};
      }};
    }}
  };
  const deps={
    r50GrantStore:grantStore,now:()=>NOW,
    uuid:()=>randomUUID(),clientIp:()=> '203.0.113.17',
    send:async(url,options)=>{
      downstream++;
      return handleBitEvoWorkerEvent(new Request(url,options),workerEnv,NOW);
    }
  };
  const first=await handleBitEvoPublicEvent(operatorRequest(),fixtureEnv,deps);
  assert.equal(first.status,200);
  assert.deepEqual(await first.json(),{ok:true,counted:true});
  const next=await handleBitEvoPublicEvent(operatorRequest(),fixtureEnv,deps);
  assert.equal(next.status,503);
  assert.equal(aggregate,1);
  assert.equal(downstream,1);
  assert.equal(one.prepare('SELECT consumed_at_ms FROM bitevo_r50_operator_grants').get().consumed_at_ms,NOW);
});
