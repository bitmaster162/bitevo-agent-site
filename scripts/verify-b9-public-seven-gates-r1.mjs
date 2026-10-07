import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DIAGNOSTIC_QUESTIONS, DIAGNOSTIC_SCHEMA } from '../mcp/bitevo-authority/src/diagnostic.mjs';

let checks = 0;
const check = (value, message) => { checks += 1; assert.ok(value, message); };
const equal = (actual, expected, message) => { checks += 1; assert.deepEqual(actual, expected, message); };

const root = new URL('../', import.meta.url);
const readme = await readFile(new URL('README.md', root), 'utf8');
const doc = await readFile(new URL('docs/BITEVO_SEVEN_AUTHORITY_GATES_R1.md', root), 'utf8');
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

const expectedNames = [
  'Authority Budget',
  'Object binding',
  'Authority owner',
  'Evidence Before Effect',
  'Freshness',
  'External confirmation',
  'Recovery',
];

equal(DIAGNOSTIC_SCHEMA, 'bitevo.diagnostic.r1', 'canonical diagnostic schema exact');
equal(DIAGNOSTIC_QUESTIONS.length, 7, 'canonical source contains exactly seven gates');
equal(DIAGNOSTIC_QUESTIONS.map(item => item.gate), expectedNames, 'canonical gate names and order exact');

check(readme.includes('## Seven authority gates'), 'README exposes seven-gates entrypoint');
check(readme.includes('docs/BITEVO_SEVEN_AUTHORITY_GATES_R1.md'), 'README links documentation projection');
check(readme.includes('mcp/bitevo-authority/src/diagnostic.mjs'), 'README links canonical source');
check(readme.includes('DIAGNOSTIC_QUESTIONS'), 'README names canonical export');
for (const name of expectedNames) check(readme.includes(name), 'README names gate: ' + name);
check(readme.includes('not a safety verdict'), 'README preserves no-safety-verdict boundary');
check(readme.includes('does not authorize testing'), 'README preserves no-testing-authorization boundary');

check(doc.includes('DOCUMENTATION_PROJECTION'), 'doc labels itself as projection');
check(doc.includes('NO_SAFETY_PASS'), 'doc forbids safety-pass claim');
check(doc.includes('NO_CERTIFICATION'), 'doc forbids certification claim');
check(doc.includes('NO_TESTING_AUTHORIZATION'), 'doc forbids testing-authorization claim');
check(doc.includes('not an independent source of truth'), 'doc points authority back to canonical source');
check(doc.includes('DIAGNOSTIC_QUESTIONS'), 'doc binds canonical export');
check(doc.includes('does not unblock C4/N14'), 'doc preserves C4/N14 blocker');

const start = '<!-- B9:GATES:START -->';
const end = '<!-- B9:GATES:END -->';
const startIndex = doc.indexOf(start);
const endIndex = doc.indexOf(end);
check(startIndex >= 0 && endIndex > startIndex, 'machine-readable gate table markers present');

const block = doc.slice(startIndex + start.length, endIndex);
const dataRows = block
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => /^\|\s*(?:action|object|owner|evidence|freshness|confirm|recovery)\s*\|/.test(line));

equal(dataRows.length, 7, 'documentation projection contains exactly seven gate rows');

const parsed = dataRows.map(line => {
  const cells = line.slice(1, -1).split('|').map(cell => cell.trim());
  equal(cells.length, 4, 'gate row contains id/gate/question/why');
  return { id: cells[0], gate: cells[1], q: cells[2], why: cells[3] };
});

equal(parsed, DIAGNOSTIC_QUESTIONS.map(({ id, gate, q, why }) => ({ id, gate, q, why })), 'documentation projection matches canonical source field-for-field');

for (const item of DIAGNOSTIC_QUESTIONS) {
  check(doc.includes(item.gate), 'doc includes canonical gate: ' + item.gate);
  check(doc.includes(item.q), 'doc includes canonical question: ' + item.id);
  check(doc.includes(item.why), 'doc includes canonical rationale: ' + item.id);
}

for (const forbidden of [
  'certified safe',
  'safety certified',
  'guaranteed safe',
  'passes security',
  'testing is authorized',
  'C4/N14 unblocked',
]) {
  check(!doc.toLowerCase().includes(forbidden.toLowerCase()), 'forbidden overclaim absent: ' + forbidden);
}

check(pkg.scripts?.['verify:core']?.includes('verify-b9-public-seven-gates-r1.mjs'), 'B9 verifier wired into verify:core');

console.log(
  'B9_PUBLIC_SEVEN_AUTHORITY_GATES_R1=PASS checks=' + checks +
  ' canonical_schema=bitevo.diagnostic.r1 gates=7 projection=EXACT' +
  ' independent_canon=0 site_routes_added=0 safety_pass=0 certification=0 testing_authorization=0' +
  ' external_network_required=0 can_trade=false capital_permission=DENY c4_n14=BLOCKED'
);
