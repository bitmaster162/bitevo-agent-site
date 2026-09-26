import {
  evaluateScopeHandoffActivation,
  readScopeHandoffRuntimeEnvironment
} from '../src/lib/scope-handoff-r1/activation.js';
import {
  bearerToken,
  deletionDecision,
  operatorTokenMatches,
  reviewQueuePath,
  scopeRecordPath,
  validateClientSubmissionId
} from '../src/lib/scope-handoff-r1/review.js';
import {
  createVercelBlobScopeHandoffReviewQueue,
  createVercelBlobScopeHandoffStore
} from '../src/lib/scope-handoff-r1/stores.js';

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

function authorized(request: Request, env: Record<string,string|undefined> | undefined) {
  return operatorTokenMatches(
    bearerToken(request),
    env?.SCOPE_HANDOFF_R1_OPERATOR_REVIEW_TOKEN || ''
  );
}

export default {
  async fetch(request: Request) {
    const runtimeGlobal = globalThis as RuntimeGlobal;
    const env = readScopeHandoffRuntimeEnvironment(runtimeGlobal);
    const activation = evaluateScopeHandoffActivation(env);
    if (!activation.operatorReviewEnabled) {
      return response({ status:'SERVICE_DISABLED', provider_io:0, testing_authorization:false }, 503);
    }
    if (!authorized(request, env)) {
      return response({ error:'OPERATOR_AUTH_REQUIRED', provider_io:0 }, 401, {
        'WWW-Authenticate':'Bearer realm="scope-handoff-review"'
      });
    }

    const url = new URL(request.url);
    const clientId = url.searchParams.get('client_submission_id');
    const queue = createVercelBlobScopeHandoffReviewQueue();
    const store = createVercelBlobScopeHandoffStore();

    if (request.method === 'GET' && clientId) {
      if (!validateClientSubmissionId(clientId)) return response({ error:'INVALID_CLIENT_SUBMISSION_ID' }, 400);
      let record;
      try { record = await store.read(scopeRecordPath(clientId)); }
      catch { return response({ status:'OPERATOR_READ_UNCERTAIN' }, 503); }
      if (!record) return response({ error:'NOT_FOUND' }, 404);
      return response({
        status:'OPERATOR_RECORD_READ',
        human_review_status:record.human_review_status,
        retention_until:record.retention_until ?? null,
        record
      }, 200);
    }

    if (request.method === 'GET') {
      let rows;
      try { rows = await queue.listPrefix('scope-handoff/r1-review/pending/', 50); }
      catch { return response({ status:'OPERATOR_QUEUE_READ_UNCERTAIN' }, 503); }
      return response({
        status:'OPERATOR_QUEUE_READ',
        human_review_status:'NOT_CONFIRMED',
        count:rows.length,
        pending:rows.map(item => item.value)
      }, 200);
    }

    if (request.method === 'DELETE') {
      if (!validateClientSubmissionId(clientId)) return response({ error:'INVALID_CLIENT_SUBMISSION_ID' }, 400);
      const reason = request.headers.get('x-scope-handoff-delete-reason') || '';
      let record;
      try { record = await store.read(scopeRecordPath(clientId)); }
      catch { return response({ status:'OPERATOR_READ_UNCERTAIN' }, 503); }
      const decision = deletionDecision(record, reason);
      if (decision.reason === 'NOT_FOUND') return response({ error:'NOT_FOUND' }, 404);
      if (decision.reason === 'DELETE_REASON_REQUIRED') return response({ error:'DELETE_REASON_REQUIRED' }, 422);
      if (decision.reason === 'RETENTION_NOT_EXPIRED') return response({ error:'RETENTION_NOT_EXPIRED' }, 409);
      if (!decision.allowed) return response({ status:'DELETE_POLICY_UNKNOWN', reason:decision.reason }, 503);
      try {
        await queue.deleteMany([
          scopeRecordPath(clientId),
          reviewQueuePath(clientId)
        ]);
      } catch {
        return response({ status:'DELETE_UNKNOWN_RECONCILE' }, 503);
      }
      return response({
        status:'DELETED',
        client_submission_id:clientId,
        reason,
        testing_authorization:false
      }, 200);
    }

    return response({ error:'METHOD_NOT_ALLOWED' }, 405, { Allow:'GET, DELETE' });
  }
};
