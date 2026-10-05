import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };
const sha = value => createHash('sha256').update(value, 'utf8').digest('hex');
const root = new URL('../', import.meta.url);

const risk = 'ASI09 · Human-Agent Trust Exploitation';
const authority = 'Update two qualification fields on one matched staging CRM lead.';
const evidence = 'Authority and pre-action evidence may be sufficient; post-action external confirmation is not.';
const downloadLabel = 'Download JSON';

equal(sha(risk), 'b86203181b180ad5277ea05de4834d0c9d52e66c96e147e329a1a84942b13d59', 'approved ASI09 label hash');
equal(sha(authority), '12483806cb16d31db91ac1f8bf9a5e17069429f7613c511bd2f53e5dd635ad6a', 'approved authority-involved hash');
equal(sha(evidence), '4251fba176b6e9a93048ab458d18630d0c6ef1e007d8c260044a478acbdaf35d', 'approved evidence-at-decision-time hash');
equal(sha(downloadLabel), '49e0e6d56e345316a709f20b340aecf39a14714925cbd4806a6f8abc8c4c203b', 'approved Download JSON label hash');

const sampleSource = await readFile(new URL('src/pages/sample-audit.astro', root), 'utf8');
const jsonSource = await readFile(new URL('src/pages/sample-audit.json.ts', root), 'utf8');
const mappingSource = await readFile(new URL('src/pages/owasp-agentic-top-10.astro', root), 'utf8');
const html = await readFile(new URL('dist/sample-audit/index.html', root), 'utf8');
const pack = JSON.parse(await readFile(new URL('dist/sample-audit.json', root), 'utf8'));
const currentness = JSON.parse(await readFile(new URL('src/data/sitemap-currentness.json', root), 'utf8'));
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

const visibleFinding = [
  ['Finding ID', 'SAMPLE-FG-001'],
  ['OWASP ASI risk', risk],
  ['Class', 'False Green / external-effect confirmation gap'],
  ['Status', 'SYNTHETIC WORKED EXAMPLE — NOT EXECUTED'],
  ['Trigger', 'The orchestration layer reports success while the required external read-back is absent, unchanged or bound to a different object.'],
  ['Authority involved', authority],
  ['Evidence at decision time', evidence],
  ['Observed effect', 'Not observed. This public pack does not claim a real execution.'],
  ['Decision relevance', 'Without independent confirmation, the owner cannot distinguish completed write from accepted/enqueued/no-effect/wrong-object outcomes.'],
  ['Recommended decision', 'CONSTRAIN authority after ambiguous acknowledgement; require same-object read-back before declaring success or allowing retry.']
];

const jsonFinding = {
  id: 'SAMPLE-FG-001',
  owasp_asi_risk: risk,
  class: 'False Green / external-effect confirmation gap',
  status: 'SYNTHETIC WORKED EXAMPLE — NOT EXECUTED',
  trigger: 'The orchestration layer reports success while the required external read-back is absent, unchanged or bound to a different object.',
  authority_involved: authority,
  evidence_at_decision_time: evidence,
  observed_effect: 'Not observed. This public pack does not claim a real execution.',
  decision_relevance: 'Without independent confirmation, the owner cannot distinguish completed write from accepted/enqueued/no-effect/wrong-object outcomes.',
  recommended_decision: 'CONSTRAIN authority after ambiguous acknowledgement; require same-object read-back before declaring success or allowing retry.'
};

equal(visibleFinding.length, 10, 'visible finding structure has exactly ten fields');
equal(Object.keys(pack.finding_record ?? {}).length, 10, 'JSON finding_record has exactly ten fields');
assert.deepEqual(pack.finding_record, jsonFinding, 'JSON finding_record matches the visible finding semantics');
checks += 1;

for (const [label, value] of visibleFinding) {
  check(sampleSource.includes(label), `source contains finding label: ${label}`);
  check(sampleSource.includes(value) || (label === 'OWASP ASI risk' && sampleSource.includes('owaspRisk')), `source contains finding value: ${label}`);
  check(html.includes(label), `static HTML contains finding label: ${label}`);
  check(html.includes(value), `static HTML contains finding value: ${label}`);
}

check(sampleSource.includes('href="/owasp-agentic-top-10"'), 'OWASP risk label links to P28.6 mapping page in source');
check(html.includes('href="/owasp-agentic-top-10"') && html.includes(risk), 'OWASP risk label links to P28.6 mapping page in static HTML');
check(mappingSource.includes("id:'ASI09'") && mappingSource.includes("name:'Human-Agent Trust Exploitation'"), 'P28.6 mapping contains exact ASI09 id/name');
check(mappingSource.includes("gates:['External confirmation','Authority owner']"), 'P28.6 mapping contains approved ASI09 gates');
check(mappingSource.includes('Whether "done" was reported before the external system confirmed it'), 'P28.6 mapping contains approved ASI09 evidence rationale');

check(sampleSource.includes('Open machine-readable pack'), 'existing open machine-readable CTA preserved');
check(html.includes('Open machine-readable pack'), 'existing open machine-readable CTA remains in static HTML');
check(sampleSource.includes('href="/sample-audit.json" download="SAMPLE-001.json"') && sampleSource.includes(downloadLabel), 'download CTA source exact');
check(/href="\/sample-audit\.json"[^>]*download="SAMPLE-001\.json"[^>]*>Download JSON<\/a>/.test(html), 'download CTA static HTML exact');

equal(pack.customer_evidence, false, 'customer_evidence remains false');
equal(pack.certification, false, 'certification remains false');
equal(pack.executed_audit, false, 'executed_audit remains false');
check(html.includes('SYNTHETIC / NOT EXECUTED'), 'visible synthetic/not-executed banner preserved');
check(html.includes('No customer system, customer data, private infrastructure, credential, production environment or external audit result is represented here.'), 'visible no-customer-evidence boundary preserved');
check(jsonSource.includes(authority) && jsonSource.includes(evidence), 'JSON source includes the two formerly missing visible finding fields');

const row = currentness.routes.find(item => item.path === '/sample-audit');
check(row?.lastmod === '2026-10-05', 'sample-audit lastmod is 2026-10-05 after N2 footer discovery link');
check(/^sha256:[0-9a-f]{64}$/.test(row?.fingerprint ?? ''), 'sample-audit currentness fingerprint valid');
equal(currentness.routes.length, 119, 'currentness route count is exact P30 baseline');
check(packageJson.scripts?.['verify:core']?.includes('verify-p28-sample-audit-owasp-r1.mjs'), 'P28.9 verifier wired into verify:core');

console.log(`P28_SAMPLE_AUDIT_OWASP_R1_GATE=PASS checks=${checks} findings=1 finding_fields=10 owasp=ASI09 download_json=PASS synthetic_boundary=PASS js_required=0`);
