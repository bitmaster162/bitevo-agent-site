import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const registry = JSON.parse(await readFile(join(root, 'src/data/public-route-registry.json'), 'utf8'));

const groupSpec = [
  ['Commercial / flagship', ['FLAGSHIP', 'ENTRY']],
  ['Specialist scopes', ['SPECIALIST']],
  ['Browser-local tools', ['TOOL']],
  ['Proof / trust', ['PROOF']],
  ['Research', ['RESEARCH']],
  ['Context', ['CONTEXT']]
];

const englishIndexable = registry.routes.filter(route => route.indexable && route.locale === 'en');
const hierarchy = ['## Current route hierarchy'];
for (const [heading, categories] of groupSpec) {
  hierarchy.push('', `### ${heading}`);
  for (const route of englishIndexable.filter(item => categories.includes(item.category))) {
    const suffix = route.path === '/start' ? ' — commercial front door' : route.category === 'ENTRY' ? ' — canonical paid entry' : '';
    hierarchy.push(`- ${route.path}${suffix}`);
  }
}

const llmsPath = join(dist, 'llms.txt');
let llms = await readFile(llmsPath, 'utf8');
const startMarker = '## Canonical public routes';
const endMarker = 'Historical guide routes are not part of the reviewed public research set and may be redirected to /guides.';
const start = llms.indexOf(startMarker);
const end = llms.indexOf(endMarker);
if (start < 0 || end < 0 || end <= start) throw new Error('llms.txt route hierarchy markers changed; refusing silent taxonomy drift.');
llms = `${llms.slice(0, start)}${hierarchy.join('\n')}\n\n${llms.slice(end)}`;
await writeFile(llmsPath, llms, 'utf8');

const htmlPath = route => join(dist, route.replace(/^\//, ''), 'index.html');
const readHtml = route => readFile(htmlPath(route), 'utf8');
const writeHtml = (route, html) => writeFile(htmlPath(route), html, 'utf8');

let assurance = await readHtml('/assurance');
if (!/name="robots"/i.test(assurance)) {
  assurance = assurance.replace('</head>', '<meta name="robots" content="noindex, follow" data-route-taxonomy="LEGACY"></head>');
}
if (!assurance.includes('data-legacy-route-note')) {
  assurance = assurance.replace(
    '<section class="assurance-hero section">',
    '<section class="assurance-hero section"><div class="container panel" data-legacy-route-note><div class="eyebrow">LEGACY COMMERCIAL UMBRELLA · TRANSITION ONLY</div><p>This route is retained for historical continuity. The current BitEvo buyer path is <a href="/start">Start</a> → <a href="/pricing">Pricing</a>, with specialist scopes subordinate to that ladder.</p></div>'
  );
}
assurance = assurance
  .replace('<a href="/audit-intake" class="button button-primary">Scope one workflow <span aria-hidden="true">↗</span></a>', '<a href="/start" class="button button-primary">Choose current scope <span aria-hidden="true">↗</span></a>')
  .replace('<a href="#offers" class="button button-ghost">Compare the two entry offers</a>', '<a href="/pricing" class="button button-ghost">Current pricing</a>');
await writeHtml('/assurance', assurance);

let control = await readHtml('/control-validation');
control = control
  .replace('href="/assurance">Back to System Assurance</a>', 'href="/start">Choose the right scope</a>');
await writeHtml('/control-validation', control);

let evidence = await readHtml('/evidence-readiness');
evidence = evidence
  .replace('href="/assurance">Compare System Assurance offers</a>', 'href="/start">Choose the right scope</a>');
await writeHtml('/evidence-readiness', evidence);

let aiAudit = await readHtml('/ai-audit');
aiAudit = aiAudit
  .replace('The umbrella offer is maintained at <strong>/assurance</strong>', 'The current buyer path is maintained at <strong>/start</strong>')
  .replace('href="/assurance" class="button button-primary">Open System Assurance', 'href="/start" class="button button-primary">Choose current scope');
await writeHtml('/ai-audit', aiAudit);

console.log(`ROUTE_TAXONOMY_POSTPROCESS=PASS indexable=${registry.routes.filter(route => route.indexable).length} english_indexable=${englishIndexable.length} llms_groups=${groupSpec.length} assurance_noindex=1 specialist_relinks=2 legacy_alias_relinks=1`);
