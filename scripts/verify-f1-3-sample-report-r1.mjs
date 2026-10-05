import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };
const deep = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks += 1; };
const root = new URL('../', import.meta.url);

const statuses = ['PASS', 'FAIL', 'PARTIAL', 'REJECTED HYPOTHESIS', 'BLOCKED'];
const columns = ['Control question', 'Expected', 'Observed', 'Status', 'Evidence'];
const findingFields = ['Impact', 'Evidence', 'Limitations', 'Confidence'];
const ownerFields = ['Owner question', 'Result', 'Decision', 'Supported by'];
const controls = [
  ['T1', 'Object binding'],
  ['T2', 'Approval binding'],
  ['T3', 'External effect'],
  ['T4', 'Retry / replay'],
  ['T5', 'Identity / scope']
];

const sampleSource = await readFile(new URL('src/pages/sample-audit.astro', root), 'utf8');
const jsonSource = await readFile(new URL('src/pages/sample-audit.json.ts', root), 'utf8');
const pricingSource = await readFile(new URL('src/pages/pricing.astro', root), 'utf8');
const entrySource = await readFile(new URL('src/pages/entry-audit.astro', root), 'utf8');
const preCheckSource = await readFile(new URL('src/pages/pre-check.astro', root), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const currentness = JSON.parse(await readFile(new URL('src/data/sitemap-currentness.json', root), 'utf8'));

const sampleHtml = await readFile(new URL('dist/sample-audit/index.html', root), 'utf8');
const pricingHtml = await readFile(new URL('dist/pricing/index.html', root), 'utf8');
const entryHtml = await readFile(new URL('dist/entry-audit/index.html', root), 'utf8');
const preCheckHtml = await readFile(new URL('dist/pre-check/index.html', root), 'utf8');
const sitemap = await readFile(new URL('dist/sitemap.xml', root), 'utf8');
const pack = JSON.parse(await readFile(new URL('dist/sample-audit.json', root), 'utf8'));

check(sampleSource.includes('data-f1-3-report-template'), 'sample source contains dedicated F1.3 template block');
check(sampleSource.includes('Entry Audit report template · TEMPLATE'), 'template block is visibly marked TEMPLATE');
check(sampleSource.includes('placeholders are not observations, test results or customer evidence'), 'template-only boundary is explicit');
check(sampleHtml.includes('TEMPLATE ONLY'), 'static HTML preserves template-only status banner');
check(sampleHtml.includes('SYNTHETIC / NOT EXECUTED'), 'existing SAMPLE synthetic boundary remains visible');

deep(pack.report_template?.status_vocabulary, statuses, 'machine-readable status vocabulary exact');
deep(pack.report_template?.test_matrix_columns, columns, 'machine-readable expected-vs-observed columns exact');
deep(pack.report_template?.finding_card_fields, findingFields, 'machine-readable finding card fields exact');
deep(pack.report_template?.owner_decision_fields, ownerFields, 'machine-readable owner decision fields exact');
equal(pack.report_template?.template_only, true, 'report template is explicitly template-only');
equal(pack.report_template?.customer_data, false, 'report template explicitly contains no customer data');
equal(pack.report_template?.test_rows?.length, 5, 'report template has five canonical control rows');

for (let i = 0; i < controls.length; i += 1) {
  const [id, question] = controls[i];
  const row = pack.report_template.test_rows[i];
  equal(row?.id, id, id + ' id exact');
  equal(row?.control_question, question, id + ' control question exact');
  equal(row?.expected, '[Expected]', id + ' expected remains placeholder');
  equal(row?.observed, '[Observed]', id + ' observed remains placeholder');
  equal(row?.status, '[Status]', id + ' status remains placeholder');
  equal(row?.evidence, '[Ref]', id + ' evidence remains placeholder');
  check(sampleHtml.includes(id + ' · ' + question), id + ' visible in static HTML');
}

for (const status of statuses) {
  check(sampleSource.includes("'" + status + "'"), 'source carries status: ' + status);
  check(sampleHtml.includes(status), 'static HTML carries status: ' + status);
}
for (const field of findingFields) check(sampleHtml.includes(field), 'finding-card field visible: ' + field);
for (const field of ownerFields) check(sampleHtml.includes(field), 'owner-decision field visible: ' + field);

check(pack.finding_record?.id === 'SAMPLE-FG-001', 'existing P28.9 finding record preserved');
check(pack.finding_record?.status === 'SYNTHETIC WORKED EXAMPLE — NOT EXECUTED', 'existing finding remains explicitly not executed');
check(pack.executed_audit === false && pack.customer_evidence === false, 'existing public pack keeps no-executed-audit/no-customer-evidence boundary');
check(jsonSource.includes('report_template:'), 'JSON source carries report_template block');

check(pricingSource.includes("sampleCta: 'See sample report'") && pricingSource.includes("sampleHref: '/sample-audit'"), 'Pricing Entry Audit tier links to sample report');
check(/href="\/sample-audit"[^>]*>See sample report →<\/a>/.test(pricingHtml), 'Pricing static HTML contains sample report link');
check(entrySource.includes('href="/sample-audit">See sample report</a>'), 'Entry Audit source links to sample report');
check(entryHtml.includes('href="/sample-audit">See sample report</a>'), 'Entry Audit static HTML links to sample report');

equal((preCheckSource.match(/href="\/sample-audit"/g) || []).length, 1, 'Pre-Check source has exactly one sample-report link');
const resultIndex = preCheckSource.indexOf('data-precheck-result');
const sampleLinkIndex = preCheckSource.indexOf('href="/sample-audit"');
check(resultIndex >= 0 && sampleLinkIndex > resultIndex, 'Pre-Check sample-report link is inside the result flow, not the input form');
equal((preCheckHtml.match(/href="\/sample-audit"/g) || []).length, 1, 'Pre-Check static HTML has exactly one sample-report link');
check(preCheckHtml.includes('name="robots" content="noindex, follow"'), 'Pre-Check remains noindex after F1.3 link move');
check(!sitemap.includes('<loc>https://bitevo.work/pre-check</loc>'), 'Pre-Check remains absent from sitemap');

for (const path of ['/sample-audit', '/pricing', '/entry-audit']) {
  const row = currentness.routes.find(item => item.path === path);
  check(Boolean(row), path + ' currentness row exists');
  equal(row?.lastmod, '2026-10-05', path + ' lastmod remains current date');
  check(/^sha256:[0-9a-f]{64}$/.test(row?.fingerprint || ''), path + ' currentness fingerprint valid');
}
equal(currentness.routes.length, 117, 'indexable currentness route count unchanged');
check(packageJson.scripts?.['verify:core']?.includes('verify-f1-3-sample-report-r1.mjs'), 'F1.3 verifier wired into verify:core');

console.log(
  'F1_3_SAMPLE_REPORT_R1_GATE=PASS checks=' + checks +
  ' statuses=5 matrix_rows=5 finding_fields=4 owner_fields=4 template_only=1 customer_data=0' +
  ' links=pricing+entry_audit+precheck_result p28_9_finding=PRESERVED precheck_noindex=PASS'
);
