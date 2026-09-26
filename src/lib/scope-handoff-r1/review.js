import { createHash, timingSafeEqual } from 'node:crypto';

export const STORAGE_STATUS = 'STORED_PRIVATE';
export const OPERATOR_DELIVERY_STATUS = 'QUEUED_FOR_HUMAN_REVIEW';
export const REVIEW_QUEUE_STATUS = 'PENDING_HUMAN_REVIEW';
export const REVIEW_QUEUE_SCHEMA = 'bitevo.scope-handoff-review.r1';

export function scopeRecordPath(clientSubmissionId) {
  return `scope-handoff/r1/${clientSubmissionId}.json`;
}

export function reviewQueuePath(clientSubmissionId) {
  return `scope-handoff/r1-review/pending/${clientSubmissionId}.json`;
}

export function retentionUntil(acceptedAt, retentionDays) {
  if (!Number.isSafeInteger(retentionDays) || retentionDays < 1) return null;
  const acceptedMs = Date.parse(acceptedAt);
  if (!Number.isFinite(acceptedMs)) return null;
  return new Date(acceptedMs + retentionDays * 86_400_000).toISOString();
}

export function createReviewQueueEntry(record) {
  return Object.freeze({
    schema_version:REVIEW_QUEUE_SCHEMA,
    status:REVIEW_QUEUE_STATUS,
    submission_id:record.submission_id,
    client_submission_id:record.client_submission_id,
    request_digest:record.request_digest,
    record_path:scopeRecordPath(record.client_submission_id),
    accepted_at:record.accepted_at,
    retention_until:record.retention_until,
    locale:record.locale,
    intake_depth:record.intake_depth
  });
}

export async function ensureReviewQueued(queue, record) {
  if (!queue || typeof queue.read !== 'function' || typeof queue.createIfAbsent !== 'function') {
    return Object.freeze({ ok:false, reason:'REVIEW_QUEUE_UNAVAILABLE' });
  }
  const pathname = reviewQueuePath(record.client_submission_id);
  let existing;
  try { existing = await queue.read(pathname); }
  catch { return Object.freeze({ ok:false, reason:'REVIEW_QUEUE_READ_UNCERTAIN' }); }
  if (existing) {
    const same = existing.request_digest === record.request_digest &&
      existing.submission_id === record.submission_id;
    return Object.freeze({ ok:same, replayed:true, reason:same ? null : 'REVIEW_QUEUE_CONFLICT' });
  }

  const entry = createReviewQueueEntry(record);
  let created;
  try { created = await queue.createIfAbsent(pathname, entry); }
  catch { return Object.freeze({ ok:false, reason:'REVIEW_QUEUE_WRITE_UNCERTAIN' }); }
  if (created?.created === true) return Object.freeze({ ok:true, replayed:false, reason:null });

  try { existing = await queue.read(pathname); }
  catch { return Object.freeze({ ok:false, reason:'REVIEW_QUEUE_RECONCILE_UNCERTAIN' }); }
  const same = existing?.request_digest === record.request_digest &&
    existing?.submission_id === record.submission_id;
  return Object.freeze({ ok:same, replayed:true, reason:same ? null : 'REVIEW_QUEUE_CONFLICT' });
}

function digest(value) {
  return createHash('sha256').update(String(value ?? '')).digest();
}

export function operatorTokenMatches(presented, expected) {
  if (typeof presented !== 'string' || typeof expected !== 'string' || expected.length < 32) return false;
  return timingSafeEqual(digest(presented), digest(expected));
}

export function bearerToken(request) {
  const raw = request?.headers?.get?.('authorization') || '';
  return raw.startsWith('Bearer ') ? raw.slice(7) : '';
}

export function validateClientSubmissionId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,80}$/.test(value);
}

export function deletionDecision(record, reason, nowIso = new Date().toISOString()) {
  if (!record || typeof record !== 'object') return Object.freeze({ allowed:false, reason:'NOT_FOUND' });
  if (reason === 'privacy_request') return Object.freeze({ allowed:true, reason:null });
  if (reason !== 'retention_expired') return Object.freeze({ allowed:false, reason:'DELETE_REASON_REQUIRED' });
  const expiry = Date.parse(record.retention_until || '');
  const now = Date.parse(nowIso);
  if (!Number.isFinite(expiry) || !Number.isFinite(now)) return Object.freeze({ allowed:false, reason:'RETENTION_UNKNOWN' });
  if (now < expiry) return Object.freeze({ allowed:false, reason:'RETENTION_NOT_EXPIRED' });
  return Object.freeze({ allowed:true, reason:null });
}
