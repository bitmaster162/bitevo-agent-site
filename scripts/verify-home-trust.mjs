import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const homePath = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const htmlRaw = await readFile(homePath, 'utf8');
const html = htmlRaw.toUpperCase();
const failures = [];
let requiredChecks = 0;
let forbiddenChecks = 0;

const required = [
  'SYNTHETIC WORKED CASE',
  'SYNTHETIC · WORKED',
  'SYNTHETIC WORKED SCENARIO ONLY',
  'PRODUCTION EXECUTION',
  'OBSERVED PRIVATE INFRASTRUCTURE',
  'INTERNAL DOGFOOD',
  'NOT CUSTOMER PROOF',
  'INDEPENDENT CERTIFICATION',
  'PRODUCTION-WIDE SECURITY EVIDENCE'
];
for (const phrase of required) {
  requiredChecks += 1;
  if (!html.includes(phrase)) failures.push(`homepage missing trust-boundary phrase: ${phrase}`);
}

requiredChecks += 1;
const dogfoodAnchor = [...htmlRaw.matchAll(/<a\b[^>]*>/gi)].some(match => {
  const tag = match[0];
  return /\bdata-home-proof=["']dogfood["']/i.test(tag) && /\bhref=["']\/dogfood-self-audit["']/i.test(tag);
});
if (!dogfoodAnchor) failures.push('homepage missing contextual internal-dogfood proof link');

const forbidden = [
  'REDACTED LAB CASE',
  'INTERNAL · REDACTED',
  'PUBLIC INTERNAL-LAB EXAMPLE ONLY'
];
for (const phrase of forbidden) {
  forbiddenChecks += 1;
  if (html.includes(phrase)) failures.push(`homepage contains ambiguous lab provenance phrase: ${phrase}`);
}

if (failures.length) {
  console.error('HOME_TRUST_GATE=FAIL');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log(`HOME_TRUST_GATE=PASS required_checks=${requiredChecks} forbidden_checks=${forbiddenChecks} failures=0`);
