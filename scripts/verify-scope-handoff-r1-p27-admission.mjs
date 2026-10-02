import assert from 'node:assert/strict';
import {
  IP_RATE_LIMIT_DAY_MAX,
  IP_RATE_LIMIT_DAY_SECONDS,
  IP_RATE_LIMIT_MINUTE_MAX,
  IP_RATE_LIMIT_MINUTE_SECONDS,
  IP_RATE_LIMIT_PREFIX,
  createCompositeScopeHandoffLimiter,
  createPerIpDualWindowLimiter,
  deriveClientBucketKey
} from '../src/lib/scope-handoff-r1/admission.js';
import { handleScopeHandoffRequest } from '../src/lib/scope-handoff-r1/core.js';
import {
  buildScopeHandoffNotification,
  createTelegramScopeHandoffNotifier,
  parseScopeHandoffTelegramConfig
} from '../src/lib/scope-handoff-r1/notify.js';
import { SCOPE_HANDOFF_R1_RETENTION_DAYS, SCOPE_HANDOFF_R1_STORAGE_OWNER } from '../src/lib/scope-handoff-r1/policy.js';
import { InMemoryScopeHandoffStore } from '../src/lib/scope-handoff-r1/stores.js';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks += 1; };
const clone = value => value === null ? null : structuredClone(value);
let mutationSequence = 0;
const mutationId = () => `rl_${(++mutationSequence).toString(16).padStart(32, '0')}`;

class MapCasStore {
  constructor() { this.rows = new Map(); this.version = 0; }
  async read(pathname) { return clone(this.rows.get(pathname) || null); }
  async createIfAbsent(pathname, value) {
    if (this.rows.has(pathname)) return { created:false };
    this.version += 1;
    this.rows.set(pathname, { value:clone(value), etag:`etag-${this.version}` });
    return { created:true };
  }
  async replaceIfMatch(pathname, value, etag) {
    const current = this.rows.get(pathname);
    if (!current || current.etag !== etag) return { replaced:false };
    this.version += 1;
    this.rows.set(pathname, { value:clone(value), etag:`etag-${this.version}` });
    return { replaced:true };
  }
}

const keySecret = 'k'.repeat(48);
const ipA = '203.0.113.10';
const ipB = '203.0.113.11';
const keyA = deriveClientBucketKey(ipA, keySecret);
const keyA2 = deriveClientBucketKey(ipA, keySecret);
const keyB = deriveClientBucketKey(ipB, keySecret);
check(typeof keyA === 'string' && /^[a-f0-9]{64}$/.test(keyA), 'IP bucket is a SHA-256 HMAC digest');
equal(keyA, keyA2, 'same IP and secret produce the same bucket');
check(keyA !== keyB, 'different IPs produce different buckets');
check(!keyA.includes(ipA) && deriveClientBucketKey(ipA, 'short') === null, 'raw IP is not present and short secret fails closed');
equal(IP_RATE_LIMIT_MINUTE_MAX, 5, 'minute ceiling exact');
equal(IP_RATE_LIMIT_MINUTE_SECONDS, 60, 'minute window exact');
equal(IP_RATE_LIMIT_DAY_MAX, 200, 'day ceiling exact');
equal(IP_RATE_LIMIT_DAY_SECONDS, 86_400, 'day window exact');

{
  const store = new MapCasStore();
  const limiter = createPerIpDualWindowLimiter({ store, ip:ipA, keySecret, now:() => 100_000, mutationIdFactory:mutationId });
  const decisions = [];
  for (let i = 0; i < 6; i += 1) decisions.push(await limiter.consume());
  equal(decisions.filter(x => x.decision === 'ALLOW').length, 5, 'same IP admits exactly five requests per minute');
  equal(decisions[5].decision, 'DENY', 'sixth same-IP request is denied');
  check(Number.isSafeInteger(decisions[5].retryAfterSeconds) && decisions[5].retryAfterSeconds > 0, 'minute deny exposes bounded Retry-After');
  const other = createPerIpDualWindowLimiter({ store, ip:ipB, keySecret, now:() => 100_000, mutationIdFactory:mutationId });
  equal((await other.consume()).decision, 'ALLOW', 'different IP has independent capacity');
  const serialized = JSON.stringify([...store.rows.entries()]);
  check(!serialized.includes(ipA) && !serialized.includes(ipB), 'raw IP never enters limiter paths or state');
  check([...store.rows.keys()].every(path => path.startsWith(IP_RATE_LIMIT_PREFIX)), 'IP limiter uses the dedicated private prefix');
}

{
  const store = new MapCasStore();
  let nowMs = 1_000_000;
  const limiter = createPerIpDualWindowLimiter({ store, ip:ipA, keySecret, now:() => nowMs, mutationIdFactory:mutationId });
  for (let i = 0; i < 200; i += 1) {
    const out = await limiter.consume();
    equal(out.decision, 'ALLOW', `daily request ${i + 1} admitted`);
    nowMs += 61_000;
  }
  const denied = await limiter.consume();
  equal(denied.decision, 'DENY', '201st request inside the day is denied');
}

{
  const store = new MapCasStore();
  const ipLimiter = createPerIpDualWindowLimiter({ store, ip:ipA, keySecret, now:() => 100_000, mutationIdFactory:mutationId });
  const globalLimiter = { consume:async () => ({ decision:'ALLOW', providerIo:7 }) };
  const composite = createCompositeScopeHandoffLimiter(ipLimiter, globalLimiter);
  const out = await composite.consume();
  equal(out.decision, 'ALLOW', 'composite admission requires IP and global approval');
  check(out.providerIo >= 7, 'composite provider I/O is additive');
  equal(createCompositeScopeHandoffLimiter(null, globalLimiter), null, 'missing IP limiter fails closed');
}

const notificationEnv = {
  SCOPE_HANDOFF_R1_NOTIFICATION_ENABLED:'true',
  SCOPE_HANDOFF_R1_TELEGRAM_BOT_TOKEN:`123456:${'A'.repeat(32)}`,
  SCOPE_HANDOFF_R1_TELEGRAM_CHAT_ID:'123456789'
};
const parsedNotification = parseScopeHandoffTelegramConfig(notificationEnv);
check(parsedNotification.ok, 'exact Telegram notification config accepted');
check(!parseScopeHandoffTelegramConfig({ ...notificationEnv, SCOPE_HANDOFF_R1_NOTIFICATION_ENABLED:'TRUE' }).ok, 'notification switch is exact');
check(!parseScopeHandoffTelegramConfig({ ...notificationEnv, SCOPE_HANDOFF_R1_TELEGRAM_BOT_TOKEN:'bad' }).ok, 'malformed bot token rejected');

const record = {
  submission_id:'sh_r1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', accepted_at:'2026-10-02T06:00:00.000Z',
  locale:'en', intake_depth:'entry', request:{ company:'Secret Customer', business_contact:'person@example.com' }
};
const message = buildScopeHandoffNotification(record);
check(message.includes(record.submission_id) && message.includes(record.accepted_at) && message.endsWith('entry_audit · en'), 'notification contains only required operational metadata');
check(!message.includes('Secret Customer') && !message.includes('person@example.com'), 'notification excludes request PII');

{
  const scheduled = [];
  const calls = [];
  const notifier = createTelegramScopeHandoffNotifier({
    config:parsedNotification.config,
    schedule:promise => scheduled.push(promise),
    fetchImpl:async (url, options) => { calls.push({ url, options }); return { ok:true }; }
  });
  equal(notifier.notify(record).scheduled, true, 'notification schedules asynchronously');
  equal(scheduled.length, 1, 'exactly one background task scheduled');
  await scheduled[0];
  equal(calls.length, 1, 'exactly one Telegram request emitted');
  const body = JSON.parse(calls[0].options.body);
  equal(body.chat_id, parsedNotification.config.chatId, 'Telegram chat ID is provider config only');
  equal(body.text, message, 'Telegram body is the bounded metadata message');
  check(!JSON.stringify(body).includes('Secret Customer') && !JSON.stringify(body).includes('person@example.com'), 'Telegram payload contains no request PII');
}

const entry = id => ({
  schema_version:'bitevo.scope-handoff.r1', client_submission_id:id, submission_intent:'scope_review_only',
  testing_authorization:false, locale:'en', intake_depth:'entry', secret_confirmation:true, consent_scope_review:true,
  company:'Example Co', business_contact:'person@example.com', role:'CTO', owner_decision:'Review write authority.',
  workflow:'Agent prepares a bounded update.', critical_action:'Write one approved staging record.',
  target_object:'Exact staging record ID.', authority_owner:'CTO', expensive_error:'Wrong object changed.', environment:'staging'
});
const req = body => new Request('https://bitevo.work/api/scope-handoff', {
  method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body)
});
const allowLimiter = Object.freeze({ consume:async () => ({ decision:'ALLOW', providerIo:0 }) });
{
  const store = new InMemoryScopeHandoffStore();
  const queue = new InMemoryScopeHandoffStore();
  let notifyCount = 0;
  const notifier = { notify(){ notifyCount += 1; return { scheduled:true }; } };
  const payload = entry('client_submit_notify_0001');
  const first = await handleScopeHandoffRequest(req(payload), {
    enabled:true, store, reviewQueue:queue, rateLimiter:allowLimiter, notifier,
    storageOwner:SCOPE_HANDOFF_R1_STORAGE_OWNER, retentionDays:SCOPE_HANDOFF_R1_RETENTION_DAYS,
    idFactory:() => 'sh_r1_notify_aaaaaaaaaaaaaaaaaaaa', now:() => '2026-10-02T06:00:00.000Z'
  });
  equal(first.status, 201, 'durable production-style intake accepted');
  equal(notifyCount, 1, 'new durable request notifies exactly once');
  const replay = await handleScopeHandoffRequest(req(payload), {
    enabled:true, store, reviewQueue:queue, rateLimiter:allowLimiter, notifier,
    storageOwner:SCOPE_HANDOFF_R1_STORAGE_OWNER, retentionDays:SCOPE_HANDOFF_R1_RETENTION_DAYS
  });
  equal(replay.status, 200, 'idempotent replay accepted');
  equal(notifyCount, 1, 'replay does not send a second notification');
}
{
  const store = new InMemoryScopeHandoffStore();
  const queue = new InMemoryScopeHandoffStore();
  const first = await handleScopeHandoffRequest(req(entry('client_submit_notify_fail_01')), {
    enabled:true, store, reviewQueue:queue, rateLimiter:allowLimiter,
    notifier:{ notify(){ throw new Error('synthetic notifier failure'); } },
    storageOwner:SCOPE_HANDOFF_R1_STORAGE_OWNER, retentionDays:SCOPE_HANDOFF_R1_RETENTION_DAYS
  });
  equal(first.status, 201, 'notification failure never rolls back durable intake');
}

console.log(`SCOPE_HANDOFF_R1_P27_ADMISSION_GATE=PASS checks=${checks} per_ip=5_per_minute+200_per_day raw_ip_storage=0 telegram_pii=0 provider_writes=0`);
