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
const pricing = await readRoute('/pricing');
const buildDiagnostic = await readRoute('/build/exception-workflow-diagnostic');
const hrDiagnostic = await readRoute('/build/hr-workflow-diagnostic');

const startContracts = [
  ['$1,500 Entry Audit', '/entry-audit', 'Open Entry Audit'],
  ['MCP / Tool Governance', '/mcp-governance', 'Open MCP Governance'],
  ['$3,000 BUILD Workflow Exception Diagnostic', '/build/exception-workflow-diagnostic', 'Open BUILD Diagnostic'],
  ['$4,900 Primary Audit', '/agent-authority-audit', 'Open Primary Audit']
];

for (const [requiredText, href, cta] of startContracts) {
  if (!stripTags(start).includes(requiredText)) failures.push(`/start: missing commercial path text "${requiredText}"`);
  if (!hasAnchor(start, href, cta)) failures.push(`/start: missing CTA "${cta}" -> ${href}`);
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

const pricingContracts = [
  ['/start', 'Choose the right scope'],
  ['/entry-audit', 'Open Entry Audit'],
  ['/audit-intake', 'Prepare Entry Audit scope'],
  ['/start', 'Choose the smallest scope'],
  ['/mapper', 'Map the action chain']
];
for (const [href, cta] of pricingContracts) {
  if (!hasAnchor(pricing, href, cta)) failures.push(`/pricing: missing conversion CTA "${cta}" -> ${href}`);
}

const pricingText = stripTags(pricing);
for (const required of ['Free', '$1,500', '$4,900', 'This page does not book a triage, submit an audit request or authorize testing.']) {
  if (!pricingText.includes(required)) failures.push(`/pricing: missing commercial invariant "${required}"`);
}

if (failures.length) {
  console.error('COMMERCIAL_START_GATE=FAIL');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log(`COMMERCIAL_START_GATE=PASS start_paths=${startContracts.length} pricing_ctas=${pricingContracts.length} boundary_phrases=${startBoundaryPhrases.length} build_generic=PASS hr_specialization=PASS`);
