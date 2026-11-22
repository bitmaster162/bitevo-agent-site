import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { evaluateScopeHandoffActivation, SCOPE_HANDOFF_R1_PRODUCTION_PROJECT_ID, SCOPE_HANDOFF_R1_PRODUCTION_ACTIVATION_MODE } from '../src/lib/scope-handoff-r1/activation.js';

export const BASE_SHA='5cb3584be3749a0858485a2c053949d407b4390f9961642b85b05c021e343ead';
export const OVERLAY_SHA='bfb314107fc8db55dad91edabf80e144057e0f1bec210319641135fe0d176675';
export const SCOPE_PATHS=Object.freeze([
  '/','/start','/pricing','/entry-audit','/mapper','/diagnostic','/audit-intake',
  '/ru','/ru/pricing','/ru/mapper','/ru/diagnostic','/ru/audit-intake','/ru/start','/ru/entry-audit'
]);
const keyset=Object.freeze([...SCOPE_PATHS].sort());
const sha=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
const need=(x,why)=>{if(!x)throw Error('PRODUCTION_CURRENTNESS_OVERLAY_DENY:'+why)};
const sameKeys=(value,names)=>value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).sort().join('|')===[...names].sort().join('|');

export function productionUiVariantActive(env=process.env) {
 const state=evaluateScopeHandoffActivation(env);
 return state.profile==='production'&&state.boundary&&state.uiEnabled&&state.productionReady;
}
export function verifyExactProductionOverlay(baseText,overlayText) {
 need(sha(baseText)===BASE_SHA,'BASE_MANIFEST_SHA');
 need(sha(overlayText)===OVERLAY_SHA,'OVERLAY_SHA');
 const base=JSON.parse(baseText),overlay=JSON.parse(overlayText);
 need(base.schema==='bitevo.sitemap-currentness/v1'&&base.normalization==='provider-envelope-v4','BASE_SCHEMA');
 need(Array.isArray(base.routes)&&base.routes.length===142,'BASE_ROUTE_COUNT');
 need(sameKeys(overlay,['schema','normalization','base_manifest_sha256','production_project_id','activation_mode','routes']),'OVERLAY_FIELDS');
 need(overlay.schema==='bitevo.sitemap-currentness.production-overlay/v1'
  &&overlay.normalization==='provider-envelope-v4'
  &&overlay.base_manifest_sha256===BASE_SHA
  &&overlay.production_project_id===SCOPE_HANDOFF_R1_PRODUCTION_PROJECT_ID
  &&overlay.activation_mode===SCOPE_HANDOFF_R1_PRODUCTION_ACTIVATION_MODE,'OVERLAY_IDENTITY');
 need(Array.isArray(overlay.routes)&&overlay.routes.length===14,'OVERLAY_COUNT');
 const names=overlay.routes.map(x=>x.path);
 need(names.slice().sort().join('|')===keyset.join('|'),'EXACT_ALLOWLIST');
 const baseline=new Map(base.routes.map(x=>[x.path,x]));
 need(baseline.size===142,'BASE_DUPLICATE');
 for(const row of overlay.routes){
  need(sameKeys(row,['path','lastmod','fingerprint']),'ROW_FIELDS');
  need(baseline.has(row.path)&&row.lastmod===baseline.get(row.path).lastmod,'ROW_LASTMOD');
  need(/^sha256:[0-9a-f]{64}$/.test(row.fingerprint),'ROW_FINGERPRINT');
  need(row.fingerprint!==baseline.get(row.path).fingerprint,'ROW_MUST_DIFFER');
 }
 return new Map(overlay.routes.map(x=>[x.path,x.fingerprint]));
}
export async function loadProductionOverlayIfActive(baseText,env=process.env){
 if(!productionUiVariantActive(env))return new Map();
 const overlayText=await readFile(new URL('../src/data/sitemap-currentness-production.json',import.meta.url),'utf8');
 return verifyExactProductionOverlay(baseText,overlayText);
}
