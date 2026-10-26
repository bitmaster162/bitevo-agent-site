import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const cfg=read('wrangler.r50h-staging.jsonc');
test('isolated provider resource names exactly expected',()=>{
 assert.match(cfg,/"name": "bitevo-r50-staging-20261026"/);
 assert.match(cfg,/"database_name": "bitevo-r50-staging-20261026"/);
});
test('no production D1, no school D1',()=>{
 assert.doesNotMatch(cfg,/b533a76e|1de9ec7f|bitevo-events-b12|ai-skill-lab-leads-r101b/i);
});
test('staging config is unreleasable until real isolated UUID readback',()=>{
 assert.match(cfg,/00000000-0000-0000-0000-000000000000/);
});
test('staging stays off and logs remain off by default',()=>{
 assert.match(cfg,/"BITEVO_R50_GRANT_RECEIVER_ENABLED": "false"/);
 assert.match(cfg,/"BITEVO_EVENT_COUNTER_RECEIVER_ENABLED": "false"/);
 assert.match(cfg,/"observability": \{ "enabled": false \}/);
});
test('entry is isolated without ASSETS or public routes',()=>{
 const s=read('worker/r50h-staging-entry.mjs');
 assert.match(s,/handleR50GrantClaim/);
 assert.match(s,/handleBitEvoWorkerEvent/);
 assert.doesNotMatch(s,/ASSETS|fetch\(request\).*ASSETS/);
});
test('the old production worker remains unmodified',()=>{
 assert.equal(createHash('sha256').update(read('worker/index.mjs')).digest('hex'),
 'e9d5400e6adf144b85f900301ecda2a20d550e0cf68f3613d2d0ce4e3a32071a');
});
test('original two dangerous deployment configs pinned but unused',()=>{
 assert.match(read('wrangler.r50-grant.jsonc'),/"database_name": "bitevo-events-b12"/);
 assert.match(read('wrangler.jsonc'),/"name": "bitevo-agent-site"/);
});
test('staging migration matches independently tested SQL',()=>{
 const pairs=[['schema/r50h/001-grants.sql','schema/bitevo_r50_operator_grants.sql'],
 ['schema/r50h/002-event-aggregate.sql','schema/bitevo_public_event_daily.sql'],
 ['schema/r50h/003-event-ledger.sql','schema/bitevo_r50_event_dedup_candidate.sql']];
 for(const [a,b] of pairs)assert.equal(read(a),read(b));
});
test('R50H branch Vercel automatic deploy is disabled',()=>{
 const v=JSON.parse(read('vercel.json'));
 assert.equal(v.git.deploymentEnabled['agent/site-r50h-staging-trial-20261026-r1'],false);
});
test('no automatic cloud mutation from test source',()=>{
 const s=read('scripts/r50h/local-trial.mjs');
 assert.doesNotMatch(s,/wrangler\s+(deploy|d1 create|d1 execute)|https:\/\/bitevo.work/);
});
test('cloud cleanup requires exact UUID and explicit execute',()=>{
 const s=read('scripts/r50h/cloud-cleanup.ps1');
 assert.match(s,/-DatabaseId/);
 assert.match(s,/if\(-not \$Execute\)/);
 assert.doesNotMatch(s,/d1 delete|worker delete/i);
});
test('production public mode remains disabled',()=>{
 const coverage=JSON.parse(read('src/data/bitevo-event-coverage.json'));
 assert.equal(coverage.defaultMode,'disabled');
});
