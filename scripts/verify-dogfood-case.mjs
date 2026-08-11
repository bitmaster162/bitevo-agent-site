import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('dist');
const dogfoodPath = path.join(root, 'dogfood-self-audit', 'index.html');
const proofPath = path.join(root, 'proof', 'index.html');
const auditPath = path.join(root, 'agent-authority-audit', 'index.html');

const failures = [];
let requiredChecks = 0;
let linkChecks = 0;
let contextChecks = 0;
let privateMarkerChecks = 0;

const read = (file) => {
  if (!fs.existsSync(file)) {
    failures.push(`missing:${path.relative(root, file)}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
};

const dogfood = read(dogfoodPath);
const proof = read(proofPath);
const audit = read(auditPath);

const required = [
  'Internal self-audit',
  'customer_case',
  'independent_certification',
  'production_wide_security_claim',
  'control adopted everywhere',
  'Antigravity qualification',
  'Spark internal adversarial batch',
  'Map one workflow',
  'Scope an audit'
];

for (const token of required) {
  requiredChecks += 1;
  if (!dogfood.toLowerCase().includes(token.toLowerCase())) failures.push(`dogfood:missing:${token}`);
}

const extractTaggedSection = (html, marker) => {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return '';
  const start = html.lastIndexOf('<section', markerIndex);
  const end = html.indexOf('</section>', markerIndex);
  if (start < 0 || end < 0) return '';
  return html.slice(start, end + '</section>'.length);
};

const contexts = [
  ['proof', proof, 'data-dogfood-context="proof"'],
  ['agent-authority-audit', audit, 'data-dogfood-context="audit"']
];

for (const [name, html, marker] of contexts) {
  contextChecks += 1;
  const section = extractTaggedSection(html, marker);
  if (!section) {
    failures.push(`${name}:missing-dogfood-context`);
    continue;
  }

  contextChecks += 1;
  if (!section.includes('href="/dogfood-self-audit"')) failures.push(`${name}:context-missing-dogfood-link`);

  linkChecks += 1;
  if (!html.includes('href="/dogfood-self-audit"')) failures.push(`${name}:missing-dogfood-link`);
}

const privateMarkers = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /(?:^|[\s"'`])C:\\Users\\/i,
  /(?:^|[\s"'`])\/home\/[A-Za-z0-9._-]+\//,
  /(?:^|[\s"'`])\/opt\/[A-Za-z0-9._/-]+/,
  /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/
];

for (const pattern of privateMarkers) {
  privateMarkerChecks += 1;
  if (pattern.test(dogfood)) failures.push(`dogfood:private-marker:${pattern}`);
}

const requiredBoundaries = [
  'not customer evidence',
  'not an independent certification',
  'not establish universal no-bypass',
  'fleet-wide/live adoption remains a separate engineering program'
];
for (const boundary of requiredBoundaries) {
  requiredChecks += 1;
  if (!dogfood.toLowerCase().includes(boundary.toLowerCase())) failures.push(`dogfood:boundary-missing:${boundary}`);
}

if (failures.length) {
  console.error(`DOGFOOD_CASE_GATE=FAIL required_checks=${requiredChecks} link_checks=${linkChecks} context_checks=${contextChecks} private_marker_checks=${privateMarkerChecks} failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`DOGFOOD_CASE_GATE=PASS required_checks=${requiredChecks} link_checks=${linkChecks} context_checks=${contextChecks} private_marker_checks=${privateMarkerChecks} failures=0`);
