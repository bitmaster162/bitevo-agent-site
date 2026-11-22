import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyExactProductionOverlay, productionUiVariantActive, BASE_SHA, OVERLAY_SHA, SCOPE_PATHS } from './production-currentness-overlay-r1.mjs';
import { SCOPE_HANDOFF_R1_STORAGE_OWNER } from '../src/lib/scope-handoff-r1/policy.js';
const source=readFileSync(new URL('../src/data/sitemap-currentness.json',import.meta.url),'utf8');
const overlay=readFileSync(new URL('../src/data/sitemap-currentness-production.json',import.meta.url),'utf8');
const selected=verifyExactProductionOverlay(source,overlay);
assert.equal(selected.size,14);
assert.deepEqual([...selected.keys()].sort(),[...SCOPE_PATHS].sort());
const fixture={
 VERCEL:'1', VERCEL_ENV:'production',VERCEL_TARGET_ENV:'production',
 VERCEL_PROJECT_ID:'prj_U2iHyiwhJlO33r0u4uN65PpdzEiv',
 SCOPE_HANDOFF_R1_ACTIVATION_MODE:'production_scope_review_r1',
 SCOPE_HANDOFF_R1_ENABLED:'true',SCOPE_HANDOFF_R1_UI_ENABLED:'true',
 SCOPE_HANDOFF_R1_OPERATOR_REVIEW_ENABLED:'true',
 SCOPE_HANDOFF_R1_OPERATOR_REVIEW_TOKEN:'x'.repeat(48),
 SCOPE_HANDOFF_R1_STORAGE_OWNER:SCOPE_HANDOFF_R1_STORAGE_OWNER,
 SCOPE_HANDOFF_R1_RETENTION_DAYS:'30',
 SCOPE_HANDOFF_R1_RATE_LIMIT_KEY_SECRET:'k'.repeat(48),
 SCOPE_HANDOFF_R1_NOTIFICATION_ENABLED:'true',
 SCOPE_HANDOFF_R1_TELEGRAM_BOT_TOKEN:'123456:'+'A'.repeat(32),
 SCOPE_HANDOFF_R1_TELEGRAM_CHAT_ID:'123456789'
};
assert.equal(productionUiVariantActive(fixture),true,'synthetic exact production mode must select overlay');
for(const [key,bad] of [
 ['VERCEL_ENV','preview'],
 ['VERCEL_PROJECT_ID','prj_wrong'],
 ['SCOPE_HANDOFF_R1_UI_ENABLED','false'],
 ['SCOPE_HANDOFF_R1_ACTIVATION_MODE','isolated_staging_preview_r1'],
 ['SCOPE_HANDOFF_R1_OPERATOR_REVIEW_TOKEN',''],
 ['SCOPE_HANDOFF_R1_ENABLED','false']
]) assert.equal(productionUiVariantActive({...fixture,[key]:bad}),false,key+' must fail closed');
assert.equal(productionUiVariantActive({}),false);
assert.equal(productionUiVariantActive({...fixture,SCOPE_HANDOFF_R1_NOTIFICATION_ENABLED:'false'}),false);
const wrongSource=source.replace('2026-11-21','2026-11-20');
assert.notEqual(wrongSource,source);
assert.throws(()=>verifyExactProductionOverlay(wrongSource,overlay),/BASE_MANIFEST_SHA/);
const wrongOverlay=overlay.replace(selected.get('/'),selected.get('/').replace(/^sha256:/,'sha256:0'));
assert.notEqual(wrongOverlay,overlay);
assert.throws(()=>verifyExactProductionOverlay(source,wrongOverlay),/OVERLAY_SHA/);
assert.throws(()=>verifyExactProductionOverlay(source,overlay.slice(0,-1)),/OVERLAY_SHA/);
assert.equal(BASE_SHA,'012c14f3de0e63f4b9940c56b257a4f09a9c1236b7b18a83fd7618c13abc18c1');
assert.equal(OVERLAY_SHA,'04d9781420aa8dc58c7be5258582e14d0b9a96aef71ee6ab184e8c4b9da9efcb');
console.log('PRODUCTION_CURRENTNESS_OVERLAY=PASS routes=14 exact_sha=2 source_variants=2 mode_negatives=7 tamper_denied=3 no_provider_io=1');
