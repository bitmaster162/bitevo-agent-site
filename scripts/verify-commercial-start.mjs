import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const failures = [];

async function readRoute(route) {
  const file = route === '/' ? `${dist}/index.html` : `${dist}${route}/index.html`;
  try {
    return await readFile(file, 'utf8');
  } catch {
    failures.push(`${route}: built route missing`);
    return '';
  }
}

function stripTags(text) {
  return text.replace(/<[^>]*>/g, ' ').replace(/&[a-z0-9#]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function hasAnchor(html, href, textFragment) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].some(match => {
    const attrs = match[1] || '';
    const hrefValue = attrs.match(/\bhref=["']([^"']+)["']/i)?.[1];
    return hrefValue === href && stripTags(match[2] || '').includes(textFragment);
  });
}

const start = await readRoute('/start');
const ruStart = await readRoute('/ru/start');
const buildIndex = await readRoute('/build');
const ruBuildIndex = await readRoute('/ru/build');
const pricing = await readRoute('/pricing');
const ruPricing = await readRoute('/ru/pricing');
const consulting = await readRoute('/consulting');
const ruConsulting = await readRoute('/ru/consulting');
const assurance = await readRoute('/assurance');
const buildDiagnostic = await readRoute('/build/exception-workflow-diagnostic');
const hrDiagnostic = await readRoute('/build/hr-workflow-diagnostic');
const valueExample = await readRoute('/build/workflow-value-example');
const baselineWorksheet = await readRoute('/build/workflow-baseline-worksheet');
const proposalReadiness = await readRoute('/build/proposal-readiness');
const paidStartGate = await readRoute('/build/paid-start-gate');
const auditIntake = await readRoute('/audit-intake');
const ruAuditIntake = await readRoute('/ru/audit-intake');
const auditProposalReadiness = await readRoute('/audit/proposal-readiness');
const ruAuditProposalReadiness = await readRoute('/ru/audit/proposal-readiness');
const auditPaidStartGate = await readRoute('/audit/paid-start-gate');
const ruAuditPaidStartGate = await readRoute('/ru/audit/paid-start-gate');
const auditMeasuredValueGate = await readRoute('/audit/measured-value-gate');
const ruAuditMeasuredValueGate = await readRoute('/ru/audit/measured-value-gate');
const auditRenewalExpansionGate = await readRoute('/audit/renewal-expansion-gate');
const ruAuditRenewalExpansionGate = await readRoute('/ru/audit/renewal-expansion-gate');
const proof = await readRoute('/proof');
const valueExampleJson = JSON.parse(await readFile(`${dist}/build/workflow-value-example.json`, 'utf8'));
const auditProposalJson = JSON.parse(await readFile(`${dist}/audit/proposal-readiness.json`, 'utf8'));
const auditPaidStartJson = JSON.parse(await readFile(`${dist}/audit/paid-start-gate.json`, 'utf8'));
const auditMeasuredValueJson = JSON.parse(await readFile(`${dist}/audit/measured-value-gate.json`, 'utf8'));
const auditRenewalExpansionJson = JSON.parse(await readFile(`${dist}/audit/renewal-expansion-gate.json`, 'utf8'));
const llms = await readFile(`${dist}/llms.txt`, 'utf8');

const startContracts = [
  ['$1,500 Entry Audit', '/entry-audit', 'Open Entry Audit'],
  ['$1,500 Security Control Validation', '/control-validation', 'Open Security Control Validation'],
  ['MCP / Tool Governance', '/mcp-governance', 'Open MCP Governance'],
  ['$3,000 BUILD Workflow Exception Diagnostic', '/build/exception-workflow-diagnostic', 'Open BUILD Diagnostic'],
  ['$4,900 Primary Audit', '/agent-authority-audit', 'Open Primary Audit']
];

for (const [requiredText, href, cta] of startContracts) {
  if (!stripTags(start).includes(requiredText)) failures.push(`/start: missing commercial path text "${requiredText}"`);
  if (!hasAnchor(start, href, cta)) failures.push(`/start: missing CTA "${cta}" -> ${href}`);
}

const llmsCommercialContracts = [
  ['USD 1,500 Entry Audit', '/entry-audit'],
  ['USD 1,500 Security Control Validation', '/control-validation'],
  ['USD 3,000 BUILD Workflow Exception Diagnostic', '/build/exception-workflow-diagnostic'],
  ['USD 4,900 Primary Audit', '/agent-authority-audit']
];
for (const [offer, route] of llmsCommercialContracts) {
  if (!llms.includes(offer)) failures.push(`llms.txt: missing SELL_NOW offer "${offer}"`);
  if (!llms.includes(route)) failures.push(`llms.txt: missing SELL_NOW route "${route}"`);
}

const startBuildPrep = [
  ['/build/workflow-baseline-worksheet', 'Prepare baseline locally'],
  ['/build/workflow-value-example', 'Inspect synthetic measurement proof'],
  ['/build/proposal-readiness', 'Check proposal readiness']
];
for (const [href, cta] of startBuildPrep) {
  if (!hasAnchor(start, href, cta)) failures.push(`/start: missing BUILD prep CTA "${cta}" -> ${href}`);
}
const ruStartText = stripTags(ruStart);
for (const phrase of ['$1,500 Security Control Validation', 'MCP / Tool Governance', '$3,000 BUILD Workflow Exception Diagnostic', '$4,900 Primary Audit']) {
  if (!ruStartText.includes(phrase)) failures.push(`/ru/start: stale commercial routing; missing "${phrase}"`);
}

const buildBuyerPrep = [
  ['/build/exception-workflow-diagnostic', 'Choose diagnostic scope'],
  ['/build/workflow-baseline-worksheet', 'Freeze buyer-confirmed baseline locally'],
  ['/build/workflow-value-example', 'Inspect synthetic measurement proof'],
  ['/audit-intake', 'Prepare the scope brief'],
  ['/build/proposal-readiness', 'Check proposal readiness'],
  ['/build/paid-start-gate', 'Hold at the paid-start gate']
];
for (const [href, label] of buildBuyerPrep) {
  if (!hasAnchor(buildIndex, href, label)) failures.push(`/build: missing buyer-prep step "${label}" -> ${href}`);
}
const ruBuildBuyerPrep = [
  ['/ru/build/exception-workflow-diagnostic', 'Открыть диагностику'],
  ['/ru/build/workflow-baseline-worksheet', 'Зафиксировать baseline'],
  ['/ru/build/workflow-value-example', 'Проверить synthetic метод'],
  ['/ru/audit-intake', 'Подготовить scope brief'],
  ['/ru/build/proposal-readiness', 'Проверить proposal readiness'],
  ['/ru/build/paid-start-gate', 'Проверить paid-start gate']
];
for (const [href, label] of ruBuildBuyerPrep) {
  if (!hasAnchor(ruBuildIndex, href, label)) failures.push(`/ru/build: missing buyer-prep step "${label}" -> ${href}`);
}

const startBoundaryPhrases = [
  'Start from the decision, not the service catalogue.',
  'This page does not create new flagship service SKUs.',
  'The public site does not authorize testing.',
  'Do not submit credentials, private keys, wallet seeds, production secrets or customer secrets.'
];
for (const phrase of startBoundaryPhrases) {
  if (!stripTags(start).includes(phrase)) failures.push(`/start: missing boundary phrase "${phrase}"`);
}

const buildDiagnosticText = stripTags(buildDiagnostic);
for (const phrase of ['One exception. One owner. One measurable result.', 'Method evidence is not a customer outcome.', 'five-day diagnostic is USD 3,000']) {
  if (!buildDiagnosticText.includes(phrase)) failures.push(`/build/exception-workflow-diagnostic: missing R14 generic diagnostic phrase "${phrase}"`);
}
if (!hasAnchor(buildDiagnostic, '/build/hr-workflow-diagnostic', 'Open HR / workforce specialization')) failures.push('/build/exception-workflow-diagnostic: missing HR specialization link');
for (const stale of ['Thailand/SEA HR Workflow Diagnostic', 'Bring one exception workflow, not your whole HR stack.']) {
  if (buildDiagnosticText.includes(stale)) failures.push(`/build/exception-workflow-diagnostic: stale HR-only framing survived: "${stale}"`);
}
const hrDiagnosticText = stripTags(hrDiagnostic);
for (const phrase of ['Thailand/SEA HR Workflow Diagnostic', 'Make one recurring HR exception reviewable in five business days.']) {
  if (!hrDiagnosticText.includes(phrase)) failures.push(`/build/hr-workflow-diagnostic: missing retained HR specialization phrase "${phrase}"`);
}
if (!hasAnchor(hrDiagnostic, '/build/exception-workflow-diagnostic', 'Open the general diagnostic')) failures.push('/build/hr-workflow-diagnostic: missing general diagnostic backlink');
if (!hasAnchor(buildDiagnostic, '/build/workflow-value-example', 'Open synthetic measurement example')) failures.push('/build/exception-workflow-diagnostic: missing BUILD measurement proof link');
if (!hasAnchor(buildDiagnostic, '/build/workflow-baseline-worksheet', 'Prepare your baseline locally')) failures.push('/build/exception-workflow-diagnostic: missing local baseline worksheet link');
if (!hasAnchor(valueExample, '/build/workflow-baseline-worksheet', 'Prepare your baseline locally')) failures.push('/build/workflow-value-example: missing local baseline worksheet link');
if (!hasAnchor(proof, '/build/workflow-value-example', 'Open BUILD measurement example')) failures.push('/proof: missing BUILD measurement proof link');
const valueExampleText = stripTags(valueExample);
for (const phrase of ['SYNTHETIC / NOT CUSTOMER / NOT OBSERVED', 'This is arithmetic, not ROI.', '20.4 hours and $612 are synthetic arithmetic outputs.', 'cannot substitute for payment, delivery or measured value evidence']) {
  if (!valueExampleText.includes(phrase)) failures.push(`/build/workflow-value-example: missing evidence boundary phrase "${phrase}"`);
}
if (valueExampleJson.synthetic !== true || valueExampleJson.customer_case !== false || valueExampleJson.observed_outcome !== false || valueExampleJson.roi_claim !== false) failures.push('/build/workflow-value-example.json: provenance flags drifted');
const b = valueExampleJson.baseline;
const c = valueExampleJson.illustrative_comparison_state;
const calc = {
  baseline_first_pass_hours: b.cases_per_period * b.first_pass_minutes_per_case / 60,
  baseline_repeat_touch_hours: b.cases_per_period * b.repeat_touch_rate * b.repeat_touch_minutes / 60,
  comparison_first_pass_hours: c.cases_per_period * c.first_pass_minutes_per_case / 60,
  comparison_repeat_touch_hours: c.cases_per_period * c.repeat_touch_rate * c.repeat_touch_minutes / 60
};
calc.baseline_total_hours = calc.baseline_first_pass_hours + calc.baseline_repeat_touch_hours;
calc.comparison_total_hours = calc.comparison_first_pass_hours + calc.comparison_repeat_touch_hours;
calc.illustrative_delta_hours = calc.baseline_total_hours - calc.comparison_total_hours;
calc.baseline_labor_cost_usd = calc.baseline_total_hours * b.loaded_labor_usd_per_hour;
calc.comparison_labor_cost_usd = calc.comparison_total_hours * c.loaded_labor_usd_per_hour;
calc.illustrative_delta_cost_usd = calc.baseline_labor_cost_usd - calc.comparison_labor_cost_usd;
for (const [key, value] of Object.entries(calc)) {
  if (Math.abs(Number(valueExampleJson.computed[key]) - value) > 1e-9) failures.push(`/build/workflow-value-example.json: arithmetic drift ${key}`);
}

const baselineWorksheetText = stripTags(baselineWorksheet);
for (const phrase of ['Freeze one exception-workflow baseline before discussing value.', 'LOCAL ONLY · NO NETWORK WRITE · NO STORAGE WRITE', 'Testing authorization: NOT GRANTED.']) {
  if (!baselineWorksheetText.includes(phrase)) failures.push(`/build/workflow-baseline-worksheet: missing boundary phrase \"${phrase}\"`);
}
if (!hasAnchor(baselineWorksheet, '/build/exception-workflow-diagnostic', 'Back to BUILD diagnostic')) failures.push('/build/workflow-baseline-worksheet: missing diagnostic backlink');
if (!hasAnchor(buildDiagnostic, '/build/proposal-readiness', 'Check proposal readiness')) failures.push('/build/exception-workflow-diagnostic: missing proposal readiness link');
const proposalReadinessText = stripTags(proposalReadiness);
for (const phrase of ['A scope brief is not yet a proposal.', 'TEMPLATE ONLY · NO CONTRACT · NO INVOICE · NO CHECKOUT · NO TESTING AUTHORIZATION', 'No payment rail is claimed by this page.']) {
  if (!proposalReadinessText.includes(phrase)) failures.push(`/build/proposal-readiness: missing boundary phrase \"${phrase}\"`);
}
if (!hasAnchor(proposalReadiness, '/build/paid-start-gate', 'Check paid-start gate')) failures.push('/build/proposal-readiness: missing paid-start gate link');
const paidStartText = stripTags(paidStartGate);
for (const phrase of ['A proposal is not a paid start.', 'This page cannot prove payment.', 'Delivery remains unstarted by default.']) {
  if (!paidStartText.includes(phrase)) failures.push(`/build/paid-start-gate: missing boundary phrase \"${phrase}\"`);
}

const auditProposalText = stripTags(auditProposalReadiness);
const ruAuditProposalText = stripTags(ruAuditProposalReadiness);
for (const phrase of ['A scope brief is not yet a proposal.', 'TEMPLATE ONLY · NO PROPOSAL ISSUED · NO CONTRACT · NO INVOICE · NO PAYMENT RAIL · NO CHECKOUT · NO TESTING AUTHORIZATION', 'No payment rail is published by this page.', 'actual_proposal_issued=false']) {
  if (!auditProposalText.includes(phrase)) failures.push(`/audit/proposal-readiness: missing boundary phrase "${phrase}"`);
}
for (const phrase of ['Scope brief ещё не является proposal.', 'TEMPLATE ONLY · NO PROPOSAL ISSUED · NO CONTRACT · NO INVOICE · NO PAYMENT RAIL · NO CHECKOUT · NO TESTING AUTHORIZATION', 'actual_proposal_issued=false']) {
  if (!ruAuditProposalText.includes(phrase)) failures.push(`/ru/audit/proposal-readiness: missing boundary phrase "${phrase}"`);
}
const expectedAuditOffers = [
  ['entry-audit','Entry Audit',1500],
  ['security-control-validation','Security Control Validation',1500],
  ['primary-agent-authority-audit','Primary Agent Authority & Evidence Audit',4900]
];
if (auditProposalJson.schema !== 'bitevo.audit-proposal-readiness/v1' || auditProposalJson.state !== 'PUBLIC_AUDIT_PROPOSAL_READINESS_TEMPLATE_NOT_CUSTOMER_STATE' || auditProposalJson.customer_state !== 'NOT_REPRESENTED') failures.push('/audit/proposal-readiness.json: schema/state/customer-state drift');
for (const key of ['actual_proposal_issued','proposal_accepted','contract_formed','invoice_issued','payment_link_published','checkout_enabled','signature_capture_enabled','booking_enabled','testing_authorization']) if (auditProposalJson[key] !== false) failures.push(`/audit/proposal-readiness.json: ${key} must remain false`);
if (auditProposalJson.payment_boundary?.public_site_accepts_payment !== false || auditProposalJson.payment_boundary?.receiving_rail_claim !== 'NOT_PUBLISHED' || auditProposalJson.payment_boundary?.instructions !== 'TO_BE_AGREED_THROUGH_DIRECT_BUSINESS_CHANNEL' || auditProposalJson.payment_boundary?.payment_confirmation !== 'NOT_AVAILABLE_FROM_PUBLIC_SITE') failures.push('/audit/proposal-readiness.json: payment boundary drifted');
if (auditProposalJson.effect_boundary?.network_write !== 0 || auditProposalJson.effect_boundary?.storage_write !== 0 || auditProposalJson.effect_boundary?.external_effect !== 0) failures.push('/audit/proposal-readiness.json: public effect boundary drifted');
if (auditProposalJson.offer_query_allowlist?.length !== expectedAuditOffers.length) failures.push('/audit/proposal-readiness.json: offer allowlist length drifted');
for (const [key,name,price] of expectedAuditOffers) {
  const offer = auditProposalJson.offer_query_allowlist?.find(item => item.key === key);
  if (!offer || offer.name !== name || offer.price_usd !== price) failures.push(`/audit/proposal-readiness.json: offer allowlist drift ${key}`);
  if (!auditProposalText.includes(key) || !ruAuditProposalText.includes(key)) failures.push(`/audit/proposal-readiness: rendered offer key missing ${key}`);
}
if (!hasAnchor(auditIntake, '/audit/proposal-readiness', 'Check proposal readiness')) failures.push('/audit-intake: missing generic proposal-readiness handoff');
if (!hasAnchor(ruAuditIntake, '/ru/audit/proposal-readiness', 'proposal readiness')) failures.push('/ru/audit-intake: missing generic proposal-readiness handoff');
for (const [href,label] of [
  ['/audit-intake?offer=entry-audit','Prepare Entry scope'],
  ['/audit-intake?offer=security-control-validation','Prepare Security Control scope'],
  ['/audit-intake?offer=primary-agent-authority-audit','Prepare Primary scope']
]) if (!hasAnchor(auditProposalReadiness, href, label)) failures.push(`/audit/proposal-readiness: missing scoped backlink ${href}`);
for (const [href,label] of [
  ['/ru/audit-intake?offer=entry-audit','Entry scope'],
  ['/ru/audit-intake?offer=security-control-validation','Security Control scope'],
  ['/ru/audit-intake?offer=primary-agent-authority-audit','Primary scope']
]) if (!hasAnchor(ruAuditProposalReadiness, href, label)) failures.push(`/ru/audit/proposal-readiness: missing scoped backlink ${href}`);

const auditPaidStartText = stripTags(auditPaidStartGate);
const ruAuditPaidStartText = stripTags(ruAuditPaidStartGate);
for (const phrase of ['A proposal is not a paid start.', 'This page cannot prove payment.', 'Delivery remains unstarted by default.']) if (!auditPaidStartText.includes(phrase)) failures.push(`/audit/paid-start-gate: missing boundary phrase "${phrase}"`);
for (const phrase of ['Proposal ещё не является paid start.', 'Эта страница не может доказать payment.', 'Delivery по умолчанию остаётся unstarted.']) if (!ruAuditPaidStartText.includes(phrase)) failures.push(`/ru/audit/paid-start-gate: missing boundary phrase "${phrase}"`);
if (auditPaidStartJson.schema !== 'bitevo.audit-paid-start-gate/v1' || auditPaidStartJson.state !== 'PUBLIC_AUDIT_PAID_START_GATE_TEMPLATE_NOT_CUSTOMER_STATE' || auditPaidStartJson.customer_state !== 'NOT_REPRESENTED') failures.push('/audit/paid-start-gate.json: schema/state/customer-state drift');
for (const key of ['proposal_issued','proposal_accepted','contract_formed','invoice_issued','payment_received','payment_verified','delivery_started','measured_value_observed','renewal_expansion_evidence','testing_authorization']) if (auditPaidStartJson.claims?.[key] !== false) failures.push(`/audit/paid-start-gate.json: ${key} must remain false`);
if (auditPaidStartJson.required_external_evidence?.length !== 7 || auditPaidStartJson.required_external_evidence?.some(item => item.status !== 'REQUIRES_EXTERNAL_EVIDENCE')) failures.push('/audit/paid-start-gate.json: external evidence gate drifted');
if (auditPaidStartJson.payment_boundary?.public_site_accepts_payment !== false || auditPaidStartJson.payment_boundary?.receiving_rail_claim !== 'NOT_PUBLISHED' || auditPaidStartJson.payment_boundary?.checkout_enabled !== false || auditPaidStartJson.payment_boundary?.payment_confirmation !== 'NOT_AVAILABLE_FROM_PUBLIC_SITE') failures.push('/audit/paid-start-gate.json: payment boundary drifted');
if (auditPaidStartJson.effect_boundary?.network_write !== 0 || auditPaidStartJson.effect_boundary?.storage_write !== 0 || auditPaidStartJson.effect_boundary?.external_effect !== 0 || auditPaidStartJson.effect_boundary?.delivery_start !== 0) failures.push('/audit/paid-start-gate.json: effect boundary drifted');
if (auditPaidStartJson.offer_query_allowlist?.length !== expectedAuditOffers.length) failures.push('/audit/paid-start-gate.json: offer allowlist length drifted');
for (const [key,name,price] of expectedAuditOffers) {
  const offer = auditPaidStartJson.offer_query_allowlist?.find(item => item.key === key);
  if (!offer || offer.name !== name || offer.price_usd !== price) failures.push(`/audit/paid-start-gate.json: offer allowlist drift ${key}`);
}
for (const [href,label] of [['/audit/paid-start-gate?offer=entry-audit','Entry paid-start gate'],['/audit/paid-start-gate?offer=security-control-validation','Security Control paid-start gate'],['/audit/paid-start-gate?offer=primary-agent-authority-audit','Primary paid-start gate']]) if (!hasAnchor(auditProposalReadiness,href,label)) failures.push(`/audit/proposal-readiness: missing paid-start link ${href}`);
for (const [href,label] of [['/ru/audit/paid-start-gate?offer=entry-audit','Entry paid-start gate'],['/ru/audit/paid-start-gate?offer=security-control-validation','Security Control paid-start gate'],['/ru/audit/paid-start-gate?offer=primary-agent-authority-audit','Primary paid-start gate']]) if (!hasAnchor(ruAuditProposalReadiness,href,label)) failures.push(`/ru/audit/proposal-readiness: missing paid-start link ${href}`);

const auditMeasuredValueText = stripTags(auditMeasuredValueGate);
const ruAuditMeasuredValueText = stripTags(ruAuditMeasuredValueGate);
for (const phrase of ['Delivery is not measured value.', 'No delivery or measurement state is represented.', 'cannot substitute for measured value']) if (!auditMeasuredValueText.includes(phrase)) failures.push(`/audit/measured-value-gate: missing boundary phrase "${phrase}"`);
for (const phrase of ['Delivery ещё не является measured value.', 'Никакой delivery или measurement state здесь не представлен.', 'не заменяют measured value']) if (!ruAuditMeasuredValueText.includes(phrase)) failures.push(`/ru/audit/measured-value-gate: missing boundary phrase "${phrase}"`);
if (auditMeasuredValueJson.schema !== 'bitevo.audit-measured-value-gate/v1' || auditMeasuredValueJson.state !== 'PUBLIC_AUDIT_MEASURED_VALUE_READINESS_TEMPLATE_NOT_CUSTOMER_STATE' || auditMeasuredValueJson.customer_state !== 'NOT_REPRESENTED') failures.push('/audit/measured-value-gate.json: schema/state/customer-state drift');
for (const key of ['payment_received','payment_verified','delivery_started','delivery_completed','measurement_window_closed','measured_value_observed','customer_case_evidence','renewal_expansion_evidence','roi_claim_published','customer_result_claim_published']) if (auditMeasuredValueJson.claims?.[key] !== false) failures.push(`/audit/measured-value-gate.json: ${key} must remain false`);
if (auditMeasuredValueJson.required_measurement_evidence?.length !== 8 || auditMeasuredValueJson.required_measurement_evidence?.some(item => item.status !== 'REQUIRES_EXTERNAL_EVIDENCE')) failures.push('/audit/measured-value-gate.json: measurement evidence gate drifted');
if (auditMeasuredValueJson.claim_boundary?.synthetic_example_is_customer_evidence !== false || auditMeasuredValueJson.claim_boundary?.build_receipt_is_measured_value !== false || auditMeasuredValueJson.claim_boundary?.delivery_is_measured_value !== false || auditMeasuredValueJson.claim_boundary?.public_site_may_publish_roi_without_external_evidence !== false || auditMeasuredValueJson.claim_boundary?.customer_result_claim !== 'NOT_AVAILABLE_FROM_PUBLIC_TEMPLATE' || auditMeasuredValueJson.claim_boundary?.roi_claim !== 'NOT_AVAILABLE_FROM_PUBLIC_TEMPLATE') failures.push('/audit/measured-value-gate.json: claim boundary drifted');
if (auditMeasuredValueJson.payment_boundary?.public_site_accepts_payment !== false || auditMeasuredValueJson.payment_boundary?.receiving_rail_claim !== 'NOT_PUBLISHED') failures.push('/audit/measured-value-gate.json: payment boundary drifted');
if (auditMeasuredValueJson.effect_boundary?.network_write !== 0 || auditMeasuredValueJson.effect_boundary?.storage_write !== 0 || auditMeasuredValueJson.effect_boundary?.external_effect !== 0 || auditMeasuredValueJson.effect_boundary?.delivery_start !== 0 || auditMeasuredValueJson.effect_boundary?.measurement_claim_publish !== 0) failures.push('/audit/measured-value-gate.json: effect boundary drifted');
if (auditMeasuredValueJson.offer_query_allowlist?.length !== expectedAuditOffers.length) failures.push('/audit/measured-value-gate.json: offer allowlist length drifted');
for (const [key,name,price] of expectedAuditOffers) { const offer=auditMeasuredValueJson.offer_query_allowlist?.find(item=>item.key===key); if(!offer||offer.name!==name||offer.price_usd!==price) failures.push(`/audit/measured-value-gate.json: offer allowlist drift ${key}`); }
for (const key of expectedAuditOffers.map(item=>item[0])) {
  if (!auditPaidStartGate.includes(`/audit/measured-value-gate?offer=${key}`)) failures.push(`/audit/paid-start-gate: missing measurement link ${key}`);
  if (!ruAuditPaidStartGate.includes(`/ru/audit/measured-value-gate?offer=${key}`)) failures.push(`/ru/audit/paid-start-gate: missing measurement link ${key}`);
}

const auditRenewalExpansionText = stripTags(auditRenewalExpansionGate);
const ruAuditRenewalExpansionText = stripTags(ruAuditRenewalExpansionGate);
for (const phrase of ['Measured value is not renewal.', 'No renewal or expansion state is represented.', 'Measured value cannot substitute for a buyer renewal decision.']) if (!auditRenewalExpansionText.includes(phrase)) failures.push(`/audit/renewal-expansion-gate: missing boundary phrase "${phrase}"`);
for (const phrase of ['Measured value ещё не является renewal.', 'Никакой renewal или expansion state здесь не представлен.', 'Measured value не заменяет buyer renewal decision.']) if (!ruAuditRenewalExpansionText.includes(phrase)) failures.push(`/ru/audit/renewal-expansion-gate: missing boundary phrase "${phrase}"`);
if (auditRenewalExpansionJson.schema !== 'bitevo.audit-renewal-expansion-gate/v1' || auditRenewalExpansionJson.state !== 'PUBLIC_AUDIT_RENEWAL_EXPANSION_READINESS_TEMPLATE_NOT_CUSTOMER_STATE' || auditRenewalExpansionJson.customer_state !== 'NOT_REPRESENTED') failures.push('/audit/renewal-expansion-gate.json: schema/state/customer-state drift');
for (const key of ['measured_value_observed','customer_case_evidence','renewal_expansion_evidence','renewal_committed','expansion_committed','retained_revenue_evidence','nrr_evidence','roi_claim_published','customer_result_claim_published']) if (auditRenewalExpansionJson.claims?.[key] !== false) failures.push(`/audit/renewal-expansion-gate.json: ${key} must remain false`);
if (Object.keys(auditRenewalExpansionJson.claims||{}).length !== 12) failures.push('/audit/renewal-expansion-gate.json: claim count drifted');
if (auditRenewalExpansionJson.required_renewal_expansion_evidence?.length !== 8 || auditRenewalExpansionJson.required_renewal_expansion_evidence?.some(item => item.status !== 'REQUIRES_EXTERNAL_EVIDENCE')) failures.push('/audit/renewal-expansion-gate.json: renewal evidence gate drifted');
if (auditRenewalExpansionJson.claim_boundary?.measured_value_is_renewal_evidence !== false || auditRenewalExpansionJson.claim_boundary?.delivery_is_renewal_evidence !== false || auditRenewalExpansionJson.claim_boundary?.synthetic_example_is_renewal_evidence !== false || auditRenewalExpansionJson.claim_boundary?.public_site_may_claim_retained_revenue_without_external_evidence !== false || auditRenewalExpansionJson.claim_boundary?.public_site_may_claim_nrr_without_external_evidence !== false || auditRenewalExpansionJson.claim_boundary?.renewal_claim !== 'NOT_AVAILABLE_FROM_PUBLIC_TEMPLATE' || auditRenewalExpansionJson.claim_boundary?.expansion_claim !== 'NOT_AVAILABLE_FROM_PUBLIC_TEMPLATE' || auditRenewalExpansionJson.claim_boundary?.roi_claim !== 'NOT_AVAILABLE_FROM_PUBLIC_TEMPLATE') failures.push('/audit/renewal-expansion-gate.json: claim boundary drifted');
if (auditRenewalExpansionJson.payment_boundary?.public_site_accepts_payment !== false || auditRenewalExpansionJson.payment_boundary?.receiving_rail_claim !== 'NOT_PUBLISHED' || auditRenewalExpansionJson.payment_boundary?.invoice_or_payment_request !== 'NOT_ISSUED_BY_THIS_TEMPLATE' || auditRenewalExpansionJson.payment_boundary?.payment_confirmation !== 'NOT_AVAILABLE_FROM_PUBLIC_SITE') failures.push('/audit/renewal-expansion-gate.json: payment boundary drifted');
if (auditRenewalExpansionJson.effect_boundary?.network_write !== 0 || auditRenewalExpansionJson.effect_boundary?.storage_write !== 0 || auditRenewalExpansionJson.effect_boundary?.external_effect !== 0 || auditRenewalExpansionJson.effect_boundary?.renewal_commit !== 0 || auditRenewalExpansionJson.effect_boundary?.expansion_commit !== 0 || auditRenewalExpansionJson.effect_boundary?.commercial_claim_publish !== 0) failures.push('/audit/renewal-expansion-gate.json: effect boundary drifted');
if (auditRenewalExpansionJson.offer_query_allowlist?.length !== expectedAuditOffers.length) failures.push('/audit/renewal-expansion-gate.json: offer allowlist length drifted');
for (const [key,name,price] of expectedAuditOffers) { const offer=auditRenewalExpansionJson.offer_query_allowlist?.find(item=>item.key===key); if(!offer||offer.name!==name||offer.price_usd!==price) failures.push(`/audit/renewal-expansion-gate.json: offer allowlist drift ${key}`); }
for (const key of expectedAuditOffers.map(item=>item[0])) {
  if (!auditMeasuredValueGate.includes(`/audit/renewal-expansion-gate?offer=${key}`)) failures.push(`/audit/measured-value-gate: missing renewal/expansion link ${key}`);
  if (!ruAuditMeasuredValueGate.includes(`/ru/audit/renewal-expansion-gate?offer=${key}`)) failures.push(`/ru/audit/measured-value-gate: missing renewal/expansion link ${key}`);
}

const pricingContracts = [
  ['/start', 'Choose the right scope'],
  ['/entry-audit', 'Open Entry Audit'],
  ['/control-validation', 'Open Security Control Validation'],
  ['/build/exception-workflow-diagnostic', 'Open BUILD Workflow Exception Diagnostic'],
  ['/audit-intake?offer=entry-audit', 'Prepare Entry Audit scope'],
  ['/audit-intake?offer=primary-agent-authority-audit', 'Prepare Primary Audit scope'],
  ['/start', 'Choose the smallest scope'],
  ['/mapper', 'Map the action chain'],
  ['mailto:robert@bitevo.work?subject=BitEvo%20scope%20review', 'Contact Robert']
];
for (const [href, cta] of pricingContracts) {
  if (!hasAnchor(pricing, href, cta)) failures.push(`/pricing: missing conversion CTA "${cta}" -> ${href}`);
}
const ruPricingContracts = [
  ['/ru/audit-intake?offer=entry-audit', 'Entry'],
  ['/ru/audit-intake?offer=primary-agent-authority-audit', 'Primary'],
  ['/ru/control-validation', 'Открыть Security Control Validation'],
  ['/ru/build/exception-workflow-diagnostic', 'Открыть BUILD Workflow Exception Diagnostic'],
  ['mailto:robert@bitevo.work?subject=BitEvo%20scope%20review', 'Связаться с Робертом']
];
for (const [href, cta] of ruPricingContracts) {
  if (!hasAnchor(ruPricing, href, cta)) failures.push(`/ru/pricing: missing conversion CTA "${cta}" -> ${href}`);
}

const consultingAuditIntentContracts = [
  ['/audit-intake?offer=entry-audit', 'Prepare Entry Audit scope'],
  ['/audit-intake?offer=primary-agent-authority-audit', 'Prepare Primary Audit scope']
];
for (const [href, cta] of consultingAuditIntentContracts) {
  if (!hasAnchor(consulting, href, cta)) failures.push(`/consulting: missing offer-aware audit CTA "${cta}" -> ${href}`);
}
const ruConsultingAuditIntentContracts = [
  ['/ru/audit-intake?offer=entry-audit', 'Entry'],
  ['/ru/audit-intake?offer=primary-agent-authority-audit', 'Primary']
];
for (const [href, cta] of ruConsultingAuditIntentContracts) {
  if (!hasAnchor(ruConsulting, href, cta)) failures.push(`/ru/consulting: missing offer-aware audit CTA containing "${cta}" -> ${href}`);
}
if (!hasAnchor(assurance, '/audit-intake?offer=security-control-validation', 'Scope one control boundary')) {
  failures.push('/assurance: Security Control scope CTA must preserve offer intent');
}

const consultingSpecialistContracts = [
  ['$1,500', 'Security Control Validation', '/control-validation', 'Open Security Control Validation'],
  ['$3,000', 'BUILD Workflow Exception Diagnostic', '/build/exception-workflow-diagnostic', 'Open BUILD Workflow Exception Diagnostic']
];
for (const [price, offer, href, cta] of consultingSpecialistContracts) {
  const text = stripTags(consulting);
  if (!text.includes(price) || !text.includes(offer)) failures.push(`/consulting: missing specialist offer "${offer}" at ${price}`);
  if (!hasAnchor(consulting, href, cta)) failures.push(`/consulting: missing specialist CTA "${cta}" -> ${href}`);
}
const ruConsultingSpecialistContracts = [
  ['$1,500', 'Security Control Validation', '/ru/control-validation', 'Открыть Security Control Validation'],
  ['$3,000', 'BUILD Workflow Exception Diagnostic', '/ru/build/exception-workflow-diagnostic', 'Открыть BUILD Workflow Exception Diagnostic']
];
for (const [price, offer, href, cta] of ruConsultingSpecialistContracts) {
  const text = stripTags(ruConsulting);
  if (!text.includes(price) || !text.includes(offer)) failures.push(`/ru/consulting: missing specialist offer "${offer}" at ${price}`);
  if (!hasAnchor(ruConsulting, href, cta)) failures.push(`/ru/consulting: missing specialist CTA "${cta}" -> ${href}`);
}

if (pricing.includes('mailto:robert@bitevo.work?subject=BitEvo%20scope%20review&body=') || ruPricing.includes('mailto:robert@bitevo.work?subject=BitEvo%20scope%20review&body=')) {
  failures.push('pricing handoff must never auto-embed page or brief content in mailto body');
}

const pricingText = stripTags(pricing);
for (const required of ['Free', '$1,500', '$4,900', 'Security Control Validation · fixed $1,500', 'BUILD Workflow Exception Diagnostic · $3,000 / 5 business days', 'This page does not book a triage, submit an audit request or authorize testing.']) {
  if (!pricingText.includes(required)) failures.push(`/pricing: missing commercial invariant "${required}"`);
}
const ruPricingText = stripTags(ruPricing);
for (const required of ['Security Control Validation · фиксированные $1,500', 'BUILD Workflow Exception Diagnostic · $3,000 / 5 рабочих дней']) {
  if (!ruPricingText.includes(required)) failures.push(`/ru/pricing: missing commercial invariant "${required}"`);
}

if (failures.length) {
  console.error('COMMERCIAL_START_GATE=FAIL');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log(`COMMERCIAL_START_GATE=PASS start_paths=${startContracts.length} start_build_prep=${startBuildPrep.length} build_buyer_prep=${buildBuyerPrep.length} ru_build_buyer_prep=${ruBuildBuyerPrep.length} pricing_ctas=${pricingContracts.length} ru_pricing_ctas=${ruPricingContracts.length} audit_offer_intent=PASS consulting_specialists=${consultingSpecialistContracts.length} ru_consulting_specialists=${ruConsultingSpecialistContracts.length} boundary_phrases=${startBoundaryPhrases.length} build_generic=PASS hr_specialization=PASS build_value_example=PASS build_baseline_worksheet=PASS build_proposal_readiness=PASS build_paid_start_gate=PASS audit_proposal_readiness=PASS audit_paid_start_gate=PASS audit_measured_value_gate=PASS audit_renewal_expansion_gate=PASS audit_offer_allowlist=3 audit_payment_boundary=PASS audit_delivery_boundary=PASS audit_measurement_boundary=PASS audit_renewal_boundary=PASS ru_start_current=PASS`);
