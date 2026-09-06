import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { evaluateL2Readiness } from './site-agent-l2-readiness.mjs';

const manifest = JSON.parse(await readFile(new URL('../docs/SITE_AGENT_L2_FLEET_MANIFEST_R1.json', import.meta.url), 'utf8'));

const readText = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const gitBlobSha = (text) => crypto.createHash('sha1')
  .update(`blob ${Buffer.byteLength(text)}\0`)
  .update(text)
  .digest('hex');
const sameSet = (a, b) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

const policyText = await readText(manifest.policy.path);
const schemaText = await readText(manifest.readiness_schema.path);
const policy = JSON.parse(policyText);
const readinessSchema = JSON.parse(schemaText);
const waves = [];
for (const spec of manifest.waves) {
  const text = await readText(spec.path);
  waves.push({ spec, text, data: JSON.parse(text) });
}

const tests = [];
tests.push(['manifest schema', manifest.schema_version === 'SITE_AGENT_L2_FLEET_MANIFEST_R1']);
tests.push(['source parent head', manifest.source_parent_head === 'd05c842659dd7239e2bddb1861d1cd5169daa466']);
tests.push(['two fixture waves', manifest.waves.length === 2]);
tests.push(['unique wave paths', new Set(manifest.waves.map((x) => x.path)).size === manifest.waves.length]);

tests.push(['policy blob binding', gitBlobSha(policyText) === manifest.policy.blob_sha]);
tests.push(['policy schema binding', policy.schema_version === manifest.policy.schema_version]);
tests.push(['readiness schema blob binding', gitBlobSha(schemaText) === manifest.readiness_schema.blob_sha]);
tests.push(['readiness schema id binding', readinessSchema.properties?.schema_version?.const === manifest.readiness_schema.schema_version]);

for (const {spec, text, data} of waves) {
  tests.push([`${spec.name} blob binding`, gitBlobSha(text) === spec.blob_sha]);
  tests.push([`${spec.name} schema binding`, data.schema_version === spec.schema_version]);
}

const expected = manifest.expected_fleet_lanes;
const combined = waves.flatMap(({data}) => data.lanes.map((lane) => lane.lane));
const waveSets = waves.map(({data}) => new Set(data.lanes.map((lane) => lane.lane)));
const overlap = [...waveSets[0]].filter((lane) => waveSets[1].has(lane));

tests.push(['expected fleet size 8', expected.length === 8]);
tests.push(['combined lane count 8', combined.length === 8]);
tests.push(['combined lanes unique', new Set(combined).size === 8]);
tests.push(['exact fleet coverage', sameSet(combined, expected)]);
tests.push(['wave overlap empty', overlap.length === 0]);
tests.push(['wave lane declarations bound', waves.every(({spec, data}) => JSON.stringify(data.priority_order) === JSON.stringify(spec.lanes))]);
tests.push(['policy fleet coverage', sameSet(Object.keys(policy.lanes), expected)]);

const allFixtureRows = waves.flatMap(({data}) => data.lanes);
const allReceipts = allFixtureRows.map((lane) => evaluateL2Readiness(lane.readiness, policy, readinessSchema));
tests.push(['all lanes remain blocked/non-authoritative', allReceipts.every((r) => r.decision === 'NEEDS_L2_CONTROLS' && r.write_allowed === false && r.execute_authority === false)]);
tests.push(['all fixture destinations unapproved', allFixtureRows.every((lane) => lane.readiness.destination.approved === false && lane.readiness.destination.destination_ref === null)]);
tests.push(['manifest non-authority invariants', manifest.invariants.storage_write_allowed === false && manifest.invariants.execute_authority === false && manifest.invariants.production_effects_authorized === false && manifest.invariants.human_handoff_is_storage === false]);

let passed = 0;
for (const [name, ok] of tests) {
  if (ok) passed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
}
console.log(`SITE_AGENT_L2_FLEET_MANIFEST ${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exit(1);
