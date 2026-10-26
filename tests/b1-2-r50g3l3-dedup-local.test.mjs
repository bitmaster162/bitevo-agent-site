// R50-G3-L3 isolated candidate contract tests, no network.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const repo=path.resolve(new URL('..',import.meta.url).pathname).replace(/^\/(?:[A-Za-z]:)/,x=>x.slice(1));
const original=readFileSync(new URL('../worker/index.mjs',import.meta.url),'utf8');
const candidate=readFileSync(new URL('../worker/r50-event-dedup-candidate.mjs',import.meta.url),'utf8');
const ddl=readFileSync(new URL('../schema/bitevo_r50_event_dedup_candidate.sql',import.meta.url),'utf8');
const baseline=readFileSync(new URL('../schema/bitevo_public_event_daily.sql',import.meta.url),'utf8');
const config=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
const grantConfig=readFileSync(new URL('../wrangler.r50-grant.jsonc',import.meta.url),'utf8');
const coverage=JSON.parse(readFileSync(new URL('../src/data/bitevo-event-coverage.json',import.meta.url),'utf8'));
const digest=s=>createHash('sha256').update(s).digest('hex');
function openDB(){
  const db=new DatabaseSync(':memory:');
  db.exec(baseline);
  db.exec(ddl);
  return db;
}
function insert(db,id){
 return db.prepare('INSERT INTO bitevo_r50_event_request_ledger (request_id, day, event_name, page, locale, received_at_ms) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(request_id) DO NOTHING')
 .run(id,'2026-10-21','triage_click','/agent-authority-audit','en',Date.parse('2026-10-21T00:00:00Z'));
}
function count(db,table){
 return Number(db.prepare('SELECT COUNT(*) AS n FROM '+table).get().n);
}
test('production Worker original SHA unchanged',()=>{
 assert.equal(digest(original),'e9d5400e6adf144b85f900301ecda2a20d550e0cf68f3613d2d0ce4e3a32071a');
 assert.match(candidate,/R50_DEDUP_INSERT/);
 assert.doesNotMatch(original,/R50_DEDUP_INSERT|DUPLICATE_REQUEST/);
});
test('candidate is separate, default-only workerd entry',async()=>{
 const entry=await import('../worker/r50-event-dedup-entry.mjs');
 assert.deepEqual(Object.keys(entry),['default']);
 assert.equal(typeof entry.default.fetch,'function');
});
test('candidate has exact SQL trigger check and fail-closed duplicate',()=>{
 assert.match(candidate,/COUNTER_DEDUP_NOT_READY/);
 assert.match(candidate,/DUPLICATE_REQUEST/);
 assert.match(candidate,/meta\.changes !== 2/);
 assert.match(candidate,/meta\.changed_db !== true/);
 assert.match(candidate,/R50_DEDUP_TRIGGER_READ/);
});
test('local candidate ledger contains no PII or HMAC values',()=>{
 assert.ok(ddl.includes('CREATE TRIGGER bitevo_r50_event_aggregate_once'));
 assert.ok(ddl.includes('request_id TEXT PRIMARY KEY'));
 const statements=ddl.split(/\r?\n/).filter(line=>!line.trim().startsWith('--')).join(' ');
 assert.doesNotMatch(statements,/ip_token|ipToken|password|signing_secret|email|contact_id|customer_id/i);
 assert.ok(ddl.includes('received_at_ms'));
});
test('original deployment configs/coverage remain disabled',()=>{
 assert.ok(config.includes('"name": "bitevo-agent-site"'));
 assert.ok(grantConfig.includes('"database_name": "bitevo-events-b12"'));
 assert.equal(coverage.defaultMode,'disabled');
});
test('native SQLite atomic trigger inserts and duplicate does not increment',()=>{
 const db=openDB();
 try{
  const id=randomUUID();
  assert.equal(insert(db,id).changes,1);
  assert.equal(insert(db,id).changes,0);
  assert.equal(count(db,'bitevo_r50_event_request_ledger'),1);
  assert.equal(count(db,'bitevo_public_event_daily'),1);
  assert.equal(db.prepare('SELECT count AS n FROM bitevo_public_event_daily').get().n,1);
 }finally{db.close()}
});
test('native SQLite trigger failure rolls back ledger insert',()=>{
 const db=openDB();
 try{
  db.exec('DROP TABLE bitevo_public_event_daily');
  assert.throws(()=>insert(db,randomUUID()));
  assert.equal(count(db,'bitevo_r50_event_request_ledger'),0);
 }finally{db.close()}
});
test('missing ledger never falls back to original UPSERT',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(baseline);
  assert.throws(()=>insert(db,randomUUID()));
  assert.equal(count(db,'bitevo_public_event_daily'),0);
 }finally{db.close()}
});
