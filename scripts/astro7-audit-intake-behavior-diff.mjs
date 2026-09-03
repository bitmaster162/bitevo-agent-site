import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const [oldEnPath, oldRuPath, newEnPath, newRuPath, segmentationPath] = process.argv.slice(2);
if (![oldEnPath, oldRuPath, newEnPath, newRuPath, segmentationPath].every(Boolean)) {
  throw new Error('usage: old-en old-ru new-en new-ru segmentation-js');
}
const digest = value => createHash('sha256').update(value).digest('base64');
const segmentationSource = await readFile(segmentationPath, 'utf8');

function inlineScripts(html) {
  const out=[];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs=m[1]||'', body=m[2]||'';
    if (/\bsrc\s*=/.test(attrs) || !body.trim()) continue;
    const type=attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase()||'';
    out.push({ type, body, hash:digest(body) });
  }
  return out;
}

function changedExecutable(oldHtml, newHtml, locale) {
  const oldScripts=inlineScripts(oldHtml), newScripts=inlineScripts(newHtml);
  assert.equal(oldScripts.length,newScripts.length,`${locale}: inline script count drift`);
  const changed=[];
  for(let i=0;i<oldScripts.length;i++) {
    assert.equal(oldScripts[i].type,newScripts[i].type,`${locale}: script type drift at ${i}`);
    if(oldScripts[i].hash!==newScripts[i].hash) changed.push({index:i,old:oldScripts[i],next:newScripts[i]});
  }
  assert.equal(changed.length,1,`${locale}: expected exactly one changed inline script block`);
  assert.equal(changed[0].old.type,'module',`${locale}: changed page script must remain type=module`);
  return changed[0];
}

const configs={
  en:{
    url:'https://bitevo.work/audit-intake', form:'audit-intake', brief:'brief', state:'briefState', secret:'secretConfirm',
    entry:{ company:'Example Co',contact:'Jane Doe <jane@example.com>',role:'CTO',ownerDecision:'Decide whether the workflow retains write authority.',workflow:'Agent prepares one staging update.',criticalAction:'Write one approved staging record.',targetObject:'staging-record-42',authorityOwner:'CTO',expensiveError:'Wrong production object changed.',environment:'staging' },
    primary:{ approver:'Security Lead',externalSystems:'staging-api',forbiddenEffects:'No production writes',preActionEvidence:'Fresh owner approval',freshnessRule:'Current for this attempt',objectBinding:'Immutable target ID',externalConfirmation:'Independent readback',uncertaintyBehavior:'Stop and reconcile',staging:'Yes',replay:'Yes',allowedTests:'One bounded staging write',prohibited:'No production actions',classification:'internal',minimumData:'One redacted staging record',secretBoundary:'Credentials remain outside evidence path' },
    mapper:{ authority_ledger:{workflow:'Mapped workflow',critical_action:'Mapped write',target_binding:'mapped-42',authority_owner:'CTO',prohibited_authority:'No production',expensive_error:'Wrong target',environment:'staging'}, evidence_contract:{pre_action_evidence:'Mapped evidence',freshness_rule:'Fresh',external_confirmation:'Readback',recovery_behavior:'Stop'} }
  },
  ru:{
    url:'https://bitevo.work/ru/audit-intake', form:'ruIntake', brief:'briefText', state:'state', secret:'secretCheck',
    entry:{ company:'Пример Ко',contact:'Иван <ivan@example.com>',role:'CTO',decision:'Решить, сохранять ли write authority.',workflow:'Agent готовит staging update.',action:'Записать один approved staging record.',target:'staging-record-42',owner:'CTO',error:'Изменён неправильный production object.',environment:'staging' },
    primary:{ approver:'Security Lead',systems:'staging-api',forbidden:'Никаких production writes',pre:'Fresh owner approval',fresh:'Только текущая попытка',binding:'Immutable target ID',confirm:'Independent readback',uncertain:'Stop and reconcile',staging:'Да',replay:'Да',allowed:'Один bounded staging write',prohibited:'Никаких production actions',classification:'internal',minimum:'Один redacted staging record',secretBoundary:'Credentials вне evidence path' }
  }
};

const normalizeBrief=value=>String(value||'').replace(/^Generated: .*$/m,'Generated: <ISO>').replace(/\r\n/g,'\n');
const text=value=>String(value||'').replace(/\s+/g,' ').trim();

function setFields(window, values) {
  for(const [id,value] of Object.entries(values)) {
    const el=window.document.getElementById(id);
    assert.ok(el,`missing field #${id}`);
    el.value=value;
  }
}

function snapshot(window, cfg, logs) {
  const root=window.document.querySelector('[data-intake-segmentation]');
  const form=window.document.getElementById(cfg.form);
  const brief=window.document.getElementById(cfg.brief);
  const state=window.document.getElementById(cfg.state);
  const copy=window.document.getElementById('copy');
  const download=window.document.getElementById('download');
  const primaryOnly=[...window.document.querySelectorAll('[data-primary-only]')];
  const primaryRequired=[...window.document.querySelectorAll('[data-primary-required]')];
  return {
    depth:root?.dataset?.intakeDepth||'',
    modeState:text(window.document.querySelector('[data-intake-mode-state]')?.textContent),
    submitText:text(form?.querySelector('button[type="submit"]')?.textContent),
    brief:normalizeBrief(brief?.value), state:text(state?.textContent),
    copyDisabled:Boolean(copy?.disabled), downloadDisabled:Boolean(download?.disabled),
    primaryHidden:primaryOnly.map(el=>Boolean(el.hidden)), primaryRequired:primaryRequired.map(el=>Boolean(el.required)),
    clipboard:[...logs.clipboard], downloads:[...logs.downloads], blobCreates:logs.blobCreates, blobRevokes:logs.blobRevokes
  };
}

function makeDom(html, code, locale, mapperSeed=null) {
  const cfg=configs[locale];
  const dom=new JSDOM(html,{url:cfg.url,runScripts:'outside-only',pretendToBeVisual:true});
  const {window}=dom;
  const logs={clipboard:[],downloads:[],blobCreates:0,blobRevokes:0};
  window.requestAnimationFrame=callback=>{ callback(0); return 1; };
  window.cancelAnimationFrame=()=>{};
  window.setTimeout=()=>1;
  window.clearTimeout=()=>{};
  Object.defineProperty(window.navigator,'clipboard',{configurable:true,value:{writeText:async value=>{logs.clipboard.push(String(value));}}});
  window.URL.createObjectURL=()=>{logs.blobCreates++; return 'blob:scope-test';};
  window.URL.revokeObjectURL=()=>{logs.blobRevokes++;};
  window.HTMLAnchorElement.prototype.click=function(){logs.downloads.push({download:this.download,href:this.href});};
  window.HTMLFormElement.prototype.reportValidity=function(){return true;};
  window.HTMLFormElement.prototype.checkValidity=function(){return true;};
  if(mapperSeed) window.sessionStorage.setItem('bitevo.mapper.handoff.v1',JSON.stringify(mapperSeed));
  // The changed block is emitted as type=module. Wrap it to preserve module-like lexical isolation while using jsdom's outside-only realm.
  window.eval(`(()=>{${code}\n})()`);
  window.eval(segmentationSource);
  return {dom,window,logs,cfg};
}

async function scenarioInitial(html,code,locale) {
  const env=makeDom(html,code,locale);
  const out=snapshot(env.window,env.cfg,env.logs);
  env.dom.window.close();
  return out;
}

async function scenarioMapper(html,code) {
  const env=makeDom(html,code,'en',configs.en.mapper);
  const {window}=env;
  const out={
    snapshot:snapshot(window,env.cfg,env.logs),
    handoffHidden:Boolean(window.document.getElementById('mapperHandoff')?.hidden),
    workflow:window.document.getElementById('workflow')?.value,
    criticalAction:window.document.getElementById('criticalAction')?.value,
    targetObject:window.document.getElementById('targetObject')?.value,
    authorityOwner:window.document.getElementById('authorityOwner')?.value,
    preActionEvidence:window.document.getElementById('preActionEvidence')?.value,
    freshnessRule:window.document.getElementById('freshnessRule')?.value,
    externalConfirmation:window.document.getElementById('externalConfirmation')?.value,
    uncertaintyBehavior:window.document.getElementById('uncertaintyBehavior')?.value
  };
  env.dom.window.close(); return out;
}

async function scenarioEntry(html,code,locale) {
  const env=makeDom(html,code,locale); const {window,cfg,logs}=env;
  setFields(window,cfg.entry); window.document.getElementById(cfg.secret).checked=true;
  const form=window.document.getElementById(cfg.form);
  form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  const generated=snapshot(window,cfg,logs);
  window.document.getElementById('copy').click(); await Promise.resolve(); await Promise.resolve();
  window.document.getElementById('download').click();
  const afterActions=snapshot(window,cfg,logs);
  form.dispatchEvent(new window.Event('reset',{bubbles:true,cancelable:true}));
  const afterReset=snapshot(window,cfg,logs);
  env.dom.window.close(); return {generated,afterActions,afterReset};
}

async function scenarioPrimary(html,code,locale) {
  const env=makeDom(html,code,locale); const {window,cfg,logs}=env;
  window.document.querySelector('[data-intake-mode="primary"]')?.click();
  setFields(window,cfg.entry); setFields(window,cfg.primary); window.document.getElementById(cfg.secret).checked=true;
  const beforeSubmit=snapshot(window,cfg,logs);
  window.document.getElementById(cfg.form).dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  const afterSubmit=snapshot(window,cfg,logs);
  env.dom.window.close(); return {beforeSubmit,afterSubmit};
}

async function compareLocale(oldHtml,newHtml,locale) {
  const changed=changedExecutable(oldHtml,newHtml,locale);
  const checks=[];
  const compare=async(name,fn)=>{
    const [oldResult,newResult]=await Promise.all([fn(oldHtml,changed.old.body,locale),fn(newHtml,changed.next.body,locale)]);
    assert.deepStrictEqual(newResult,oldResult,`${locale}/${name}: observable behavior drift`);
    checks.push(name);
  };
  await compare('initial',scenarioInitial);
  await compare('entry',scenarioEntry);
  await compare('primary',scenarioPrimary);
  if(locale==='en') {
    const [oldMapper,newMapper]=await Promise.all([scenarioMapper(oldHtml,changed.old.body),scenarioMapper(newHtml,changed.next.body)]);
    assert.deepStrictEqual(newMapper,oldMapper,'en/mapper: observable behavior drift'); checks.push('mapper');
  }
  console.log(`AUDIT_INTAKE_BEHAVIOR_LOCALE=PASS locale=${locale} old_hash=${changed.old.hash} new_hash=${changed.next.hash} scenarios=${checks.join(',')}`);
  return {oldHash:changed.old.hash,newHash:changed.next.hash,checks};
}

const oldEn=await readFile(oldEnPath,'utf8'), oldRu=await readFile(oldRuPath,'utf8'), newEn=await readFile(newEnPath,'utf8'), newRu=await readFile(newRuPath,'utf8');
const en=await compareLocale(oldEn,newEn,'en');
const ru=await compareLocale(oldRu,newRu,'ru');
assert.notEqual(en.oldHash,ru.oldHash,'EN/RU old hashes should be distinct');
assert.notEqual(en.newHash,ru.newHash,'EN/RU new hashes should be distinct');
console.log('ASTRO7_AUDIT_INTAKE_BEHAVIOR_DIFF=PASS locales=2 changed_scripts=2 mapper=PASS entry=PASS primary=PASS copy=PASS download=PASS reset=PASS segmentation=PASS');
