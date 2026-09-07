import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const failures = [];
const read = route => readFile(`${dist}${route}/index.html`, 'utf8');
const strip = text => text.replace(/<[^>]*>/g,' ').replace(/&[a-z0-9#]+;/gi,' ').replace(/\s+/g,' ').trim();
const hasAnchor = (html,href,label) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].some(m => (m[1]||'').match(/\bhref=["']([^"']+)["']/i)?.[1]===href && strip(m[2]||'').includes(label));

const en = await read('/build/proposal-readiness');
const ru = await read('/ru/build/proposal-readiness');
const data = JSON.parse(await readFile(`${dist}/build/proposal-readiness.json`,'utf8'));

for (const phrase of ['A scope brief is not yet a proposal.','TEMPLATE ONLY · NO CONTRACT · NO INVOICE · NO CHECKOUT · NO TESTING AUTHORIZATION','No payment rail is claimed by this page.']) if (!strip(en).includes(phrase)) failures.push(`EN missing: ${phrase}`);
for (const phrase of ['Scope brief ещё не является proposal.','TEMPLATE ONLY · NO CONTRACT · NO INVOICE · NO CHECKOUT · NO TESTING AUTHORIZATION','Эта страница не заявляет payment rail.']) if (!strip(ru).includes(phrase)) failures.push(`RU missing: ${phrase}`);
if (data.schema !== 'bitevo.build-proposal-readiness/v1') failures.push('schema drift');
if (data.state !== 'PUBLIC_PROPOSAL_READINESS_TEMPLATE') failures.push('state drift');
for (const key of ['actual_proposal_issued','contract_formed','invoice_issued','payment_link_published','checkout_enabled','signature_capture_enabled','booking_enabled','testing_authorization']) if (data[key] !== false) failures.push(`${key} must remain false`);
if (data.offer?.price_usd !== 3000 || data.offer?.timebox_business_days !== 5 || data.offer?.scope_object !== 'one recurring exception workflow') failures.push('fixed offer facts drifted');
if (!Array.isArray(data.required_written_confirmation) || data.required_written_confirmation.length !== 8) failures.push('required written confirmation count drifted');
if (data.payment_boundary?.public_site_accepts_payment !== false || data.payment_boundary?.receiving_rail_claim !== 'NOT_PUBLISHED' || data.payment_boundary?.instructions !== 'TO_BE_AGREED_THROUGH_DIRECT_BUSINESS_CHANNEL') failures.push('payment boundary drifted');
if (data.effect_boundary?.network_write !== 0 || data.effect_boundary?.storage_write !== 0 || data.effect_boundary?.external_effect !== 0) failures.push('effect boundary drifted');
if (!hasAnchor(en,'/audit-intake','Prepare the scope brief') || !hasAnchor(en,'/build/exception-workflow-diagnostic','Back to BUILD diagnostic')) failures.push('EN proposal readiness backlinks missing');
if (!hasAnchor(ru,'/ru/audit-intake','Подготовить scope brief') || !hasAnchor(ru,'/ru/build/exception-workflow-diagnostic','Вернуться к BUILD diagnostic')) failures.push('RU proposal readiness backlinks missing');
if (failures.length) { console.error('BUILD_PROPOSAL_READINESS_GATE=FAIL'); failures.forEach(x=>console.error(x)); process.exit(1); }
console.log('BUILD_PROPOSAL_READINESS_GATE=PASS checks=27 proposal_issued=0 contract_formed=0 invoice=0 payment_link=0 checkout=0 signature=0 booking=0 testing_authorization=0 network_write=0 storage_write=0 locales=2 failures=0');
