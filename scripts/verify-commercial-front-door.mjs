import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const read = rel => fs.readFileSync(path.join(distDir, rel), 'utf8');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const home = read('index.html');
const intake = read('audit-intake/index.html');
const start = read('start/index.html');
const ruHome = read('ru/index.html');
const ruStart = read('ru/start/index.html');
const entryAudit = read('entry-audit/index.html');
const controlValidation = read('control-validation/index.html');
const primaryAudit = read('agent-authority-audit/index.html');
const buildDiagnostic = read('build/exception-workflow-diagnostic/index.html');
const ruEntryAudit = read('ru/entry-audit/index.html');
const ruControlValidation = read('ru/control-validation/index.html');
const ruPrimaryAudit = read('ru/agent-authority-audit/index.html');
const ruBuildDiagnostic = read('ru/build/exception-workflow-diagnostic/index.html');

const stripTags = text => text.replace(/<[^>]*>/g, ' ').replace(/&[a-z0-9#]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const hasAnchor = (html, href, textFragment) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].some(match => {
  const hrefValue = (match[1] || '').match(/\bhref=["']([^"']+)["']/i)?.[1];
  return hrefValue === href && stripTags(match[2] || '').includes(textFragment);
});
const genericScopeReviewHref = 'mailto:robert@bitevo.work?subject=BitEvo%20scope%20review';
const entryAuditReviewHref = 'mailto:robert@bitevo.work?subject=BitEvo%20Agent%20Authority%20Entry%20Audit%20scope%20review';
const controlValidationReviewHref = 'mailto:robert@bitevo.work?subject=BitEvo%20Security%20Control%20Validation%20scope%20review';
const primaryAuditReviewHref = 'mailto:robert@bitevo.work?subject=BitEvo%20Primary%20Agent%20Authority%20Audit%20scope%20review';
const buildQualificationHref = 'mailto:robert@bitevo.work?subject=BUILD%20workflow%20diagnostic%20qualification';

check(/<a[^>]*href="\/start"[^>]*data-funnel="home-primary"[^>]*>Choose the right scope/.test(home), 'home primary CTA must route to /start');
check(!/<a[^>]*href="\/mapper"[^>]*data-funnel="home-primary"[^>]*>Map one workflow/.test(home), 'old Mapper home-primary CTA must not survive build output');
check(/<a class="header-cta" href="\/start"[^>]*>Start here/.test(home), 'English header CTA must route to /start');
check(/<a class="mobile-cta" href="\/start"[^>]*>Start here →<\/a>/.test(home), 'English mobile CTA must route to /start');

check(start.includes('$1,500 Entry Audit'), '/start must retain Entry Audit path');
check(start.includes('MCP / Tool Governance'), '/start must retain MCP path');
check(start.includes('$3,000 BUILD Workflow Exception Diagnostic'), '/start must retain BUILD path');
check(start.includes('$4,900 Primary Audit'), '/start must retain Primary Audit path');
check(start.includes('The public site does not authorize testing.'), '/start must retain no-testing boundary');

check(/<a class="button button-ghost" data-scope-handoff href="mailto:robert@bitevo\.work\?subject=BitEvo%20scope%20review">Contact Robert<\/a>/.test(intake), 'audit intake must expose explicit manual human handoff');
check(intake.includes('nothing is sent automatically'), 'audit intake must state that the handoff does not auto-send');
check(intake.includes('Copy or download the reviewed brief first'), 'audit intake must keep review-before-share instruction');
check(intake.includes('Testing authorization: NOT GRANTED by this form.'), 'audit intake must retain explicit authorization boundary');
check(!intake.includes('mailto:robert@bitevo.work?subject=BitEvo%20scope%20review&body='), 'scope brief must not be auto-embedded into mailto body');

check(/<a class="header-cta" href="\/ru\/start"[^>]*>Начать/.test(ruHome), 'RU header CTA must route to /ru/start');
check(/<a class="mobile-cta" href="\/ru\/start"[^>]*>Начать →<\/a>/.test(ruHome), 'RU mobile CTA must route to /ru/start');
check(ruHome.includes('href="/ru/start"') && ruHome.includes('Выбрать формат'), 'RU home primary commercial CTA must route to /ru/start');
check(!/<a class="header-cta" href="\/ru\/mapper"[^>]*>/.test(ruHome), 'old RU Mapper header CTA must not survive R5 build output');
check(ruHome.includes('href="/ru/mapper"'), 'RU product layer must retain a visible Mapper path after moving the commercial front door');
check(ruStart.includes('Free / 20 минут'), '/ru/start must retain Free triage path');
check(ruStart.includes('$1,500'), '/ru/start must retain Entry price marker');
check(ruStart.includes('$4,900'), '/ru/start must retain Primary price marker');
check(ruStart.includes('testing authorization'), '/ru/start must retain no-testing boundary');

const offerHandoffs = [
  ['/entry-audit', entryAudit, entryAuditReviewHref, 'Contact Robert', true],
  ['/control-validation', controlValidation, controlValidationReviewHref, 'Contact Robert', true],
  ['/agent-authority-audit', primaryAudit, primaryAuditReviewHref, 'Contact Robert', true],
  ['/build/exception-workflow-diagnostic', buildDiagnostic, buildQualificationHref, 'Contact Robert at BitEvo', false],
  ['/ru/entry-audit', ruEntryAudit, entryAuditReviewHref, 'Связаться с Робертом', true],
  ['/ru/control-validation', ruControlValidation, controlValidationReviewHref, 'Связаться с Робертом', true],
  ['/ru/agent-authority-audit', ruPrimaryAudit, primaryAuditReviewHref, 'Связаться с Робертом', true],
  ['/ru/build/exception-workflow-diagnostic', ruBuildDiagnostic, buildQualificationHref, 'Связаться с Робертом', true]
];
const offerSubjectHrefs = new Set(offerHandoffs.map(([, , href]) => href));
check(offerSubjectHrefs.size === 4, 'direct offer handoffs must use exactly four offer-specific subject families');
for (const [route, html, href, label, injected] of offerHandoffs) {
  check(hasAnchor(html, href, label), `${route} must expose exact manual human handoff`);
  if (injected) check(html.includes(`data-offer-handoff href="${href}"`), `${route} must retain route-scoped offer handoff marker`);
  check(!html.includes(genericScopeReviewHref), `${route} must not fall back to the generic scope-review subject`);
  check(!html.includes(`${href}&body=`), `${route} handoff must never auto-embed mailto body`);
}

if (failures.length) {
  console.error(`COMMERCIAL_FRONT_DOOR_GATE=FAIL failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`COMMERCIAL_FRONT_DOOR_GATE=PASS en_home_start=1 en_header_start=1 en_mobile_start=1 ru_home_start=1 ru_header_start=1 ru_mobile_start=1 ru_mapper_visible=1 manual_handoff=1 offer_handoffs=${offerHandoffs.length} injected_offer_handoffs=7 handoff_subjects=4 offer_intent=PASS auto_send=0 authorization_boundary=PASS`);
