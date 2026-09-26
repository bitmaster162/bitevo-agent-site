import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const failures = [];
const read = route => readFile(`${dist}${route}/index.html`, 'utf8');
const strip = text => text.replace(/<[^>]*>/g,' ').replace(/&[a-z0-9#]+;/gi,' ').replace(/\s+/g,' ').trim();
const hasHref = (html,href) => [...html.matchAll(/<a\b([^>]*)>/gi)].some(m => (m[1]||'').match(/\bhref=["']([^"']+)["']/i)?.[1]===href);

const en = await read('/audit/measured-value-gate');
const ru = await read('/ru/audit/measured-value-gate');
const enPaid = await read('/audit/paid-start-gate');
const ruPaid = await read('/ru/audit/paid-start-gate');
const data = JSON.parse(await readFile(`${dist}/audit/measured-value-gate.json`,'utf8'));

for (const phrase of ['Delivery is not measured value.','NO CUSTOMER RESULT · NO ROI CLAIM · NO MEASURED VALUE CLAIM · NO RENEWAL EVIDENCE','No delivery or measurement state is represented.','cannot substitute for measured value']) if (!strip(en).includes(phrase)) failures.push(`EN missing: ${phrase}`);
for (const phrase of ['Выполнение ещё не означает измеренную ценность.','NO CUSTOMER RESULT · NO ROI CLAIM · NO MEASURED VALUE CLAIM · NO RENEWAL EVIDENCE','Никакой delivery или measurement state здесь не представлен.','не заменяют measured value']) if (!strip(ru).includes(phrase)) failures.push(`RU missing: ${phrase}`);
if (data.schema !== 'bitevo.audit-measured-value-gate/v1' || data.state !== 'PUBLIC_AUDIT_MEASURED_VALUE_READINESS_TEMPLATE_NOT_CUSTOMER_STATE' || data.customer_state !== 'NOT_REPRESENTED') failures.push('schema/state/customer-state drift');
for (const [key,value] of Object.entries(data.claims||{})) if (value !== false) failures.push(`claim ${key} must remain false`);
if (Object.keys(data.claims||{}).length !== 10) failures.push('claim count drift');
for (const key of ['delivery_started','delivery_completed','measurement_window_closed','measured_value_observed','customer_case_evidence','renewal_expansion_evidence']) if (data.claims?.[key] !== false) failures.push(`required false claim drift ${key}`);
const expectedOffers = [['entry-audit','Entry Audit',1500],['security-control-validation','Security Control Validation',1500],['primary-agent-authority-audit','Primary Agent Authority & Evidence Audit',4900]];
if (data.offer_query_allowlist?.length !== expectedOffers.length) failures.push('offer allowlist length drift');
for (const [key,name,price] of expectedOffers) { const offer=data.offer_query_allowlist?.find(x=>x.key===key); if(!offer||offer.name!==name||offer.price_usd!==price) failures.push(`offer allowlist drift ${key}`); if(!strip(en).includes(key)||!strip(ru).includes(key)) failures.push(`rendered offer key missing ${key}`); }
if (!Array.isArray(data.required_measurement_evidence) || data.required_measurement_evidence.length !== 8 || data.required_measurement_evidence.some(x => x.status !== 'REQUIRES_EXTERNAL_EVIDENCE')) failures.push('measurement evidence gate drift');
if (data.claim_boundary?.synthetic_example_is_customer_evidence !== false || data.claim_boundary?.build_receipt_is_measured_value !== false || data.claim_boundary?.delivery_is_measured_value !== false || data.claim_boundary?.public_site_may_publish_roi_without_external_evidence !== false || data.claim_boundary?.customer_result_claim !== 'NOT_AVAILABLE_FROM_PUBLIC_TEMPLATE' || data.claim_boundary?.roi_claim !== 'NOT_AVAILABLE_FROM_PUBLIC_TEMPLATE') failures.push('claim boundary drift');
if (data.payment_boundary?.public_site_accepts_payment !== false || data.payment_boundary?.receiving_rail_claim !== 'NOT_PUBLISHED' || data.payment_boundary?.invoice_or_payment_request !== 'NOT_ISSUED_BY_THIS_TEMPLATE' || data.payment_boundary?.payment_confirmation !== 'NOT_AVAILABLE_FROM_PUBLIC_SITE') failures.push('payment boundary drift');
if (data.effect_boundary?.network_write !== 0 || data.effect_boundary?.storage_write !== 0 || data.effect_boundary?.external_effect !== 0 || data.effect_boundary?.delivery_start !== 0 || data.effect_boundary?.measurement_claim_publish !== 0) failures.push('effect boundary drift');
for (const key of expectedOffers.map(x=>x[0])) { if(!hasHref(enPaid,`/audit/measured-value-gate?offer=${key}`)) failures.push(`EN paid-start measurement link missing ${key}`); if(!hasHref(ruPaid,`/ru/audit/measured-value-gate?offer=${key}`)) failures.push(`RU paid-start measurement link missing ${key}`); }
if (failures.length) { console.error('AUDIT_MEASURED_VALUE_GATE=FAIL'); failures.forEach(x=>console.error(x)); process.exit(1); }
console.log('AUDIT_MEASURED_VALUE_GATE=PASS checks=43 customer_state=NOT_REPRESENTED claims_false=10 offer_allowlist=3 measurement_evidence=8 delivery_started_claim=0 delivery_completed_claim=0 measurement_window_closed_claim=0 measured_value_claim=0 customer_case_claim=0 renewal_claim=0 roi_claim=0 network_write=0 storage_write=0 locales=2 failures=0');
