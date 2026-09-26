import {
  deletionDecision,
  reviewQueuePath,
  scopeRecordPath,
  validateClientSubmissionId
} from './review.js';

export const SCOPE_HANDOFF_R1_RECORD_PREFIX = 'scope-handoff/r1/';
export const SCOPE_HANDOFF_R1_REVIEW_PREFIX = 'scope-handoff/r1-review/pending/';

function validNow(nowIso) {
  return typeof nowIso === 'string' && Number.isFinite(Date.parse(nowIso));
}

function candidateClientId(value) {
  const clientId = value?.client_submission_id;
  return validateClientSubmissionId(clientId) ? clientId : null;
}

export async function purgeExpiredScopeHandoffRecords(store, options = {}) {
  if (!store || typeof store.listPage !== 'function' || typeof store.deleteMany !== 'function') {
    throw new Error('RETENTION_STORE_INVALID');
  }
  const nowIso = options.nowIso || new Date().toISOString();
  if (!validNow(nowIso)) throw new Error('RETENTION_NOW_INVALID');

  const expiredClientIds = new Set();
  let scannedRecords = 0;
  let scannedQueue = 0;
  let malformed = 0;
  let providerIo = 0;
  let pages = 0;

  for (const [prefix, kind] of [
    [SCOPE_HANDOFF_R1_RECORD_PREFIX, 'record'],
    [SCOPE_HANDOFF_R1_REVIEW_PREFIX, 'queue']
  ]) {
    let cursor = null;
    const seenCursors = new Set();
    do {
      if (cursor && seenCursors.has(cursor)) throw new Error('RETENTION_CURSOR_LOOP');
      if (cursor) seenCursors.add(cursor);
      const page = await store.listPage(prefix, { cursor, limit:250 });
      if (!page || !Array.isArray(page.items)) throw new Error('RETENTION_PAGE_INVALID');
      pages += 1;
      providerIo += Number.isSafeInteger(page.providerIo) && page.providerIo >= 0 ? page.providerIo : 0;
      for (const item of page.items) {
        if (kind === 'record') scannedRecords += 1;
        else scannedQueue += 1;
        const value = item?.value;
        const clientId = candidateClientId(value);
        const decision = deletionDecision(value, 'retention_expired', nowIso);
        if (!clientId || decision.reason === 'RETENTION_UNKNOWN' || decision.reason === 'NOT_FOUND') {
          malformed += 1;
          continue;
        }
        if (decision.allowed) expiredClientIds.add(clientId);
      }
      cursor = typeof page.cursor === 'string' && page.cursor.length ? page.cursor : null;
    } while (cursor);
  }

  let deletedPairs = 0;
  for (const clientId of expiredClientIds) {
    const result = await store.deleteMany([
      scopeRecordPath(clientId),
      reviewQueuePath(clientId)
    ]);
    providerIo += Number.isSafeInteger(result?.providerIo) && result.providerIo >= 0 ? result.providerIo : 0;
    deletedPairs += 1;
  }

  return Object.freeze({
    status:'RETENTION_PURGE_COMPLETE',
    now:nowIso,
    scanned_records:scannedRecords,
    scanned_queue:scannedQueue,
    expired_candidates:expiredClientIds.size,
    deleted_pairs:deletedPairs,
    malformed,
    pages,
    provider_io:providerIo,
    testing_authorization:false
  });
}
