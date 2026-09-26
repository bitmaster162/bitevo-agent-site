import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SCOPE_HANDOFF_R1_RETENTION_DAYS,
  SCOPE_HANDOFF_R1_RETENTION_CRON_PATH,
  SCOPE_HANDOFF_R1_RETENTION_CRON_SCHEDULE,
  SCOPE_HANDOFF_R1_STORAGE_OWNER,
  SCOPE_HANDOFF_R1_STORAGE_OWNER_EMAIL,
  evaluateScopeHandoffRetentionPolicyEnvironment
} from '../src/lib/scope-handoff-r1/policy.js';
import {
  SCOPE_HANDOFF_R1_RECORD_PREFIX,
  SCOPE_HANDOFF_R1_REVIEW_PREFIX,
  purgeExpiredScopeHandoffRecords
} from '../src/lib/scope-handoff-r1/retention.js';
import { reviewQueuePath, scopeRecordPath } from '../src/lib/scope-handoff-r1/review.js';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks += 1; };

equal(SCOPE_HANDOFF_R1_RETENTION_DAYS, 30, 'retention policy is exactly 30 days');
equal(SCOPE_HANDOFF_R1_STORAGE_OWNER, 'Robert Dumanyan, Founder, BitEvo', 'accountable storage owner is exact');
equal(SCOPE_HANDOFF_R1_STORAGE_OWNER_EMAIL, 'robert@bitevo.work', 'privacy/deletion contact is exact');
equal(SCOPE_HANDOFF_R1_RETENTION_CRON_PATH, '/api/scope-handoff-retention', 'cron path is exact');
equal(SCOPE_HANDOFF_R1_RETENTION_CRON_SCHEDULE, '0 3 * * *', 'daily cron schedule is exact');

const exactEnv = {
  SCOPE_HANDOFF_R1_STORAGE_OWNER:SCOPE_HANDOFF_R1_STORAGE_OWNER,
  SCOPE_HANDOFF_R1_RETENTION_DAYS:String(SCOPE_HANDOFF_R1_RETENTION_DAYS),
  CRON_SECRET:'z'.repeat(48)
};
equal(evaluateScopeHandoffRetentionPolicyEnvironment(exactEnv).ready, true, 'exact owner/retention/secret make retention policy environment ready');
equal(evaluateScopeHandoffRetentionPolicyEnvironment({ ...exactEnv, SCOPE_HANDOFF_R1_STORAGE_OWNER:'Other Owner' }).ready, false, 'wrong owner fails closed');
equal(evaluateScopeHandoffRetentionPolicyEnvironment({ ...exactEnv, SCOPE_HANDOFF_R1_RETENTION_DAYS:'29' }).ready, false, 'wrong retention fails closed');
equal(evaluateScopeHandoffRetentionPolicyEnvironment({ ...exactEnv, CRON_SECRET:'short' }).ready, false, 'short cron secret fails closed');

class FakeStore {
  constructor(rows) {
    this.rows = new Map(rows);
    this.deleted = [];
  }
  async listPage(prefix, { cursor = null, limit = 250 } = {}) {
    const all = [...this.rows.entries()].filter(([pathname]) => pathname.startsWith(prefix));
    const start = cursor ? Number(cursor) : 0;
    const slice = all.slice(start, start + limit);
    const next = start + slice.length < all.length ? String(start + slice.length) : null;
    return {
      items:slice.map(([pathname,value]) => ({ pathname, value:structuredClone(value) })),
      cursor:next,
      providerIo:1 + slice.length
    };
  }
  async deleteMany(pathnames) {
    this.deleted.push([...pathnames]);
    for (const pathname of pathnames) this.rows.delete(pathname);
    return { deleted:true, providerIo:1 };
  }
}

const expiredA = 'client_retention_expired_a';
const futureB = 'client_retention_future_b';
const malformedC = 'client_retention_malformed_c';
const orphanD = 'client_retention_orphan_d';
const exactE = 'client_retention_exact_e';
const fake = new FakeStore([
  [scopeRecordPath(expiredA), { client_submission_id:expiredA, retention_until:'2026-09-25T00:00:00.000Z' }],
  [scopeRecordPath(futureB), { client_submission_id:futureB, retention_until:'2026-10-01T00:00:00.000Z' }],
  [scopeRecordPath(malformedC), { client_submission_id:malformedC, retention_until:null }],
  [scopeRecordPath(exactE), { client_submission_id:exactE, retention_until:'2026-09-26T00:00:00.000Z' }],
  [reviewQueuePath(expiredA), { client_submission_id:expiredA, retention_until:'2026-09-25T00:00:00.000Z' }],
  [reviewQueuePath(futureB), { client_submission_id:futureB, retention_until:'2026-10-01T00:00:00.000Z' }],
  [reviewQueuePath(orphanD), { client_submission_id:orphanD, retention_until:'2026-09-24T00:00:00.000Z' }]
]);
const purge = await purgeExpiredScopeHandoffRecords(fake, { nowIso:'2026-09-26T00:00:00.000Z' });
equal(purge.status, 'RETENTION_PURGE_COMPLETE', 'purge returns explicit success status');
equal(purge.expired_candidates, 3, 'expired record, exact-boundary record and orphan queue are selected once');
equal(purge.deleted_pairs, 3, 'expired candidates delete record+queue pairs');
equal(purge.testing_authorization, false, 'purge never grants testing authorization');
check(!fake.rows.has(scopeRecordPath(expiredA)) && !fake.rows.has(reviewQueuePath(expiredA)), 'expired pair is deleted');
check(!fake.rows.has(scopeRecordPath(exactE)) && !fake.rows.has(reviewQueuePath(exactE)), 'record expiring exactly at now is deleted');
check(!fake.rows.has(scopeRecordPath(orphanD)) && !fake.rows.has(reviewQueuePath(orphanD)), 'orphan expired queue candidate removes both paths');
check(fake.rows.has(scopeRecordPath(futureB)) && fake.rows.has(reviewQueuePath(futureB)), 'future-retention pair is preserved');
check(fake.rows.has(scopeRecordPath(malformedC)), 'unknown/malformed retention is never deleted');
check(purge.provider_io > 0, 'successful purge reports provider I/O count');
equal(SCOPE_HANDOFF_R1_RECORD_PREFIX, 'scope-handoff/r1/', 'record prefix exact');
equal(SCOPE_HANDOFF_R1_REVIEW_PREFIX, 'scope-handoff/r1-review/pending/', 'review prefix exact');

await assert.rejects(() => purgeExpiredScopeHandoffRecords({}, { nowIso:'2026-09-26T00:00:00.000Z' }), /RETENTION_STORE_INVALID/); checks += 1;
await assert.rejects(() => purgeExpiredScopeHandoffRecords(fake, { nowIso:'not-a-date' }), /RETENTION_NOW_INVALID/); checks += 1;

const api = await readFile(new URL('../api/scope-handoff-retention.ts', import.meta.url), 'utf8');
const stores = await readFile(new URL('../src/lib/scope-handoff-r1/stores.js', import.meta.url), 'utf8');
const client = await readFile(new URL('../public/scope-handoff-r1.js', import.meta.url), 'utf8');
const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const doc = await readFile(new URL('../docs/SCOPE_HANDOFF_R1_PRODUCTION_READINESS_P24_20260926.md', import.meta.url), 'utf8');

check(api.includes('CRON_AUTH_REQUIRED') && api.includes('operatorTokenMatches(bearerToken(request), expectedSecret)'), 'cron route requires exact bearer secret before provider I/O');
check(api.includes("env?.VERCEL_ENV === 'production'") && api.includes("env?.VERCEL_TARGET_ENV === 'production'"), 'cron route binds exact production environment');
check(api.includes('RETENTION_PURGE_DISABLED') && api.includes('provider_io:0'), 'unready purge path fails closed with zero provider I/O claim');
check(api.includes('purgeExpiredScopeHandoffRecords(createVercelBlobScopeHandoffRetentionStore())'), 'cron route uses bounded retention store');
check(stores.includes('createVercelBlobScopeHandoffRetentionStore') && stores.includes('list({ prefix, limit, cursor })') && stores.includes('del(pathnames)'), 'retention store supports paginated reads and bounded deletion');
check(client.includes('up to 30 days') && client.includes('Robert Dumanyan, Founder, BitEvo') && client.includes('robert@bitevo.work'), 'EN handoff disclosure includes retention, owner and deletion contact');
check(client.includes('до 30 дней') && client.includes('Ответственный за данные: Robert Dumanyan'), 'RU handoff disclosure includes retention and owner');
check(client.includes('data-scope-retention'), 'rendered handoff shell exposes dedicated retention disclosure');
check(Array.isArray(vercel.crons) && vercel.crons.length === 1, 'exactly one bounded Vercel cron is configured');
check(vercel.crons?.[0]?.path === SCOPE_HANDOFF_R1_RETENTION_CRON_PATH && vercel.crons?.[0]?.schedule === SCOPE_HANDOFF_R1_RETENTION_CRON_SCHEDULE, 'Vercel cron matches decided path/schedule');
check(pkg.scripts?.['verify:core']?.includes('verify-scope-handoff-r1-retention.mjs'), 'retention safety gate is wired into verify:core');
for (const marker of [
  'RETENTION_DAYS = 30',
  'STORAGE_OWNER = Robert Dumanyan, Founder, BitEvo',
  'PRIVACY_CONTACT = robert@bitevo.work',
  'AUTO_PURGE_SOURCE = PRESENT',
  'PRODUCTION_ENABLE = NOT_AUTHORIZED'
]) check(doc.includes(marker), `retention policy doc marker missing: ${marker}`);

console.log(`SCOPE_HANDOFF_R1_RETENTION_GATE=PASS checks=${checks} retention_days=${SCOPE_HANDOFF_R1_RETENTION_DAYS} owner=ROBERT_DUMANYAN daily_purge=SOURCE_PRESENT cron_auth=REQUIRED automatic_delete=EXPIRED_ONLY privacy_delete=IMMEDIATE_PATH_PRESENT runtime_activation=UNCHANGED`);
