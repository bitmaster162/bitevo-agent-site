import { readFile } from 'node:fs/promises';
import { evaluateL2Readiness } from './site-agent-l2-readiness.mjs';

const fixtures = JSON.parse(await readFile(new URL('../docs/SITE_AGENT_L2_LANE_FIXTURES_WAVE2_R1.json', import.meta.url), 'utf8'));
const policy = JSON.parse(await readFile(new URL('../docs/SITE_AGENT_POLICY_PACK_R1.json', import.meta.url), 'utf8'));
const schema = JSON.parse(await readFile(new URL('../docs/SITE_AGENT_L2_READINESS_SCHEMA_R1.json', import.meta.url), 'utf8'));

const expectedOrder = ['haven','creator','stas','bitevo'];
const expectedBindings = {
  haven: {type:'pr_head', sha:'71c56e2bf4938b3d4b759ddfeb1c4b7572732630'},
  creator: {type:'pr_head', sha:'f239803fc9c0730917cfdbd5539ed373091d6685'},
  stas: {type:'pr_head', sha:'cc5305a2fe49c51bcf427113f38ecb7af849504a'},
  bitevo: {type:'source_parent_head', sha:'9664ecc0c4ab10ca9e59b94e6b75021f9c0479cf'}
};

const tests = [];
tests.push(['priority order', JSON.stringify(fixtures.priority_order) === JSON.stringify(expectedOrder)]);
tests.push(['lane count', fixtures.lanes.length === expectedOrder.length]);

for (const lane of fixtures.lanes) {
  const receipt = evaluateL2Readiness(lane.readiness, policy, schema);
  const expected = expectedBindings[lane.lane];
  tests.push([`${lane.lane} source binding`, lane.source_binding.type === expected.type && lane.source_binding.sha === expected.sha]);
  tests.push([`${lane.lane} current controls blocked`, receipt.decision === 'NEEDS_L2_CONTROLS' && receipt.write_allowed === false && receipt.execute_authority === false]);
  tests.push([`${lane.lane} no storage destination`, lane.readiness.destination.approved === false && lane.readiness.destination.destination_ref === null]);
  tests.push([`${lane.lane} policy remains below L2`, !String(policy.lanes[lane.lane].release_level).startsWith('L2')]);
}

const noHandoffLanes = fixtures.lanes.filter((x) => ['haven','creator','bitevo'].includes(x.lane));
tests.push(['no invented handoffs', noHandoffLanes.every((x) => x.verified_handoff.available === false && x.verified_handoff.type === null)]);

const stas = fixtures.lanes.find((x) => x.lane === 'stas');
tests.push(['stas Robert role label', stas.verified_handoff.available === true && stas.verified_handoff.type === 'telegram' && stas.verified_handoff.role_label === 'Robert']);

const promoted = structuredClone(stas.readiness);
promoted.destination = { approved:true, kind:'telegram', destination_ref:stas.verified_handoff.ref };
promoted.controller = { approved:true, controller_ref:'synthetic-controller' };
promoted.retention = { approved:true, retention_rule:'synthetic-retention' };
promoted.access = { approved:true, roles:['owner'] };
promoted.privacy = { approved:true, privacy_ref:'synthetic-privacy' };
promoted.deletion_correction = { approved:true, method_ref:'synthetic-delete-correct' };
promoted.idempotency = { approved:true, strategy:'synthetic-idempotency' };
promoted.policy_binding = { approved:true, policy_version:policy.schema_version };
promoted.synthetic_test = { passed:true, receipt_sha256:'a'.repeat(64) };
const stasPromotedReceipt = evaluateL2Readiness(promoted, policy, schema);
tests.push(['stas Telegram cannot become storage', stasPromotedReceipt.decision === 'NEEDS_L2_CONTROLS' && stasPromotedReceipt.missing_controls.includes('destination') && stasPromotedReceipt.write_allowed === false]);

let passed = 0;
for (const [name, ok] of tests) {
  if (ok) passed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
}
console.log(`SITE_AGENT_L2_LANE_FIXTURES_WAVE2 ${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exit(1);
