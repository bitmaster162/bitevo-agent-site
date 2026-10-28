// R50-H LOCAL_ONLY: one Miniflare Worker + one isolated synthetic D1.
// No Cloudflare login, no external fetch, no paid services, no production credential.
import assert from 'node:assert/strict';
import {randomBytes, randomUUID, createHmac, createHash} from 'node:crypto';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {Miniflare,convertV4MiniflareOptions}=require('C:/Users/coins/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/miniflare');
const ROOT=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const EVIDENCE=process.argv[2];
if(!EVIDENCE || !path.isAbsolute(EVIDENCE) || !/R50H_LOCAL_EVIDENCE_20261026_R[0-9]+/i.test(EVIDENCE))throw Error('STOP_EVIDENCE_PATH');
mkdirSync(EVIDENCE,{recursive:true});
const secret='SYNTHETIC_R50H_'+randomBytes(48).toString('hex');
const hex=(message,secretValue=secret)=>createHmac('sha256',secretValue).update(message).digest('hex');
const grantPrefix='bitevo-r50-v1:prj_U2iHyiwhJlO33r0u4uN65PpdzEiv:';
const now=Date.now();
const results=[];
const dbid='BITEVO_R50H_SYNTHETIC_20261026_NOT_PROVIDER';
const mf=new Miniflare(convertV4MiniflareOptions({
 rootPath:ROOT,modulesRoot:ROOT,host:'127.0.0.1',port:0,
 scriptPath:path.join(ROOT,'worker/r50h-staging-entry.mjs'),
 modules:[
  'worker/r50h-staging-entry.mjs',
  'worker/r50-grant-claim.mjs',
  'worker/r50-event-dedup-candidate.mjs'
 ].map(name=>({type:'ESModule',path:path.join(ROOT,name)})),
 compatibilityDate:'2026-08-12',
 d1Databases:{BITEVO_R50_STAGING_DB:dbid},
 bindings:{
   BITEVO_R50_GRANT_RECEIVER_ENABLED:'true',
   BITEVO_EVENT_COUNTER_RECEIVER_ENABLED:'true',
   BITEVO_EVENT_COUNTER_SIGNING_SECRET:secret
 },
 ratelimits:{BITEVO_EVENT_RATE_LIMITER:{namespace_id:'r50h-local-20261026',simple:{limit:30,period:60}}},
 resourcePersistencePath:path.join(EVIDENCE,'miniflare-state'),logRequests:false
}));
const localUrl=(route)=>'http://r50h-local.test'+route;
function result(name,expected,observed){
 const pass=JSON.stringify(expected)===JSON.stringify(observed);
 results.push({name,status:pass?'PASS':'FAIL',expected,observed});
 if(!pass)throw Error('FAILED_'+name+': '+JSON.stringify(observed));
}
function sql(file){
 return readFileSync(path.join(ROOT,file),'utf8').split(/\r?\n/).filter(line=>!line.trim().startsWith('--')).join(' ').replace(/\s+/g,' ').trim();
}
let db;
try {
 db=await mf.getD1Database('BITEVO_R50_STAGING_DB');
 await db.prepare(sql('schema/r50h/001-grants.sql').replace(/;$/,'')).run();
 await db.prepare(sql('schema/r50h/002-event-aggregate.sql').replace(/;$/,'')).run();
 const ledger=sql('schema/r50h/003-event-ledger.sql');
 const idx=ledger.indexOf('CREATE TRIGGER ');
 assert.ok(idx>0);
 await db.prepare(ledger.slice(0,idx).trim().replace(/;$/,'')).run();
 await db.prepare(ledger.slice(idx).trim()).run();
 const count=async(table)=>Number((await db.prepare('SELECT count(*) AS n FROM '+table).first()).n);
 const stats=async()=>({grants:await count('bitevo_r50_operator_grants'),ledger:await count('bitevo_r50_event_request_ledger'),aggregate:Number((await db.prepare('SELECT COALESCE(SUM(count),0) AS n FROM bitevo_public_event_daily').first()).n)});
 const claimKey=()=>grantPrefix+randomUUID();
 const policyDigest=()=>createHash('sha256').update(randomBytes(32)).digest('hex');
 const provision=async({notBefore=now-60000,expires=now+180000}={})=>{
  const key=claimKey(),digest=policyDigest();
  await db.prepare('INSERT INTO bitevo_r50_operator_grants (claim_key,policy_digest,not_before_ms,expires_at_ms) VALUES (?,?,?,?)')
    .bind(key,digest,notBefore,expires).run();
  return {key,digest,expires};
 };
 const claim=async(grant,{badSignature=false,stamp=now,reqId=randomUUID(),expires=grant.expires}={})=>{
  const timestamp=String(Math.floor(stamp/1000));
  const body=JSON.stringify({claimKey:grant.key,policyDigest:grant.digest,expiresAtMs:expires,nowMs:stamp});
  const signature=hex('bitevo-r50-grant-claim-v1.'+timestamp+'.'+reqId+'.'+body,badSignature?'BAD_SYNTHETIC_'+secret:secret);
  return mf.dispatchFetch(localUrl('/r50/claim'),{
   method:'POST',headers:{'content-type':'application/json','x-bitevo-r50-claim-timestamp':timestamp,'x-bitevo-r50-claim-request-id':reqId,'x-bitevo-r50-claim-signature':'v1='+signature},body
  });
 };
 const event=async({id=randomUUID(),badSignature=false}={})=>{
  const timestamp=String(Math.floor(Date.now()/1000));
  const body=JSON.stringify({schema:'bitevo.public-event.v1',requestId:id,occurredAt:new Date().toISOString(),event:'triage_click',page:'/agent-authority-audit',locale:'en',ipToken:'a'.repeat(64)});
  const signature=hex('bitevo-public-event-v1.'+timestamp+'.'+id+'.'+body,badSignature?'BAD_SYNTHETIC_'+secret:secret);
  return mf.dispatchFetch(localUrl('/b1-2/event'),{
   method:'POST',headers:{'content-type':'application/json','x-bitevo-event-timestamp':timestamp,'x-bitevo-event-request-id':id,'x-bitevo-event-signature':'v1='+signature},body
  });
 };
 let r=await mf.dispatchFetch(localUrl('/invalid'));result('no_public_routes',{status:404},{status:r.status});
 result('initially_empty',{grants:0,ledger:0,aggregate:0},await stats());
 const g=await provision();
 r=await claim(g);result('valid_grant',{status:200},{status:r.status});
 r=await claim(g);result('same_grant_replay',{status:409},{status:r.status});
 const eid=randomUUID();
 r=await event({id:eid});result('valid_event',{status:200},{status:r.status});
 r=await event({id:eid});result('same_request_id_dedup',{status:409},{status:r.status});
 result('once_only',{grants:1,ledger:1,aggregate:1},await stats());
 const concurrent=await provision();
 const responses=await Promise.all([claim(concurrent),claim(concurrent)]);
 result('concurrent_grant',{statuses:[200,409]}, {statuses:responses.map(r=>r.status).sort((a,b)=>a-b)});
 const bad=await provision();
 r=await claim(bad,{badSignature:true});result('bad_token_HMAC',{status:401},{status:r.status});
 const spent=(await db.prepare('SELECT consumed_at_ms AS at FROM bitevo_r50_operator_grants WHERE claim_key=?').bind(bad.key).first());
 result('bad_token_not_consumed',{consumed:false},{consumed:spent.at!==null});
 const expired=await provision({notBefore:now-180000,expires:now+120000});
 r=await claim(expired,{expires:now+180000});
 result('window_or_digest_mismatch_denied',{status:409},{status:r.status});
 const lostClaim=await provision();
 r=await claim(lostClaim);
 const consumed=(await db.prepare('SELECT consumed_at_ms AS at FROM bitevo_r50_operator_grants WHERE claim_key=?').bind(lostClaim.key).first()).at;
 result('lost_grant_receipt_readback_NO_RETRY',{status:200,consumed:true},{status:r.status,consumed:consumed!==null});
 const before=await stats();
 r=await event();
 const after=await stats();
 result('lost_event_receipt_readback_NO_RETRY',{status:200,deltaLedger:1,deltaAggregate:1},{
 status:r.status,deltaLedger:after.ledger-before.ledger,deltaAggregate:after.aggregate-before.aggregate
 });
 const beforeRollback=await count('bitevo_r50_event_request_ledger');
 await db.prepare('DROP TABLE bitevo_public_event_daily').run();
 r=await event();
 result('trigger_failure_rollback',{status:503,ledgerUnchanged:true},{
 status:r.status,ledgerUnchanged:(await count('bitevo_r50_event_request_ledger'))===beforeRollback
 });
 // Restore aggregate only to clear synthetic data safely.
 await db.prepare(sql('schema/r50h/002-event-aggregate.sql').replace(/;$/,'')).run();
 // We only touch the synthetic local D1, never user files or cloud DBs.
 await db.prepare('DELETE FROM bitevo_r50_event_request_ledger').run();
 await db.prepare('DELETE FROM bitevo_public_event_daily').run();
 await db.prepare('DELETE FROM bitevo_r50_operator_grants').run();
 result('cleanup_zero',{grants:0,ledger:0,aggregate:0},await stats());
 const evidence={
  document:'R50H_ISOLATED_MINIFLARE_LOCAL_TRIAL',
  checkedUtc:new Date().toISOString(),status:'PASS',
  resourceId:dbid,oneWorker:true,oneD1:true,
  externalNetworkRequests:0,productionRequests:0,realCTA:0,calCom:0,
  providerCloudflareRequests:0,secretMaterialInReceipt:false,
  sourceMain:'685c9833db261dd3f39d8edcd663290b11b5f0e3',
  scenarios:results,cleanup:{grants:0,ledger:0,aggregate:0},
  caveats:['locally emulated D1, not Cloudflare provider proof','API production guards not spoofed in Preview','no automatic retry after unknown receipt','Cloudflare Time Travel/log retention unverified']
 };
 writeFileSync(path.join(EVIDENCE,'local-trial-result.json'),JSON.stringify(evidence,null,2)+'\n');
 console.log('R50H_LOCAL_PASS='+results.length+'/'+results.length);
} finally {await mf.dispose()}
