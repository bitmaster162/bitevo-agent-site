import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const distPath = fileURLToPath(new URL('../dist/', import.meta.url));
const failures = [];
let primaryDeliverableChecks = 0;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function rel(file) {
  return relative(distPath, file).split(sep).join('/');
}

function routeFromHtml(file) {
  const path = rel(file);
  if (path === 'index.html') return '/';
  if (path.endsWith('/index.html')) return `/${path.slice(0, -'/index.html'.length)}`;
  return `/${path}`;
}

const primaryDeliverablePhrases = [
  'EXECUTIVE REPORT',
  'AUTHORITY / EFFECT MAP',
  'TEST INVENTORY AND SCENARIO RESULTS',
  'REPRODUCIBLE EVIDENCE PACK',
  'FINDING CARDS WITH IMPACT, EVIDENCE, LIMITATIONS, AND CONFIDENCE',
  'PRIORITIZED REPAIR BACKLOG',
  'ONE RETEST',
  'EVIDENCE MANIFEST / HASHES WHERE APPLICABLE'
];

const files = await walk(distPath);
const htmlFiles = files.filter(file => extname(file).toLowerCase() === '.html');
const htmlByRoute = new Map();
for (const file of htmlFiles) htmlByRoute.set(routeFromHtml(file), await readFile(file, 'utf8'));

for (const route of ['/', '/artifacts', '/agent-authority-audit', '/pricing']) {
  primaryDeliverableChecks += 1;
  const html = (htmlByRoute.get(route) || '').toUpperCase();
  if (!primaryDeliverablePhrases.every(phrase => html.includes(phrase))) {
    failures.push(`${route}: must expose the complete eight-item Primary Audit delivery package`);
  }
}

for (const route of ['/agent-authority-audit', '/pricing']) {
  const html = (htmlByRoute.get(route) || '').toUpperCase();
  for (const phrase of primaryDeliverablePhrases) {
    primaryDeliverableChecks += 1;
    if (!html.includes(phrase)) failures.push(`${route}: missing Primary Audit deliverable "${phrase}"`);
  }
}

primaryDeliverableChecks += 1;
const artifactsHtml = (htmlByRoute.get('/artifacts') || '').toUpperCase();
if (!artifactsHtml.includes('A1–A4 ARE THE CANONICAL DECISION-ARTIFACT SPINE. THEY ARE NOT THE COMPLETE COMMERCIAL DELIVERY PACKAGE.')) {
  failures.push('/artifacts: must distinguish A1–A4 artifact spine from the complete commercial delivery package');
}

primaryDeliverableChecks += 1;
const homepageHtml = (htmlByRoute.get('/') || '').toUpperCase();
if (!homepageHtml.includes('COMPLETE PRIMARY AUDIT DELIVERY PACKAGE')) {
  failures.push('/: must label the complete Primary Audit delivery package separately from the A1–A4 artifact spine');
}

const llmsPath = join(distPath, 'llms.txt');
const upperLlms = (await readFile(llmsPath, 'utf8')).toUpperCase();
primaryDeliverableChecks += 1;
if (!primaryDeliverablePhrases.every(phrase => upperLlms.includes(phrase))) {
  failures.push('llms.txt: must expose the complete eight-item Primary Audit delivery package');
}
for (const phrase of primaryDeliverablePhrases) {
  primaryDeliverableChecks += 1;
  if (!upperLlms.includes(phrase)) failures.push(`llms.txt: missing Primary Audit deliverable "${phrase}"`);
}

if (primaryDeliverableChecks !== 31) failures.push(`primary deliverable check accounting drifted (${primaryDeliverableChecks} != 31)`);

if (failures.length) {
  console.error('PRIMARY_DELIVERABLE_GATE=FAIL');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log(`PRIMARY_DELIVERABLE_GATE=PASS checks=${primaryDeliverableChecks} baseline_trust=49 combined_trust=80 failures=0`);
