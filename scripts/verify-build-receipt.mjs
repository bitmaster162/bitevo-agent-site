import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const sourceMeta = JSON.parse(await readFile(join(root, 'src/generated/build-meta.json'), 'utf8'));
const publicMeta = JSON.parse(await readFile(join(dist, 'version.json'), 'utf8'));
const failures = [];
let htmlFiles = 0;
let checks = 0;

for (const key of ['schema','sha','shortSha','provider','ref','provenanceClass']) {
  checks += 1;
  if (sourceMeta[key] !== publicMeta[key]) failures.push(`version.json mismatch for ${key}`);
}
checks += 4;
if (publicMeta.schema !== 'bitevo.public-build.v2') failures.push('version.json schema mismatch');
if (!/^[0-9a-f]{40}$/i.test(publicMeta.sha)) failures.push(`invalid full git sha: ${publicMeta.sha}`);
if (!['PROVIDER_BOUND','CI_BOUND','LOCAL_GIT'].includes(publicMeta.provenanceClass)) failures.push(`non-grade provenance class: ${publicMeta.provenanceClass}`);
if (publicMeta.provenanceClass === 'PROVIDER_BOUND' && !publicMeta.ref) failures.push('provider-bound receipt requires non-empty provider ref');

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}

for (const path of await walk(dist)) {
  const html = await readFile(path, 'utf8');
  htmlFiles += 1;
  const assertions = [
    ['meta receipt', html.includes(`name="bitevo-build-sha" content="${publicMeta.sha}"`)],
    ['html data receipt', html.includes(`data-build-sha="${publicMeta.sha}"`)]
  ];
  if (html.includes('</footer>')) assertions.push(['visible footer receipt', html.includes(`data-public-build-receipt="${publicMeta.sha}"`) && html.includes('/version')]);
  checks += assertions.length;
  for (const [label, ok] of assertions) if (!ok) failures.push(`${path}: missing ${label}`);
}

const versionHtml = await readFile(join(dist, 'version', 'index.html'), 'utf8');
checks += 6;
if (!versionHtml.includes(publicMeta.sha)) failures.push('/version: full SHA not rendered');
if (!versionHtml.includes(publicMeta.shortSha)) failures.push('/version: short SHA not rendered');
if (!versionHtml.includes(publicMeta.provider)) failures.push('/version: provider not rendered');
if (!versionHtml.includes(publicMeta.provenanceClass)) failures.push('/version: provenance class not rendered');
if (!versionHtml.includes(publicMeta.ref || 'unknown')) failures.push('/version: provider ref not rendered');
if (!versionHtml.includes('Source identity ≠ runtime proof.')) failures.push('/version: evidence boundary missing');

if (failures.length) {
  console.error(`BUILD_RECEIPT_GATE=FAIL html=${htmlFiles} checks=${checks} failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`BUILD_RECEIPT_GATE=PASS sha=${publicMeta.sha} provider=${publicMeta.provider} ref=${publicMeta.ref || 'unknown'} provenance=${publicMeta.provenanceClass} html=${htmlFiles} checks=${checks} failures=0`);
