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

console.log(`COMMERCIAL_START_GATE=PASS start_paths=${startContracts.length} pricing_ctas=${pricingContracts.length} boundary_phrases=${startBoundaryPhrases.length}`);
