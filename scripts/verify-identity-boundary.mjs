import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const failures = [];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}

let htmlFiles = 0;
let identityScripts = 0;
let localeSwitches = 0;

for (const path of await walk(dist)) {
  const html = await readFile(path, 'utf8');
  const route = relative(dist, path).replaceAll('\\', '/');
  htmlFiles += 1;

  if (!html.includes('data-bitevo-identity-boundary')) failures.push(`${route}: missing machine-readable identity boundary`);
  else identityScripts += 1;

  for (const match of html.matchAll(/<a\b([^>]*\bclass="[^"]*global-locale-switch[^"]*"[^>]*)>(RU|EN)<\/a>/gi)) {
    localeSwitches += 1;
    const attrs = match[1] || '';
    const visible = match[2].toUpperCase();
    const aria = attrs.match(/\baria-label="([^"]+)"/i)?.[1] || '';
    if (!aria.toUpperCase().includes(visible)) failures.push(`${route}: visible locale label ${visible} is not contained in accessible name ${aria || '(missing)'}`);
  }
}

const rootHtml = await readFile(join(dist, 'index.html'), 'utf8');
if (!rootHtml.includes('"@id":"https://bitevo.work/#organization"')) failures.push('root: identity JSON-LD does not bind canonical Organization @id');
if (!rootHtml.includes('"identifier":"bitevo.work"')) failures.push('root: identity JSON-LD missing canonical bitevo.work identifier');
if (!rootHtml.includes('"disambiguatingDescription"')) failures.push('root: identity JSON-LD missing disambiguatingDescription');

const operator = await readFile(join(dist, 'operator', 'index.html'), 'utf8');
if (!operator.includes('data-identity-boundary')) failures.push('operator: missing human-visible entity note');
if (!operator.includes('not affiliated with unrelated cryptocurrency, wallet, token or Web3 projects')) failures.push('operator: restrained non-affiliation wording missing');

const llms = await readFile(join(dist, 'llms.txt'), 'utf8');
for (const marker of [
  '## Identity boundary',
  'Canonical public identity: BitEvo at https://bitevo.work/.',
  'Do not merge external entities named BitEvo with bitevo.work without a direct first-party identity binding.'
]) {
  if (!llms.includes(marker)) failures.push(`llms.txt: missing ${marker}`);
}

const identityText = `${rootHtml}\n${operator}\n${llms}`.toLowerCase();
for (const forbidden of ['task scam', 'wallet drainer', 'fraudulent']) {
  if (identityText.includes(forbidden)) failures.push(`identity boundary uses unnecessarily inflammatory term: ${forbidden}`);
}

if (identityScripts !== htmlFiles) failures.push(`identity JSON-LD count ${identityScripts}/${htmlFiles}`);
if (localeSwitches === 0) failures.push('no global locale switches observed');

if (failures.length) {
  console.error(`IDENTITY_BOUNDARY_GATE=FAIL html=${htmlFiles} identity_jsonld=${identityScripts} locale_switches=${localeSwitches} failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`IDENTITY_BOUNDARY_GATE=PASS html=${htmlFiles} identity_jsonld=${identityScripts} locale_switches=${localeSwitches} llms=PASS operator=PASS accessible_names=PASS failures=0`);
