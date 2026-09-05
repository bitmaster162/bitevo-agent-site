import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleScopeHandoffRequest, MAX_BODY_BYTES } from '../src/lib/scope-handoff-r1/core.js';
import {
  GLOBAL_RATE_LIMIT_CAS_MAX_ATTEMPTS,
  GLOBAL_RATE_LIMIT_MODE,
  GLOBAL_RATE_LIMIT_PATHNAME,
  GLOBAL_RATE_LIMIT_SCHEMA,
  consumeGlobalFixedWindow,
  createGlobalFixedWindowLimiter,
  globalRateLimitConfigurationDigest,
  parseGlobalRateLimitConfig,
  validateGlobalRateLimitState
} from '../src/lib/scope-handoff-r1/rate-limit.js';
import {
  InMemoryScopeHandoffStore,
  createVercelBlobGlobalRateLimitStore
} from '../src/lib/scope-handoff-r1/stores.js';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const clone = value => value === null ? null : structuredClone(value);
let mutationSequence = 0;
const mutationId = () => `rl_${(++mutationSequence).toString(16).padStart(32, '0')}`;
class MemoryCasStore {
  constructor(snapshot = null) {
    this.snapshot = snapshot ? clone(snapshot) : null;
    this.version = snapshot ? 1 : 0;
    this.readCount = 0;
    this.createCount = 0;
    this.replaceCount = 0;
    this.failRead = false;
    this.failCreateBeforeCommit = false;
    this.failReplaceBeforeCommit = false;
    this.uncertainCreateAfterCommit = false;
    this.uncertainReplaceAfterCommit = false;
    this.forcedCreateConflicts = 0;
    this.forcedReplaceConflicts = 0;
  }
  set(value) {
    this.version += 1;
    this.snapshot = { value:clone(value), etag:`etag-${this.version}` };
  }
  async read() {
    this.readCount += 1;
    await Promise.resolve();
    if (this.failRead) throw new Error('FAKE_READ_UNCERTAIN');
    return clone(this.snapshot);
  }
  async createIfAbsent(_pathname, value) {
    this.createCount += 1;
    await Promise.resolve();
    if (this.forcedCreateConflicts > 0) {
      this.forcedCreateConflicts -= 1;
      return { created:false };
    }
    if (this.failCreateBeforeCommit) throw new Error('FAKE_CREATE_UNCERTAIN');
    if (this.snapshot) return { created:false };
    this.set(value);
    if (this.uncertainCreateAfterCommit) {
      this.uncertainCreateAfterCommit = false;
      throw new Error('FAKE_CREATE_ACK_LOST');
    }
    return { created:true };
  }
  async replaceIfMatch(_pathname, value, etag) {
    this.replaceCount += 1;
    await Promise.resolve();
    if (this.forcedReplaceConflicts > 0) {
      this.forcedReplaceConflicts -= 1;
      return { replaced:false };
    }
    if (this.failReplaceBeforeCommit) throw new Error('FAKE_REPLACE_UNCERTAIN');
    if (!this.snapshot || this.snapshot.etag !== etag) return { replaced:false };
    this.set(value);
    if (this.uncertainReplaceAfterCommit) {
      this.uncertainReplaceAfterCommit = false;
      throw new Error('FAKE_REPLACE_ACK_LOST');
    }
    return { replaced:true };
  }
}
function config(maxRequests = 3, windowSeconds = 60) {
  const parsed = parseGlobalRateLimitConfig({
    SCOPE_HANDOFF_R1_RATE_LIMIT_MODE:GLOBAL_RATE_LIMIT_MODE,
    SCOPE_HANDOFF_R1_RATE_LIMIT_MAX_REQUESTS:String(maxRequests),
    SCOPE_HANDOFF_R1_RATE_LIMIT_WINDOW_SECONDS:String(windowSeconds)
  });
  assert.equal(parsed.ok, true);
  return parsed.config;
}

function stateFor(cfg, nowMs, count, overrides = {}) {
  const windowStart = Math.floor(nowMs / cfg.windowMs) * cfg.windowMs;
  return {
    schema:GLOBAL_RATE_LIMIT_SCHEMA,
    window_start_ms:windowStart,
    window_end_ms:windowStart + cfg.windowMs,
    count,
    updated_at:new Date(nowMs).toISOString(),
    configuration_digest:cfg.configurationDigest,
    mutation_id:mutationId(),
    ...overrides
  };
}

const entry = (id = 'client_submit_00000001') => ({
  schema_version:'bitevo.scope-handoff.r1', client_submission_id:id,
  submission_intent:'scope_review_only', testing_authorization:false,
  locale:'en', intake_depth:'entry', secret_confirmation:true, consent_scope_review:true,
  company:'Example Co', business_contact:'Jane Doe <jane@example.com>', role:'CTO',
  owner_decision:'Decide whether the workflow should retain write authority.',
  workflow:'Agent prepares an update for an external system.',
  critical_action:'Write one approved record.',
  target_object:'Exact staging record bound by immutable ID.', authority_owner:'CTO',
  expensive_error:'Wrong production object changed.', environment:'staging'
});

function request(body, options = {}) {
  const method = options.method || 'POST';
  const headers = {
    'Content-Type':options.contentType || 'application/json',
    ...(options.origin ? { Origin:options.origin } : {}),
    ...(options.headers || {})
  };
  return new Request('https://bitevo.work/api/scope-handoff', {
    method, headers,
    body:method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
  });
}

const json = async response => ({
  status:response.status,
  body:await response.json(),
  headers:response.headers
});
const limiter = (store, cfg, nowMs, options = {}) => createGlobalFixedWindowLimiter({
  store, config:cfg, now:() => nowMs, mutationIdFactory:mutationId, ...options
});
{
  const valid = config(7, 90);
  check(valid.configurationDigest === globalRateLimitConfigurationDigest(7, 90), 'config digest binds values');
  const invalidConfigs = [
    {},
    { SCOPE_HANDOFF_R1_RATE_LIMIT_MODE:'wrong', SCOPE_HANDOFF_R1_RATE_LIMIT_MAX_REQUESTS:'1', SCOPE_HANDOFF_R1_RATE_LIMIT_WINDOW_SECONDS:'1' },
    { SCOPE_HANDOFF_R1_RATE_LIMIT_MODE:GLOBAL_RATE_LIMIT_MODE, SCOPE_HANDOFF_R1_RATE_LIMIT_MAX_REQUESTS:'0', SCOPE_HANDOFF_R1_RATE_LIMIT_WINDOW_SECONDS:'1' },
    { SCOPE_HANDOFF_R1_RATE_LIMIT_MODE:GLOBAL_RATE_LIMIT_MODE, SCOPE_HANDOFF_R1_RATE_LIMIT_MAX_REQUESTS:'1.5', SCOPE_HANDOFF_R1_RATE_LIMIT_WINDOW_SECONDS:'1' },
    { SCOPE_HANDOFF_R1_RATE_LIMIT_MODE:GLOBAL_RATE_LIMIT_MODE, SCOPE_HANDOFF_R1_RATE_LIMIT_MAX_REQUESTS:'1', SCOPE_HANDOFF_R1_RATE_LIMIT_WINDOW_SECONDS:'-1' }
  ];
  for (const env of invalidConfigs) {
    check(parseGlobalRateLimitConfig(env).ok === false, 'invalid config fails closed');
  }
}
{
  const cfg = config();
  const value = stateFor(cfg, 100_000, 1);
  check(validateGlobalRateLimitState(value, cfg, { nowMs:100_000 }).ok, 'valid state accepted');
  const expectedFields = [
    'configuration_digest','count','mutation_id','schema','updated_at','window_end_ms','window_start_ms'
  ];
  check(Object.keys(value).sort().join(',') === expectedFields.join(','), 'limiter state has exact bounded fields');
  const serialized = JSON.stringify(value);
  const identityMarkers = ['client_submit', 'Example Co', 'jane' + '@example.com', 'company', 'request'];
  for (const marker of identityMarkers) check(!serialized.includes(marker), `limiter state excludes ${marker}`);
}
{
  const cfg = config();
  const rateStore = new MemoryCasStore();
  const intakeStore = new InMemoryScopeHandoffStore();
  const out = await json(await handleScopeHandoffRequest(request(entry()), {
    enabled:false, rateLimiter:limiter(rateStore, cfg, 100_000), store:intakeStore
  }));
  check(out.status === 503 && out.body.status === 'SERVICE_DISABLED', 'disabled service remains 503');
  check(rateStore.readCount === 0 && rateStore.createCount === 0 && rateStore.replaceCount === 0, 'disabled service skips limiter I/O');
  check(intakeStore.readCount === 0 && intakeStore.writeCount === 0, 'disabled service skips intake I/O');
}

{
  const intakeStore = new InMemoryScopeHandoffStore();
  const out = await json(await handleScopeHandoffRequest(request(entry()), {
    enabled:true, rateLimiter:null, store:intakeStore
  }));
  check(out.status === 503 && out.body.status === 'RATE_LIMIT_CONFIG_INVALID', 'missing limiter config fails closed');
  check(out.body.provider_io === 0 && out.body.testing_authorization === false, 'config failure receipt boundary');
  check(intakeStore.readCount === 0 && intakeStore.writeCount === 0, 'config failure skips intake I/O');
}
{
  const cfg = config();
  const rateStore = new MemoryCasStore();
  const intakeStore = new InMemoryScopeHandoffStore();
  const rateLimiter = limiter(rateStore, cfg, 100_000);
  const outputs = [
    await json(await handleScopeHandoffRequest(request(null, { method:'GET' }), { enabled:true, rateLimiter, store:intakeStore })),
    await json(await handleScopeHandoffRequest(request(entry(), { origin:'https://other.invalid' }), { enabled:true, rateLimiter, store:intakeStore })),
    await json(await handleScopeHandoffRequest(request(JSON.stringify(entry()), { contentType:'text/plain' }), { enabled:true, rateLimiter, store:intakeStore })),
    await json(await handleScopeHandoffRequest(request(entry(), { headers:{ 'Content-Length':String(MAX_BODY_BYTES + 1) } }), { enabled:true, rateLimiter, store:intakeStore }))
  ];
  check(outputs.map(x => x.status).join(',') === '405,403,415,413', 'cheap reject status order');
  check(rateStore.readCount === 0 && rateStore.createCount === 0 && rateStore.replaceCount === 0, 'cheap rejects skip limiter I/O');
  check(intakeStore.readCount === 0 && intakeStore.writeCount === 0, 'cheap rejects skip intake I/O');
}
{
  const cfg = config(2, 60);
  const nowMs = 100_000;
  const rateStore = new MemoryCasStore();
  const intakeStore = new InMemoryScopeHandoffStore();
  const rateLimiter = limiter(rateStore, cfg, nowMs);
  const first = await json(await handleScopeHandoffRequest(request(entry('client_submit_limit_0001')), {
    enabled:true, rateLimiter, store:intakeStore, idFactory:() => 'sh_r1_limit_1', now:() => '2026-09-05T00:00:00.000Z'
  }));
  const second = await json(await handleScopeHandoffRequest(request(entry('client_submit_limit_0002')), {
    enabled:true, rateLimiter, store:intakeStore, idFactory:() => 'sh_r1_limit_2', now:() => '2026-09-05T00:00:01.000Z'
  }));
  const readsBeforeDeny = intakeStore.readCount;
  const writesBeforeDeny = intakeStore.writeCount;
  const limiterWritesBeforeDeny = rateStore.createCount + rateStore.replaceCount;
  const third = await json(await handleScopeHandoffRequest(request(entry('client_submit_limit_0003')), {
    enabled:true, rateLimiter, store:intakeStore
  }));
  check(first.status === 201 && second.status === 201, 'under-limit requests admitted');
  check(rateStore.snapshot?.value?.count === 2, 'one authoritative bucket incremented');
  check(third.status === 429 && third.body.error === 'RATE_LIMITED', 'at-limit request denied');
  check(Object.keys(third.body).sort().join(',') === 'error,testing_authorization', '429 exposes no count or Blob identifier');
  check(third.headers.get('retry-after') === '20', 'Retry-After derives from authoritative window');
  check(rateStore.createCount + rateStore.replaceCount === limiterWritesBeforeDeny, 'at-limit decision performs no limiter write');
  check(intakeStore.readCount === readsBeforeDeny && intakeStore.writeCount === writesBeforeDeny, 'denied request skips intake I/O');
}
{
  const cfg = config(3, 60);
  const old = stateFor(cfg, 119_999, 3);
  const store = new MemoryCasStore({ value:old, etag:'etag-seed' });
  const first = await consumeGlobalFixedWindow({
    store, config:cfg, now:() => 120_001, mutationIdFactory:mutationId
  });
  const second = await consumeGlobalFixedWindow({
    store, config:cfg, now:() => 120_002, mutationIdFactory:mutationId
  });
  check(first.decision === 'ALLOW' && second.decision === 'ALLOW', 'rollover requests admitted');
  check(store.snapshot.value.window_start_ms === 120_000 && store.snapshot.value.count === 2, 'window resets once then increments');
  check(store.createCount === 0 && store.replaceCount === 2, 'rollover uses bounded CAS replacement');
}

{
  const cfg = config(1, 60);
  const store = new MemoryCasStore();
  const outcomes = await Promise.all([1, 2].map(() => consumeGlobalFixedWindow({
    store, config:cfg, now:() => 100_000, mutationIdFactory:mutationId
  })));
  check(outcomes.filter(x => x.decision === 'ALLOW').length === 1, 'first-create race admits one');
  check(outcomes.filter(x => x.decision === 'DENY').length === 1, 'first-create race denies one');
  check(store.snapshot.value.count === 1, 'first-create race cannot over-admit');
}
{
  const cfg = config(4, 60);
  const store = new MemoryCasStore();
  const outcomes = await Promise.all(Array.from({ length:8 }, () => consumeGlobalFixedWindow({
    store, config:cfg, now:() => 100_000, mutationIdFactory:mutationId
  })));
  check(outcomes.filter(x => x.decision === 'ALLOW').length === 4, 'concurrent boundary admits exact configured N');
  check(outcomes.filter(x => x.decision === 'DENY').length === 4, 'concurrent boundary denies remainder');
  check(outcomes.every(x => x.decision !== 'UNKNOWN'), 'concurrent boundary converges within retry budget');
  check(store.snapshot.value.count === 4, 'concurrent boundary authoritative count exact');
}

{
  const cfg = config(4, 60);
  const seed = stateFor(cfg, 100_000, 1);
  const store = new MemoryCasStore({ value:seed, etag:'etag-seed' });
  store.forcedReplaceConflicts = 2;
  const outcome = await consumeGlobalFixedWindow({
    store, config:cfg, now:() => 100_000, mutationIdFactory:mutationId
  });
  check(outcome.decision === 'ALLOW' && store.snapshot.value.count === 2, 'stale ETag conflicts reconcile');
  check(store.replaceCount === 3, 'stale ETag retry count bounded and observable');
}

{
  const cfg = config(4, 60);
  const seed = stateFor(cfg, 100_000, 1);
  const store = new MemoryCasStore({ value:seed, etag:'etag-seed' });
  store.forcedReplaceConflicts = GLOBAL_RATE_LIMIT_CAS_MAX_ATTEMPTS;
  const outcome = await consumeGlobalFixedWindow({
    store, config:cfg, now:() => 100_000, mutationIdFactory:mutationId
  });
  check(outcome.decision === 'UNKNOWN' && outcome.reason === 'CAS_RETRY_EXHAUSTED', 'retry budget exhaustion fails closed');
  check(store.snapshot.value.count === 1, 'retry exhaustion does not mutate state');
}

{
  const cfg = config(3, 60);
  const store = new MemoryCasStore();
  store.uncertainCreateAfterCommit = true;
  const outcome = await consumeGlobalFixedWindow({
    store, config:cfg, now:() => 100_000, mutationIdFactory:mutationId
  });
  check(outcome.decision === 'ALLOW' && store.snapshot.value.count === 1, 'lost create acknowledgement reconciles by mutation marker');
}

{
  const cfg = config(3, 60);
  const seed = stateFor(cfg, 100_000, 1);
  const store = new MemoryCasStore({ value:seed, etag:'etag-seed' });
  store.uncertainReplaceAfterCommit = true;
  const outcome = await consumeGlobalFixedWindow({
    store, config:cfg, now:() => 100_000, mutationIdFactory:mutationId
  });
  check(outcome.decision === 'ALLOW' && store.snapshot.value.count === 2, 'lost replace acknowledgement reconciles by mutation marker');
}
{
  const cfg = config();
  const createStore = new MemoryCasStore();
  createStore.failCreateBeforeCommit = true;
  const createOutcome = await consumeGlobalFixedWindow({
    store:createStore, config:cfg, now:() => 100_000, mutationIdFactory:mutationId
  });
  check(createOutcome.decision === 'UNKNOWN' && createStore.snapshot === null, 'uncertain uncommitted create fails closed');

  const readStore = new MemoryCasStore();
  readStore.failRead = true;
  const readOutcome = await consumeGlobalFixedWindow({
    store:readStore, config:cfg, now:() => 100_000, mutationIdFactory:mutationId
  });
  check(readOutcome.decision === 'UNKNOWN' && readOutcome.reason === 'READ_UNCERTAIN', 'read uncertainty fails closed');

  const replaceSeed = stateFor(cfg, 100_000, 1);
  const replaceStore = new MemoryCasStore({ value:replaceSeed, etag:'etag-seed' });
  replaceStore.failReplaceBeforeCommit = true;
  const replaceOutcome = await consumeGlobalFixedWindow({
    store:replaceStore, config:cfg, now:() => 100_000, mutationIdFactory:mutationId
  });
  check(replaceOutcome.decision === 'UNKNOWN' && replaceStore.snapshot.value.count === 1, 'uncertain uncommitted replace fails closed');
}
{
  const cfg = config(3, 60);
  const base = stateFor(cfg, 100_000, 1);
  const corruptStates = [
    { ...base, schema:'wrong.schema' },
    { ...base, count:-1 },
    { ...base, window_end_ms:base.window_start_ms },
    { ...base, configuration_digest:'0'.repeat(64) },
    { ...base, contact_marker:'must-not-exist' }
  ];
  for (const value of corruptStates) {
    const store = new MemoryCasStore({ value, etag:'etag-seed' });
    const outcome = await consumeGlobalFixedWindow({
      store, config:cfg, now:() => 100_000, mutationIdFactory:mutationId
    });
    check(outcome.decision === 'UNKNOWN', 'corrupt limiter state fails closed');
    check(store.createCount === 0 && store.replaceCount === 0, 'corrupt state is never rewritten blindly');
  }
  const invalidJsonStore = {
    read:async () => { throw new SyntaxError('invalid stored JSON'); },
    createIfAbsent:async () => ({ created:true }),
    replaceIfMatch:async () => ({ replaced:true })
  };
  const invalidJson = await consumeGlobalFixedWindow({
    store:invalidJsonStore, config:cfg, now:() => 100_000, mutationIdFactory:mutationId
  });
  check(invalidJson.decision === 'UNKNOWN', 'invalid JSON state fails closed');
}
{
  const cfg = config(3, 60);
  const rateStore = new MemoryCasStore();
  const intakeStore = new InMemoryScopeHandoffStore();
  const rateLimiter = limiter(rateStore, cfg, 100_000);
  const malformed = await json(await handleScopeHandoffRequest(request('{bad'), {
    enabled:true, rateLimiter, store:intakeStore
  }));
  const schemaInvalid = await json(await handleScopeHandoffRequest(request({ ...entry(), unexpected:'x' }), {
    enabled:true, rateLimiter, store:intakeStore
  }));
  const secretInvalid = await json(await handleScopeHandoffRequest(request({
    ...entry(), workflow:`Synthetic ${'sk-' + 'A'.repeat(30)}`
  }), { enabled:true, rateLimiter, store:intakeStore }));
  check(malformed.status === 400 && schemaInvalid.status === 422 && secretInvalid.status === 422, 'expensive invalid bodies reject after admission');
  check(rateStore.snapshot.value.count === 3, 'malformed, schema and secret bodies consume capacity');
  check(intakeStore.readCount === 0 && intakeStore.writeCount === 0, 'invalid bodies never reach intake storage');
  const denied = await json(await handleScopeHandoffRequest(request(entry('client_submit_after_invalid')), {
    enabled:true, rateLimiter, store:intakeStore
  }));
  check(denied.status === 429, 'consumed invalid-body capacity is enforced');
}

{
  const cfg = config(1, 60);
  const rateStore = new MemoryCasStore();
  const intakeStore = new InMemoryScopeHandoffStore();
  const out = await json(await handleScopeHandoffRequest(request('x'.repeat(MAX_BODY_BYTES + 1)), {
    enabled:true, rateLimiter:limiter(rateStore, cfg, 100_000), store:intakeStore
  }));
  check(out.status === 413, 'actual body ceiling still enforced');
  check(rateStore.snapshot?.value?.count === 1, 'actual oversized body consumes admission capacity');
  check(intakeStore.readCount === 0 && intakeStore.writeCount === 0, 'actual oversized body skips intake storage');
}

{
  const cfg = config();
  const store = new MemoryCasStore();
  const outcome = await consumeGlobalFixedWindow({
    store, config:cfg, now:() => 100_000, mutationIdFactory:() => 'invalid'
  });
  check(outcome.decision === 'UNKNOWN' && outcome.reason.startsWith('CANDIDATE_'), 'invalid mutation marker fails closed');
  check(store.createCount === 0 && store.replaceCount === 0, 'invalid candidate is never written');
}

{
  const blobStore = createVercelBlobGlobalRateLimitStore();
  check(typeof blobStore.read === 'function' && typeof blobStore.createIfAbsent === 'function' &&
    typeof blobStore.replaceIfMatch === 'function', 'Blob CAS adapter import smoke without I/O');
}

const rateSource = await readFile(new URL('../src/lib/scope-handoff-r1/rate-limit.js', import.meta.url), 'utf8');
const storeSource = await readFile(new URL('../src/lib/scope-handoff-r1/stores.js', import.meta.url), 'utf8');
const coreSource = await readFile(new URL('../src/lib/scope-handoff-r1/core.js', import.meta.url), 'utf8');
const apiSource = await readFile(new URL('../api/scope-handoff.ts', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const implementationDoc = await readFile(new URL('../docs/SCOPE_HANDOFF_R1_IMPLEMENTATION_R1_20260903.md', import.meta.url), 'utf8');

check(rateSource.includes(GLOBAL_RATE_LIMIT_PATHNAME) && rateSource.includes(GLOBAL_RATE_LIMIT_SCHEMA), 'single exact limiter object source');
check(rateSource.includes('useCache') === false, 'pure limiter stays provider-neutral');
check(storeSource.includes("useCache:false") && storeSource.includes('ifMatch:etag') && storeSource.includes('BlobPreconditionFailedError'), 'Blob adapter uses origin read and ETag CAS');
check(coreSource.indexOf("request.method !== 'POST'") < coreSource.indexOf('rateLimiter.consume()'), 'method check precedes limiter');
check(coreSource.indexOf('rateLimiter.consume()') < coreSource.indexOf('request.text()'), 'limiter precedes body read');
check(apiSource.includes('SCOPE_HANDOFF_R1_RATE_LIMIT_MODE') === false && apiSource.includes('parseGlobalRateLimitConfig'), 'API delegates strict config parsing');
check(!apiSource.includes('node:process') && apiSource.includes('createVercelBlobGlobalRateLimitStore'), 'API keeps optional runtime-global boundary');
check(pkg.dependencies?.['@vercel/blob'] === '2.8.0' && !pkg.dependencies?.['@vercel/firewall'], 'existing Blob dependency only');
check(pkg.scripts?.['verify:core']?.includes('verify-scope-handoff-r1-rate-limit.mjs'), 'focused limiter verifier wired into core gate');
check(implementationDoc.includes('P1G3') && implementationDoc.includes('blob_global_fixed_window_v1'), 'implementation record distinguishes P1G3 source');

{
  const intakeStore = new InMemoryScopeHandoffStore();
  const unknownLimiter = { consume:async () => ({ decision:'UNKNOWN', providerIo:3, reason:'TEST' }) };
  const out = await json(await handleScopeHandoffRequest(request(entry('client_submit_unknown_limit')), {
    enabled:true, rateLimiter:unknownLimiter, store:intakeStore
  }));
  check(out.status === 503 && out.body.status === 'RATE_LIMIT_UNKNOWN_RECONCILE', 'unknown limiter state fails closed');
  check(out.body.provider_io === 3 && out.body.testing_authorization === false, 'unknown response reports limiter I/O only');
  check(intakeStore.readCount === 0 && intakeStore.writeCount === 0, 'unknown limiter state skips intake I/O');
}
{
  const intakeStore = new InMemoryScopeHandoffStore();
  const throwingLimiter = { consume:async () => { throw new Error('unexpected limiter failure'); } };
  const out = await json(await handleScopeHandoffRequest(request(entry('client_submit_throwing_limit')), {
    enabled:true, rateLimiter:throwingLimiter, store:intakeStore
  }));
  check(out.status === 503 && out.body.status === 'RATE_LIMIT_UNKNOWN_RECONCILE', 'unexpected limiter exception fails closed');
  check(!Object.prototype.hasOwnProperty.call(out.body, 'provider_io'), 'unknown thrown I/O is not reported as zero');
  check(intakeStore.readCount === 0 && intakeStore.writeCount === 0, 'throwing limiter skips intake I/O');
}

{
  const intakeStore = new InMemoryScopeHandoffStore();
  const malformedLimiter = { consume:async () => ({ decision:'ALLOW', providerIo:-1 }) };
  const out = await json(await handleScopeHandoffRequest(request(entry('client_submit_malformed_limit')), {
    enabled:true, rateLimiter:malformedLimiter, store:intakeStore
  }));
  check(out.status === 503 && out.body.status === 'RATE_LIMIT_UNKNOWN_RECONCILE', 'malformed limiter result fails closed');
  check(!Object.prototype.hasOwnProperty.call(out.body, 'provider_io'), 'malformed I/O count is not emitted');
  check(intakeStore.readCount === 0 && intakeStore.writeCount === 0, 'malformed limiter skips intake I/O');
}

{
  const intakeStore = new InMemoryScopeHandoffStore();
  const malformedDeny = { consume:async () => ({ decision:'DENY', providerIo:1, retryAfterSeconds:0 }) };
  const out = await json(await handleScopeHandoffRequest(request(entry('client_submit_bad_retry')), {
    enabled:true, rateLimiter:malformedDeny, store:intakeStore
  }));
  check(out.status === 503 && out.body.status === 'RATE_LIMIT_UNKNOWN_RECONCILE', 'malformed deny contract fails closed');
  check(out.body.provider_io === 1 && !out.headers.has('retry-after'), 'malformed deny never invents Retry-After');
  check(intakeStore.readCount === 0 && intakeStore.writeCount === 0, 'malformed deny skips intake I/O');
}

console.log(
  `SCOPE_HANDOFF_R1_RATE_LIMIT_GATE=PASS checks=${checks} ` +
  `cas_attempts=${GLOBAL_RATE_LIMIT_CAS_MAX_ATTEMPTS} provider_writes=0 ` +
  'production_thresholds=UNSET limiter_identity_fields=0'
);
