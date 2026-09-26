import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const failures = [];
const read = route => readFile(`${dist}${route}/index.html`, 'utf8');
const strip = text => text.replace(/<[^>]*>/g,' ').replace(/&[a-z0-9#]+;/gi,' ').replace(/\s+/g,' ').trim();

const en = await read('/build/renewal-expansion-gate');
const ru = await read('/ru/build/renewal-expansion-gate');
const enMeasured = await read('/build/measured-value-gate');
const ruMeasured = await read('/ru/build/measured-value-gate');
const data = JSON.parse(await readFile(`${dist}/build/renewal-expansion-gate.json`,'utf8'));

for (const phrase of ['Measured value is not renewal.','NO RENEWAL CLAIM · NO EXPANSION CLAIM · NO RETAINED REVENUE CLAIM · NO NRR CLAIM · NO ROI CLAIM','No renewal or expansion state is represented.','Measured value cannot substitute for a buyer renewal decision.']) if (!strip(en).includes(phrase)) failures.push(`EN missing: ${phrase}`);
for (const phrase of ['Измеренная ценность ещё не означает продление.','NO RENEWAL CLAIM · NO EXPANSION CLAIM · NO RETAINED REVENUE CLAIM · NO NRR CLAIM · NO ROI CLAIM','Никакой renewal или expansion state здесь не представлен.','Measured value не заменяет buyer renewal decision.']) if (!strip(ru).includes(phrase)) failures.push(`RU missing: ${phrase}`);

if (data.schema !== 'bitevo.build-renewal-expansion-gate/v1' || data.state !== 'PUBLIC_BUILD_RENEWAL_EXPANSION_READINESS_TEMPLATE_NOT_CUSTOMER_STATE' || data.customer_state !== 'NOT_REPRESENTED') failures.push('schema/state/customer-state drift');
for (const [key,value] of Object.entries(data.claims||{})) if (value !== false) failures.push(`claim ${key} must remain false`);
if (Object.keys(data.claims||{}).length !== 14) failures.push('claim count drift');
for (const key of ['measured_value_observed','customer_case_evidence','renewal_expansion_evidence','renewal_committed','expansion_committed','retained_revenue_evidence','nrr_evidence','roi_claim_published','customer_result_claim_published']) if (data.claims?.[key] !== false) failures.push(`required false claim drift ${key}`);

const offer = data.offer || {};
if (offer.name !== 'BUILD Workflow Exception Diagnostic' || offer.price_usd !== 3000 || offer.timebox_business_days !== 5 || offer.scope_object !== 'one recurring exception workflow') failures.push('fixed BUILD offer drift');
if (!enMeasured.includes('href="/build/renewal-expansion-gate"')) failures.push('EN measured-value missing renewal link');
if (!ruMeasured.includes('href="/ru/build/renewal-expansion-gate"')) failures.push('RU measured-value missing renewal link');

if (!Array.isArray(data.required_renewal_expansion_evidence) || data.required_renewal_expansion_evidence.length !== 8 || data.required_renewal_expansion_evidence.some(x => x.status !== 'REQUIRES_EXTERNAL_EVIDENCE')) failures.push('renewal evidence gate drift');

const cb = data.claim_boundary || {};
if (cb.measured_value_is_renewal_evidence !== false || cb.delivery_is_renewal_evidence !== false || cb.synthetic_workflow_value_example_is_renewal_evidence !== false || cb.public_site_may_claim_retained_revenue_without_external_evidence !== false || cb.public_site_may_claim_nrr_without_external_evidence !== false || cb.renewal_claim !== 'NOT_AVAILABLE_FROM_PUBLIC_TEMPLATE' || cb.expansion_claim !== 'NOT_AVAILABLE_FROM_PUBLIC_TEMPLATE' || cb.roi_claim !== 'NOT_AVAILABLE_FROM_PUBLIC_TEMPLATE') failures.push('claim boundary drift');

const sr = data.synthetic_reference || {};
if (sr.route !== '/build/workflow-value-example' || sr.customer_evidence !== false || sr.measured_value_evidence !== false || sr.renewal_evidence !== false) failures.push('synthetic renewal boundary drift');

const pb = data.payment_boundary || {};
if (pb.public_site_accepts_payment !== false || pb.receiving_rail_claim !== 'NOT_PUBLISHED' || pb.invoice_or_payment_request !== 'NOT_ISSUED_BY_THIS_TEMPLATE' || pb.payment_confirmation !== 'NOT_AVAILABLE_FROM_PUBLIC_SITE') failures.push('payment boundary drift');

const eb = data.effect_boundary || {};
if (eb.network_write !== 0 || eb.storage_write !== 0 || eb.external_effect !== 0 || eb.renewal_commit !== 0 || eb.expansion_commit !== 0 || eb.commercial_claim_publish !== 0) failures.push('effect boundary drift');

if (failures.length) {
  console.error(`BUILD_RENEWAL_EXPANSION_GATE=FAIL evidence=${data.required_renewal_expansion_evidence?.length ?? 0} claims=${Object.keys(data.claims||{}).length} failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`BUILD_RENEWAL_EXPANSION_GATE=PASS evidence=${data.required_renewal_expansion_evidence.length} claims=${Object.keys(data.claims).length} boundaries=PASS links=PASS failures=0`);
