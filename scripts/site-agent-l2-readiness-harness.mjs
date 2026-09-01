import { evaluateL2Readiness, loadPolicy, loadReadinessSchema } from './site-agent-l2-readiness.mjs';

const policy = await loadPolicy();
const schema = await loadReadinessSchema();
const sha = 'a'.repeat(64);
const empty = (lane = 'dar') => ({
  schema_version: 'SITE_AGENT_L2_READINESS_R1',
  lane,
  destination: { approved: false, kind: null, destination_ref: null },
  controller: { approved: false, controller_ref: null },
  retention: { approved: false, retention_rule: null },
  access: { approved: false, roles: [] },
  privacy: { approved: false, privacy_ref: null },
  deletion_correction: { approved: false, method_ref: null },
  idempotency: { approved: false, strategy: null },
  policy_binding: { approved: false, policy_version: null },
  synthetic_test: { passed: false, receipt_sha256: null }
});
const complete = (lane = 'dar') => ({
  schema_version: 'SITE_AGENT_L2_READINESS_R1',
  lane,
  destination: { approved: true, kind: 'queue', destination_ref: 'approved-destination-ref' },
  controller: { approved: true, controller_ref: 'owner-role-ref' },
  retention: { approved: true, retention_rule: 'approved-retention-policy-ref' },
  access: { approved: true, roles: ['owner'] },
  privacy: { approved: true, privacy_ref: 'approved-privacy-notice-ref' },
  deletion_correction: { approved: true, method_ref: 'approved-delete-correct-process-ref' },
  idempotency: { approved: true, strategy: 'session-plus-payload-hash' },
  policy_binding: { approved: true, policy_version: 'SITE_AGENT_POLICY_PACK_R1' },
  synthetic_test: { passed: true, receipt_sha256: sha }
});

const l2Policy = structuredClone(policy);
l2Policy.lanes.dar.release_level = 'L2_APPROVED';

const cases = [
  ['empty controls', empty('dar'), policy, 'NEEDS_L2_CONTROLS'],
  ['destination only', { ...empty('dar'), destination: { approved: true, kind: 'queue', destination_ref: 'ref' } }, policy, 'NEEDS_L2_CONTROLS'],
  ['complete dar current L0', complete('dar'), policy, 'READY_FOR_L2_POLICY_GATE'],
  ['complete yakov current L1', complete('yakov'), policy, 'READY_FOR_L2_POLICY_GATE'],
  ['complete synthetic L2 policy', complete('dar'), l2Policy, 'READY_FOR_L2_DRY_RUN'],
  ['policy binding mismatch', { ...complete('dar'), policy_binding: { approved: true, policy_version: 'OTHER' } }, policy, 'NEEDS_L2_CONTROLS'],
  ['access roles empty', { ...complete('dar'), access: { approved: true, roles: [] } }, policy, 'NEEDS_L2_CONTROLS'],
  ['deletion path missing', { ...complete('dar'), deletion_correction: { approved: true, method_ref: null } }, policy, 'NEEDS_L2_CONTROLS'],
  ['bad schema version', { ...complete('dar'), schema_version: 'SITE_AGENT_L2_READINESS_R2' }, policy, 'BLOCKED_SCHEMA'],
  ['extra property blocked', { ...complete('dar'), unexpected: true }, policy, 'BLOCKED_SCHEMA'],
  ['unknown lane blocked', { ...complete('dar'), lane: 'unknown' }, policy, 'BLOCKED_SCHEMA'],
  ['bad synthetic receipt shape', { ...complete('dar'), synthetic_test: { passed: true, receipt_sha256: 'short' } }, policy, 'BLOCKED_SCHEMA'],
  ['wrong access type blocked', { ...complete('dar'), access: { approved: true, roles: 'owner' } }, policy, 'BLOCKED_SCHEMA']
];

let passed = 0;
for (const [name, config, activePolicy, expected] of cases) {
  const receipt = evaluateL2Readiness(config, activePolicy, schema);
  const ok = receipt.decision === expected && receipt.write_allowed === false && receipt.execute_authority === false;
  if (ok) passed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} :: ${receipt.decision}${receipt.missing_controls.length ? ` / missing=${receipt.missing_controls.join(',')}` : ''}${receipt.schema_errors.length ? ` / schema=${receipt.schema_errors.join(',')}` : ''}`);
}
console.log(`SITE_AGENT_L2_READINESS ${passed}/${cases.length} PASS`);
if (passed !== cases.length) process.exit(1);
