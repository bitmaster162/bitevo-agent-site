import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const homePath = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const html = (await readFile(homePath, 'utf8')).toUpperCase();
const failures = [];
let requiredChecks = 0;
let forbiddenChecks = 0;

const required = [
  'SYNTHETIC WORKED CASE',
  'SYNTHETIC · WORKED',
  'SYNTHETIC WORKED SCENARIO ONLY',
  'PRODUCTION EXECUTION',
  'OBSERVED PRIVATE INFRASTRUCTURE'
];
for (const phrase of required) {
  requiredChecks += 1;
  if (!html.includes(phrase)) failures.push(`homepage missing synthetic provenance phrase: ${phrase}`);
}

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
