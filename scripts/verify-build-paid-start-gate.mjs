import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const failures = [];
const read = route => readFile(`${dist}${route}/index.html`, 'utf8');
const strip = text => text.replace(/<[^>]*>/g,' ').replace(/&[a-z0-9#]+;/gi,' ').replace(/\s+/g,' ').trim();
const hasAnchor = (html,href,label) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].some(m => (m[1]||'').match(/\bhref=["']([^"']+)["']/i)?.[1]===href && strip(m[2]||'').includes(label));

const en = await read('/build/paid-start-gate');
const ru = await read('/ru/build/paid-start-gate');
const data = JSON.parse(await readFile(`${dist}/build/paid-start-gate.json`,'utf8'));
for (const phrase of ['A proposal is not a paid start.','NO PAYMENT PROCESSING · NO INVOICE · NO CHECKOUT · NO SIGNATURE · NO BOOKING · NO DELIVERY START · NO TESTING AUTHORIZATION','This page cannot prove payment.','Delivery remains unstarted by default.']) if (!strip(en).includes(phrase)) failures.push(`EN missing: ${phrase}`);
for (const phrase of ['Proposal ещё не является paid start.','NO PAYMENT PROCESSING · NO INVOICE · NO CHECKOUT · NO SIGNATURE · NO BOOKING · NO DELIVERY START · NO TESTING AUTHORIZATION','Эта страница не может доказать payment.','Delivery по умолчанию остаётся unstarted.']) if (!strip(ru).includes(phrase)) failures.push(`RU missing: ${phrase}`);
if (data.schema !== 'bitevo.build-paid-start-gate/v1' || data.state !== 'PUBLIC_PAID_START_GATE_TEMPLATE_NOT_CUSTOMER_STATE' || data.customer_state !== 'NOT_REPRESENTED') failures.push('schema/state/customer-state drift');
for (const [key,value] of Object.entries(data.claims||{})) if (value !== false) failures.push(`claim ${key} must remain false`);
if (Object.keys(data.claims||{}).length !== 10) failures.push('claim count drift');
if (data.offer?.price_usd !== 3000 || data.offer?.timebox_business_days !== 5 || data.offer?.scope_object !== 'one recurring exception workflow') failures.push('fixed offer facts drifted');
if (!Array.isArray(data.required_external_evidence) || data.required_external_evidence.length !== 7 || data.required_external_evidence.some(x => x.status !== 'REQUIRES_EXTERNAL_EVIDENCE')) failures.push('external evidence gate drifted');
if (data.payment_boundary?.public_site_accepts_payment !== false || data.payment_boundary?.receiving_rail_claim !== 'NOT_PUBLISHED' || data.payment_boundary?.payment_confirmation !== 'NOT_AVAILABLE_FROM_PUBLIC_SITE') failures.push('payment boundary drifted');
if (data.effect_boundary?.network_write !== 0 || data.effect_boundary?.storage_write !== 0 || data.effect_boundary?.external_effect !== 0 || data.effect_boundary?.delivery_start !== 0) failures.push('effect boundary drifted');
if (!hasAnchor(en,'/build/proposal-readiness','Back to proposal readiness') || !hasAnchor(ru,'/ru/build/proposal-readiness','Вернуться к proposal readiness')) failures.push('proposal backlinks missing');
if (failures.length) { console.error('BUILD_PAID_START_GATE=FAIL'); failures.forEach(x=>console.error(x)); process.exit(1); }
console.log('BUILD_PAID_START_GATE=PASS checks=32 customer_state=NOT_REPRESENTED claims_false=10 external_evidence=7 payment_received_claim=0 delivery_started_claim=0 measured_value_claim=0 renewal_claim=0 network_write=0 storage_write=0 locales=2 failures=0');
