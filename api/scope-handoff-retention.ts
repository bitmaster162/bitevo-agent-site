import {
  SCOPE_HANDOFF_R1_PRODUCTION_PROJECT_ID,
  readScopeHandoffRuntimeEnvironment
} from '../src/lib/scope-handoff-r1/activation.js';
import {
  SCOPE_HANDOFF_R1_RETENTION_DAYS,
  SCOPE_HANDOFF_R1_STORAGE_OWNER,
  evaluateScopeHandoffRetentionPolicyEnvironment
} from '../src/lib/scope-handoff-r1/policy.js';
import { bearerToken, operatorTokenMatches } from '../src/lib/scope-handoff-r1/review.js';
import { purgeExpiredScopeHandoffRecords } from '../src/lib/scope-handoff-r1/retention.js';
import { createVercelBlobScopeHandoffRetentionStore } from '../src/lib/scope-handoff-r1/stores.js';

type RuntimeGlobal = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

function response(body: unknown, status: number, extraHeaders: Record<string,string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store',
      'X-Robots-Tag':'noindex',
      'X-Content-Type-Options':'nosniff',
      ...extraHeaders
    }
  });
}

function productionBoundary(env: Record<string,string|undefined> | undefined) {
  return env?.VERCEL === '1' &&
    env?.VERCEL_PROJECT_ID === SCOPE_HANDOFF_R1_PRODUCTION_PROJECT_ID &&
    env?.VERCEL_ENV === 'production' &&
    env?.VERCEL_TARGET_ENV === 'production';
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') return response({ error:'METHOD_NOT_ALLOWED', provider_io:0 }, 405, { Allow:'GET' });

    const runtimeGlobal = globalThis as RuntimeGlobal;
    const env = readScopeHandoffRuntimeEnvironment(runtimeGlobal);
    const expectedSecret = env?.CRON_SECRET || '';
    if (!operatorTokenMatches(bearerToken(request), expectedSecret)) {
      return response({ error:'CRON_AUTH_REQUIRED', provider_io:0, testing_authorization:false }, 401, {
        'WWW-Authenticate':'Bearer realm="scope-handoff-retention"'
      });
    }

    const policy = evaluateScopeHandoffRetentionPolicyEnvironment(env);
    if (!productionBoundary(env) || !policy.ready) {
      return response({
        status:'RETENTION_PURGE_DISABLED',
        provider_io:0,
        testing_authorization:false
      }, 503);
    }

    try {
      const result = await purgeExpiredScopeHandoffRecords(createVercelBlobScopeHandoffRetentionStore());
      return response({
        ...result,
        retention_days:SCOPE_HANDOFF_R1_RETENTION_DAYS,
        storage_owner:SCOPE_HANDOFF_R1_STORAGE_OWNER
      }, 200);
    } catch {
      return response({
        status:'RETENTION_PURGE_UNKNOWN_RECONCILE',
        testing_authorization:false
      }, 503);
    }
  }
};
