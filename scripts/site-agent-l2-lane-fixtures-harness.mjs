import { readFile } from 'node:fs/promises';
import { evaluateL2Readiness } from './site-agent-l2-readiness.mjs';

const fixtures = JSON.parse(await readFile(new URL('../docs/SITE_AGENT_L2_LANE_FIXTURES_R1.json', import.meta.url), 'utf8'));
const policy = JSON.parse(await readFile(new URL('../docs/SITE_AGENT_POLICY_PACK_R1.json', import.meta.url), 'utf8'));
const schema = JSON.parse(await readFile(new URL('../docs/SITE_AGENT_L2_READINESS_SCHEMA_R1.json', import.meta.url), 'utf8'));

const expectedOrder = ['dar','pharaohs','yakov','ivan'];
const expectedHeads = {
  dar:'83b8673addbff415e535c7742915fba779602db8',
  pharaohs:'9b2ff45e797ad20ae80b219c7e78f3fddc9d4b97',
  yakov:'828f02764117bf6b2e686f6ee8a464725bab7b3e',
  ivan:'2199d1cb78110fc9461a015f1a8d7e85d5987061'
};

const tests = [];
tests.push(['priority order', JSON.stringify(fixtures.priority_order) === JSON.stringify(expectedOrder)]);
tests.push(['lane count', fixtures.lanes.length === expectedOrder.length]);
for (const lane of fixtures.lanes) {
  const receipt = evaluateL2Readiness(lane.readiness, policy, schema);
  tests.push([`${lane.lane} exact head`, lane.pr_head === expectedHeads[lane.lane]]);
  tests.push([`${lane.lane} current controls blocked`, receipt.decision === 'NEEDS_L2_CONTROLS' && receipt.write_allowed === false && receipt.execute_authority === false]);
  tests.push([`${lane.lane} no storage destination`, lane.readiness.destination.approved === false && lane.readiness.destination.destination_ref === null]);
}
for (const lane of fixtures.lanes.filter((x) => x.verified_handoff.available)) {
  const promoted = structuredClone(lane.readiness);
  promoted.destination = { approved:true, kind:lane.verified_handoff.type, destination_ref:lane.verified_handoff.ref };
  promoted.controller = { approved:true, controller_ref:'synthetic-controller' };
  promoted.retention = { approved:true, retention_rule:'synthetic-retention' };
  promoted.access = { approved:true, roles:['owner'] };
  promoted.privacy = { approved:true, privacy_ref:'synthetic-privacy' };
  promoted.deletion_correction = { approved:true, method_ref:'synthetic-delete-correct' };
  promoted.idempotency = { approved:true, strategy:'synthetic-idempotency' };
  promoted.policy_binding = { approved:true, policy_version:policy.schema_version };
  promoted.synthetic_test = { passed:true, receipt_sha256:'a'.repeat(64) };
  const receipt = evaluateL2Readiness(promoted, policy, schema);
  tests.push([`${lane.lane} handoff cannot become storage`, receipt.decision === 'NEEDS_L2_CONTROLS' && receipt.missing_controls.includes('destination') && receipt.write_allowed === false]);
}

let passed = 0;
for (const [name, ok] of tests) {
  if (ok) passed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
}
console.log(`SITE_AGENT_L2_LANE_FIXTURES ${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exit(1);
