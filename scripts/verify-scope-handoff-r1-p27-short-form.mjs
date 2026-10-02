import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { detectSecret, handleScopeHandoffRequest, validateScopePayload } from '../src/lib/scope-handoff-r1/core.js';
import { SCOPE_HANDOFF_R1_RETENTION_DAYS, SCOPE_HANDOFF_R1_STORAGE_OWNER } from '../src/lib/scope-handoff-r1/policy.js';
import { InMemoryScopeHandoffStore } from '../src/lib/scope-handoff-r1/stores.js';

let checks=0;
const check=(v,m)=>{assert.ok(v,m);checks+=1};
const equal=(a,b,m)=>{assert.deepEqual(a,b,m);checks+=1};

const validShort=(overrides={})=>({
  schema_version:'bitevo.scope-handoff.r1',
  client_submission_id:'client_short_00000001',
  submission_intent:'scope_review_only',
  testing_authorization:false,
  locale:'en',
  intake_depth:'short',
  secret_confirmation:true,
  consent_scope_review:true,
  contact_name:'Ada Operator',
  company:'Example Co',
  business_contact:'ada@example.com',
  scope_request:'Review one staging agent action and the owner decision around its authority.',
  environment:'staging',
  offer:'start',
  ...overrides
});

equal(validateScopePayload(validShort()).ok,true,'valid short payload accepted');
check(validateScopePayload(validShort({business_contact:'not-email'})).errors.includes('PATTERN_INVALID:business_contact'),'short contact must be email');
check(validateScopePayload(validShort({environment:'production'})).errors.includes('ENUM_INVALID:environment'),'production is not a short-form environment option');
check(validateScopePayload(validShort({scope_request:'x'.repeat(601)})).errors.includes('LENGTH_INVALID:scope_request'),'short request ceiling is 600 chars');
check(validateScopePayload(validShort({role:'CTO'})).errors.includes('SHORT_FIELD_FORBIDDEN:role'),'short form cannot smuggle Entry fields');
check(validateScopePayload(validShort({offer:'unknown'})).errors.includes('ENUM_INVALID:offer'),'short offer allowlist is exact');
check(detectSecret(validShort({scope_request:`Inspect key ${'sk-proj-'+'A'.repeat(30)}`}))?.pattern==='OPENAI_STYLE_KEY','short scope retains secret rejection');

const allowLimiter=Object.freeze({consume:async()=>({decision:'ALLOW',providerIo:0})});
const request=body=>new Request('https://bitevo.work/api/scope-handoff',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
{
  const store=new InMemoryScopeHandoffStore();
  const queue=new InMemoryScopeHandoffStore();
  const res=await handleScopeHandoffRequest(request(validShort()),{
    enabled:true,rateLimiter:allowLimiter,store,reviewQueue:queue,
    storageOwner:SCOPE_HANDOFF_R1_STORAGE_OWNER,retentionDays:SCOPE_HANDOFF_R1_RETENTION_DAYS,
    idFactory:()=> 'sh_r1_cccccccccccccccccccccccccccccccc',now:()=> '2026-10-02T07:00:00.000Z'
  });
  equal(res.status,201,'short payload uses the existing durable receiver');
  const body=await res.json();
  equal(body.testing_authorization,false,'short receipt never grants testing authorization');
  check(typeof body.retention_until==='string' && Date.parse(body.retention_until)>Date.parse(body.accepted_at),'short durable receipt keeps retention horizon');
}

const controller=await readFile(new URL('../public/scope-handoff-r1.js',import.meta.url),'utf8');
const component=await readFile(new URL('../src/components/ScopeHandoffShort.astro',import.meta.url),'utf8');
const schema=JSON.parse(await readFile(new URL('../src/data/scope-handoff-r1.schema.json',import.meta.url),'utf8'));
const packageJson=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));

check(controller.includes("intake_depth:'short'") && controller.includes('buildShortScopeFields'),'browser controller builds explicit short payloads');
check(controller.includes('data-scope-honeypot'),'browser short form has a honeypot');
const shortMountSource=controller.split('function mountShortScopeHandoffs(options = {})')[1] || '';
check(shortMountSource.indexOf("if (trim(honeypot.value))") >= 0 && shortMountSource.indexOf("if (trim(honeypot.value))") < shortMountSource.indexOf('const outcome = await machine.submit(fields)'),'honeypot exits before short-form network submission');
check(controller.includes('maxlength="600"'),'browser enforces the 600-char ceiling');
check(!controller.includes('Robert replies within') && !controller.includes('Robert ответит в течение'),'no unsupported response-time SLA is published');
check(component.includes('hidden data-scope-short-section') && component.includes('data-scope-handoff-short'),'short UI is statically hidden before runtime reveal');
check(!component.includes('hidden={!activation.uiEnabled}'),'short section visibility is not server-rendered from provider state');
check(controller.includes('function revealScopeHandoffUi') && controller.includes("[data-scope-short-section], [data-scope-handoff-ui-control]"),'browser controller owns runtime UI reveal');
check(component.includes('up to 30 days') && component.includes('до 30 дней'),'short UI discloses the approved retention horizon');
check(component.includes('does not authorize testing or execution') && component.includes('не разрешает testing или execution'),'short UI preserves authorization boundary');
check(JSON.stringify(schema.properties.intake_depth.enum)===JSON.stringify(['short','entry','primary']),'schema exposes the three explicit depths');
check(schema.properties.scope_request.maxLength===600,'schema request ceiling exact');

const surfaces=[
  ['src/pages/start.astro','locale="en" offer="start"'],
  ['src/pages/entry-audit.astro','locale="en" offer="entry_audit"'],
  ['src/pages/pricing.astro','locale="en" offer="pricing"'],
  ['src/pages/diagnostic.astro','locale="en" offer="diagnostic"'],
  ['src/pages/mapper.astro','locale="en" offer="mapper"'],
  ['src/pages/ru/start.astro','locale="ru" offer="start"'],
  ['src/pages/ru/entry-audit.astro','locale="ru" offer="entry_audit"'],
  ['src/pages/ru/pricing.astro','locale="ru" offer="pricing"'],
  ['src/pages/ru/diagnostic.astro','locale="ru" offer="diagnostic"'],
  ['src/pages/ru/mapper.astro','locale="ru" offer="mapper"']
];
for(const [rel,marker] of surfaces){
  const source=await readFile(new URL(`../${rel}`,import.meta.url),'utf8');
  check(source.includes('ScopeHandoffShort') && source.includes(marker),`${rel}: short form marker exact`);
}
for(const rel of ['src/pages/diagnostic.astro','src/pages/mapper.astro','src/pages/ru/diagnostic.astro','src/pages/ru/mapper.astro']){
  const source=await readFile(new URL(`../${rel}`,import.meta.url),'utf8');
  check(source.includes('hidden data-scope-handoff-ui-control'),'diagnostic/mapper CTA is statically hidden: '+rel);
  check(!source.includes('scopeHandoffActivation') && !source.includes('evaluateScopeHandoffActivation'),'diagnostic/mapper static HTML is provider-state independent: '+rel);
}
for(const rel of ['src/pages/audit-intake.astro','src/pages/ru/audit-intake.astro']){
  const source=await readFile(new URL(`../${rel}`,import.meta.url),'utf8');
  check(!source.includes('ScopeHandoffShort'),'full audit intake is not duplicated by the short form');
}
check(packageJson.scripts?.['verify:core']?.includes('verify-scope-handoff-r1-p27-short-form.mjs'),'P27 short-form gate is wired into verify:core');

console.log(`SCOPE_HANDOFF_R1_P27_SHORT_FORM_GATE=PASS checks=${checks} fields=5 honeypot=1 consent=1 sla_claim=0 production_enable=0 surfaces=10 runtime_reveal=CLIENT_ONLY static_cta=4`);
