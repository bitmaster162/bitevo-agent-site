export const SCOPE_HANDOFF_R1_RETENTION_POLICY_SCHEMA = 'bitevo.scope-handoff-retention-policy.v1';
export const SCOPE_HANDOFF_R1_RETENTION_DECISION_STATUS = 'ROBERT_DECISION_PENDING';
export const SCOPE_HANDOFF_R1_PROPOSED_RETENTION_DAYS = 30;
export const SCOPE_HANDOFF_R1_PROPOSED_STORAGE_OWNER = 'Robert Dumanyan, Founder, BitEvo';
// Compatibility aliases preserve existing fail-closed comparisons; these values are proposals, not an owner-authored decision.
export const SCOPE_HANDOFF_R1_RETENTION_DAYS = SCOPE_HANDOFF_R1_PROPOSED_RETENTION_DAYS;
export const SCOPE_HANDOFF_R1_STORAGE_OWNER = SCOPE_HANDOFF_R1_PROPOSED_STORAGE_OWNER;
export const SCOPE_HANDOFF_R1_STORAGE_OWNER_EMAIL = 'robert@bitevo.work';
export const SCOPE_HANDOFF_R1_RETENTION_CRON_PATH = '/api/scope-handoff-retention';
export const SCOPE_HANDOFF_R1_RETENTION_CRON_SCHEDULE = '0 3 * * *';

function readExact(env, key) {
  try {
    const value = env && typeof env === 'object' ? env[key] : undefined;
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

export function evaluateScopeHandoffRetentionPolicyEnvironment(env = {}) {
  const owner = readExact(env, 'SCOPE_HANDOFF_R1_STORAGE_OWNER');
  const retentionRaw = readExact(env, 'SCOPE_HANDOFF_R1_RETENTION_DAYS');
  const cronSecret = readExact(env, 'CRON_SECRET');
  const checks = Object.freeze({
    storageOwner: owner === SCOPE_HANDOFF_R1_STORAGE_OWNER,
    retentionDays: retentionRaw === String(SCOPE_HANDOFF_R1_RETENTION_DAYS),
    cronSecret: cronSecret.length >= 32
  });
  return Object.freeze({
    schema:SCOPE_HANDOFF_R1_RETENTION_POLICY_SCHEMA,
    checks,
    ready:checks.storageOwner && checks.retentionDays && checks.cronSecret,
    storageOwner:checks.storageOwner ? owner : null,
    retentionDays:checks.retentionDays ? SCOPE_HANDOFF_R1_RETENTION_DAYS : null
  });
}
