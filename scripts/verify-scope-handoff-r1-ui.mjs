import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const clientPath = process.argv[2] || new URL('../public/scope-handoff-r1.js', import.meta.url);
const packagePath = process.argv[3] || new URL('../package.json', import.meta.url);
const source = await readFile(clientPath, 'utf8');
const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const normalize = value => JSON.parse(JSON.stringify(value));
const equal = (actual, expected, message) => { assert.deepEqual(normalize(actual), normalize(expected), message); checks += 1; };

function loadApi(extra = {}) {
  const context = {
    console, Date, JSON, Object, Array, Set, Map, RegExp, String, Number, Boolean, Error, Promise,
    Uint8Array, TextEncoder, AbortController, DOMException, structuredClone,
    setTimeout, clearTimeout,
    __BITEVO_SCOPE_HANDOFF_R1_TEST_MODE__: true,
    ...extra
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename:'scope-handoff-r1.js' });
  return { api:context.__BITEVO_SCOPE_HANDOFF_R1_TEST_API__, context };
}

{
  let documentReads = 0;
  const context = {
    console, Date, JSON, Object, Array, Set, Map, RegExp, String, Number, Boolean, Error, Promise,
    Uint8Array, TextEncoder, AbortController, DOMException, structuredClone, setTimeout, clearTimeout,
    document:{ querySelector(){ documentReads += 1; throw new Error('default-off source queried DOM'); } }
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename:'scope-handoff-r1.js' });
  equal(documentReads, 0, 'default-off source performs no DOM work');
}

const { api } = loadApi();
check(api && api.UI_ENABLED === false, 'UI source default is disabled');
check(api.ENDPOINT === '/api/scope-handoff', 'same-origin endpoint is fixed');
check(source.includes('if (UI_ENABLED && typeof document'), 'automatic mount remains source-gated');
check(!source.includes('localStorage') && !source.includes('sessionStorage') && !source.includes('document.cookie'), 'browser storage and cookies are not read');
check(!source.includes('sendBeacon') && !source.includes('XMLHttpRequest'), 'alternate network transports are absent');
equal((source.match(/method:'POST'/g) || []).length, 1, 'one explicit POST construction exists');
check(source.includes("credentials:'same-origin'") && source.includes("cache:'no-store'") && source.includes("redirect:'error'") && source.includes("referrerPolicy:'same-origin'"), 'fetch boundary is explicit');
check(pkg.scripts?.['verify:core']?.includes('verify-scope-handoff-r1-ui.mjs'), 'focused UI verifier is wired into the core gate');

const entryValues = {
  company:'Example Co', business_contact:'Jane Doe <jane@example.com>', role:'CTO',
  owner_decision:'Decide whether the workflow retains write authority.', workflow:'Prepare one bounded update.',
  critical_action:'Write one approved record.', target_object:'Staging record ID 42.', authority_owner:'CTO',
  expensive_error:'Wrong production object changed.', environment:'staging'
};
const entry = api.buildScopeFields({ locale:'en', depth:'entry', values:entryValues, secretConfirmation:true, consent:true });
equal(Object.keys(entry).sort(), [
  'authority_owner','business_contact','company','consent_scope_review','critical_action','environment','expensive_error',
  'intake_depth','locale','owner_decision','role','schema_version','secret_confirmation','submission_intent',
  'target_object','testing_authorization','workflow'
].sort(), 'Entry maps only the bounded common fields');
equal(api.validateScopeFields(entry), [], 'Entry client contract validates');
check(!('access_approver' in entry) && !('staging_available' in entry), 'Entry excludes deferred Primary fields');

const primaryValues = {
  ...entryValues, access_approver:'Security Lead', external_systems:'staging API', forbidden_effects:'No production writes',
  pre_action_evidence:'Fresh written approval', freshness_rule:'Valid for this attempt', object_binding_evidence:'Immutable ID',
  external_confirmation:'Independent readback', uncertainty_behavior:'Stop and reconcile', staging_available:'Частично / нужна настройка',
  safe_replay_available:'Да', allowed_tests:'One staging write', prohibited_audit_actions:'No production action',
  data_classification:'internal', minimum_necessary_data:'One redacted record', secret_handling_boundary:'No credentials'
};
const primary = api.buildScopeFields({ locale:'ru', depth:'primary', values:primaryValues, secretConfirmation:true, consent:true });
equal(primary.locale, 'ru', 'RU locale is explicit');
equal(primary.staging_available, 'partial', 'RU partial enum maps identically');
equal(primary.safe_replay_available, 'yes', 'RU yes enum maps identically');
equal(api.validateScopeFields(primary), [], 'Primary client contract validates');
for (const key of api.PRIMARY_REQUIRED) check(key in primary, `Primary includes ${key}`);
for (const forbidden of ['brief','raw_brief','generated_brief','mapper','session_storage','local_storage','cookie','analytics_id','fingerprint']) {
  check(!(forbidden in primary), `payload excludes ${forbidden}`);
}

check(api.validateScopeFields({ ...entry, consent_scope_review:false }).includes('CONSENT_SCOPE_REVIEW'), 'consent is mandatory');
check(api.validateScopeFields({ ...entry, testing_authorization:true }).includes('TESTING_AUTHORIZATION'), 'testing authorization cannot be raised');
check(api.validateScopeFields({ ...entry, company:'x'.repeat(201) }).includes('LENGTH:company'), 'client length bound matches schema');
check(api.scopeFingerprint(entry) === api.scopeFingerprint({ ...entry, consent_scope_review:false, secret_confirmation:false }), 'consent toggles do not mutate scope fingerprint');

const response = (status, body, headers = {}) => ({
  status,
  headers:{ get(name){ const key = Object.keys(headers).find(item => item.toLowerCase() === name.toLowerCase()); return key ? String(headers[key]) : null; } },
  async json(){ if (body instanceof Error) throw body; return structuredClone(body); }
});
const acceptedBody = (payload, replayed = false) => ({
  schema_version:'bitevo.scope-handoff.r1', status:'RECEIVED_FOR_SCOPE_REVIEW',
  delivery_status:'INTAKE_RECORD_ACCEPTED', human_review_status:'NOT_CONFIRMED', testing_authorization:false,
  submission_id:'sh_r1_0123456789abcdef0123456789abcdef', client_submission_id:payload.client_submission_id,
  accepted_at:'2026-09-05T00:00:00.000Z', replayed
});

{
  let fetchCount = 0;
  let releaseFetch;
  const bodies = [];
  const machine = api.createSubmissionMachine({
    cryptoApi:{ randomUUID:() => '11111111-2222-4333-8444-555555555555' },
    fetchImpl:async (_url, options) => {
      fetchCount += 1;
      bodies.push(options.body);
      await new Promise(resolve => { releaseFetch = resolve; });
      const payload = JSON.parse(options.body);
      return response(201, acceptedBody(payload, false));
    }
  });
  const first = machine.submit(entry);
  const second = machine.submit(entry);
  await Promise.resolve();
  equal(fetchCount, 1, 'double click is serialized to one fetch');
  releaseFetch();
  const [a,b] = await Promise.all([first, second]);
  equal(a.kind, 'accepted', 'first concurrent caller receives accepted state');
  equal(b.kind, 'accepted', 'second concurrent caller receives same accepted state');
  equal(bodies.length, 1, 'serialized request body count is one');
  const payload = JSON.parse(bodies[0]);
  check(/^shr1_[a-f0-9]{32}$/.test(payload.client_submission_id), 'client id is bounded and URL-safe');
  equal(Object.keys(payload).sort(), [...Object.keys(entry), 'client_submission_id'].sort(), 'wire body contains only schema fields');
  const cached = await machine.submit(entry);
  equal(cached.cached, true, 'accepted scope cannot be submitted twice');
  equal(fetchCount, 1, 'accepted cached state creates no second POST');
}

{
  const ids = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
  const sentBodies = [];
  let attempt = 0;
  const machine = api.createSubmissionMachine({
    cryptoApi:{ randomUUID:() => ids.shift() },
    fetchImpl:async (_url, options) => {
      sentBodies.push(options.body);
      attempt += 1;
      if (attempt === 1) throw new Error('connection lost');
      const payload = JSON.parse(options.body);
      return response(201, acceptedBody(payload, false));
    }
  });
  const unknown = await machine.submit(entry);
  equal(unknown.kind, 'unknown', 'network uncertainty is not success');
  const accepted = await machine.submit(entry);
  equal(accepted.kind, 'accepted', 'manual retry may reconcile');
  equal(sentBodies[0], sentBodies[1], 'manual retry preserves exact body and idempotency key');
  equal(ids.length, 1, 'manual retry does not mint a replacement ID');
}

{
  let calls = 0;
  const bodies = [];
  const machine = api.createSubmissionMachine({
    cryptoApi:{ randomUUID:() => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
    fetchImpl:async (_url, options) => {
      calls += 1; bodies.push(options.body);
      if (calls === 1) return response(429, { error:'RATE_LIMITED', testing_authorization:false }, { 'Retry-After':'42' });
      const payload = JSON.parse(options.body);
      return response(200, acceptedBody(payload, true));
    }
  });
  const limited = await machine.submit(entry);
  equal(limited.kind, 'rate_limited', '429 has distinct state');
  equal(limited.retryAfter, 42, 'Retry-After is bounded into UI state');
  const retry = await machine.submit(entry);
  equal(retry.kind, 'accepted', 'rate-limited request can be manually retried');
  equal(bodies[0], bodies[1], 'rate-limit retry preserves the exact body');
}

{
  let calls = 0;
  const machine = api.createSubmissionMachine({
    cryptoApi:{ randomUUID:() => 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
    fetchImpl:async () => { calls += 1; return response(503, { status:'SERVICE_DISABLED', provider_io:0, testing_authorization:false }); }
  });
  const out = await machine.submit(entry);
  equal(out.kind, 'unavailable', 'disabled runtime is distinct from unknown');
  await machine.submit(entry);
  equal(calls, 2, 'retry remains explicit and user initiated');
}

{
  const machine = api.createSubmissionMachine({
    cryptoApi:{ randomUUID:() => 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' },
    fetchImpl:async (_url, options) => response(200, { status:'RECEIVED_FOR_SCOPE_REVIEW', client_submission_id:JSON.parse(options.body).client_submission_id })
  });
  equal((await machine.submit(entry)).kind, 'unknown', 'partial 2xx receipt is UNKNOWN, never success');
  const changed = { ...entry, company:'Changed Co' };
  equal(machine.releaseForNewScope(changed).ok, false, 'unknown state blocks automatic replacement ID');
}

{
  let calls = 0;
  const machine = api.createSubmissionMachine({
    cryptoApi:{ randomUUID:() => 'ffffffff-ffff-4fff-8fff-ffffffffffff' },
    fetchImpl:async () => { calls += 1; return response(409, { error:'IDEMPOTENCY_CONFLICT' }); }
  });
  equal((await machine.submit(entry)).kind, 'conflict', '409 has explicit conflict state');
  equal((await machine.submit(entry)).cached, true, 'conflict is not blindly retried');
  equal(calls, 1, 'conflict creates no second POST');
  equal(machine.releaseForNewScope({ ...entry, company:'Changed Co' }).ok, false, 'conflict blocks replacement ID');
}

{
  let calls = 0;
  const ids = ['12121212-1212-4212-8212-121212121212','34343434-3434-4434-8434-343434343434'];
  const machine = api.createSubmissionMachine({
    cryptoApi:{ randomUUID:() => ids.shift() },
    fetchImpl:async (_url, options) => {
      calls += 1;
      if (calls === 1) return response(422, { error:'SCHEMA_REJECTED' });
      const payload = JSON.parse(options.body);
      return response(201, acceptedBody(payload, false));
    }
  });
  equal((await machine.submit(entry)).kind, 'rejected', 'definitive 4xx is rejected');
  equal((await machine.submit(entry)).cached, true, 'same rejected payload is not blindly repeated');
  const changed = { ...entry, company:'Corrected Co' };
  equal(machine.releaseForNewScope(changed).ok, true, 'definitive rejection permits a changed user-generated scope');
  equal((await machine.submit(changed)).kind, 'accepted', 'changed corrected scope starts a new explicit cycle');
  equal(calls, 2, 'new corrected cycle creates exactly one additional POST');
}

for (const locale of ['en','ru']) {
  const markup = api.renderShell(locale);
  check(markup.includes('role="status"') && markup.includes('aria-live="polite"') && markup.includes('aria-atomic="true"'), `${locale}: accessible status semantics`);
  check(markup.includes('data-scope-consent') && markup.includes('data-scope-submit disabled'), `${locale}: separate consent and disabled final action`);
  check(markup.includes('mailto:robert@bitevo.work?subject=BitEvo%20scope%20review'), `${locale}: manual fallback is preserved`);
  check(markup.includes('data-scope-client-id'), `${locale}: reconciliation ID output exists`);
}

class FakeElement {
  constructor(name = 'div') {
    this.name = name; this.value = ''; this.checked = false; this.hidden = false; this.disabled = false;
    this.dataset = {}; this.attributes = new Map(); this.listeners = new Map(); this.lookup = new Map();
    this.children = []; this.parent = null; this.className = ''; this.textContent = '';
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g,(_m,c)=>c.toUpperCase())] = String(value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener) { const list=this.listeners.get(type)||[]; list.push(listener); this.listeners.set(type,list); }
  async emit(type, event = {}) { for (const listener of this.listeners.get(type)||[]) await listener({ target:this, ...event }); }
  querySelector(selector) { return this.lookup.get(selector) || null; }
  append(child) { child.parent=this; this.children.push(child); }
  insertBefore(child, before) { child.parent=this; const index=this.children.indexOf(before); if(index<0)this.children.push(child); else this.children.splice(index,0,child); }
  closest() { return this.parent; }
  set innerHTML(_value) {
    const consent=new FakeElement('consent'); const submit=new FakeElement('submit'); submit.disabled=true;
    const status=new FakeElement('status'); const output=new FakeElement('output'); output.hidden=true;
    this.lookup.set('[data-scope-consent]',consent); this.lookup.set('[data-scope-submit]',submit);
    this.lookup.set('[data-scope-status]',status); this.lookup.set('[data-scope-client-id]',output);
  }
}

function fakePage(locale, fetchImpl) {
  const root=new FakeElement('root'); root.setAttribute('data-intake-locale',locale); root.dataset.intakeDepth='entry';
  const form=new FakeElement('form'); form.checkValidity=()=>true;
  const brief=new FakeElement('brief'); brief.value='';
  const host=new FakeElement('host'); const gate=new FakeElement('gate'); host.children.push(gate); host.lookup.set('.gate',gate); brief.parent=host;
  const ids=locale==='ru' ? api.BASE_IDS.ru : api.BASE_IDS.en;
  for (const [key,id] of Object.entries(ids)) { const field=new FakeElement(id); field.value=entryValues[key]; root.lookup.set(`#${id}`,field); }
  const secret=new FakeElement('secret'); secret.checked=true; root.lookup.set(locale==='ru'?'#secretCheck':'#secretConfirm',secret);
  root.lookup.set(locale==='ru'?'#ruIntake':'#audit-intake',form); root.lookup.set('[data-segmented-brief]',brief);
  const doc={ querySelector:selector=>selector==='[data-intake-segmentation]'?root:null, createElement:()=>new FakeElement('section') };
  let fetchCount=0;
  const controller=api.mountScopeHandoff({
    enabled:true, document:doc,
    fetchImpl:async (url, options)=>{ fetchCount+=1; return fetchImpl(url,options); },
    cryptoApi:{ randomUUID:()=>'56565656-5656-4565-8565-565656565656' },
    requestAnimationFrameImpl:fn=>fn()
  });
  return { root, form, brief, host, controller, fetchCount:()=>fetchCount };
}

{
  const page=fakePage('en', async (_url,options)=>response(201,acceptedBody(JSON.parse(options.body),false)));
  check(page.controller.mounted, 'EN progressive enhancement mounts when explicitly enabled');
  equal(page.fetchCount(),0,'mount performs no POST');
  page.brief.value='local brief';
  page.controller.armGeneratedBrief();
  equal(page.fetchCount(),0,'brief generation performs no POST');
  const consent=page.controller.shell.querySelector('[data-scope-consent]'); consent.checked=true;
  page.controller.refresh();
  const button=page.controller.shell.querySelector('[data-scope-submit]');
  equal(button.disabled,false,'explicit consent unlocks final action only after local brief');
  await page.controller.handleClick();
  equal(page.fetchCount(),1,'explicit final action performs exactly one POST');
  equal(page.controller.shell.getAttribute('data-scope-state'),'accepted','valid receipt renders accepted state');
  const status=page.controller.shell.querySelector('[data-scope-status]').textContent.toLowerCase();
  for (const claim of [' sent','delivered',' read','booked','approved','engagement started']) check(!status.includes(claim), `accepted UI avoids false-green claim: ${claim.trim()}`);
}

{
  const page=fakePage('ru', async (_url,options)=>response(503,{status:'SERVICE_DISABLED',provider_io:0,testing_authorization:false}));
  page.brief.value='local brief'; page.controller.armGeneratedBrief();
  const consent=page.controller.shell.querySelector('[data-scope-consent]'); consent.checked=true; page.controller.refresh();
  await page.form.emit('input'); await page.form.emit('change'); await page.root.emit('click',{target:{closest:()=>null}});
  equal(page.fetchCount(),0,'RU input/change/mode events perform no POST');
  await page.controller.handleClick();
  equal(page.fetchCount(),1,'RU explicit final action uses the same controller');
  equal(page.controller.shell.getAttribute('data-scope-state'),'unavailable','RU shares fail-closed unavailable state');
}

console.log(`SCOPE_HANDOFF_R1_UI_GATE=PASS checks=${checks} locales=2 progressive_enhancement=PASS auto_post=0 explicit_post_only=1 idempotency=PASS false_green=PASS accessible_states=PASS manual_fallback=PRESERVED ui_default=DISABLED`);
