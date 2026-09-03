import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const registry = JSON.parse(await readFile(join(root, 'src/data/public-route-registry.json'), 'utf8'));
const routeByPath = new Map(registry.routes.map(route => [route.path, route]));
const internalTargets = new Map(
  registry.routes
    .filter(route => route.category === 'INTERNAL_NO_INDEX')
    .map(route => [route.path, route]),
);

let htmlScanned = 0;
let internalHrefChecks = 0;
const exposures = [];

const normalizeRoute = value => {
  const withoutFragment = value.split('#', 1)[0].split('?', 1)[0];
  if (!withoutFragment.startsWith('/')) return null;
  if (withoutFragment === '/') return '/';
  return withoutFragment.replace(/\/+$/, '') || '/';
};

const routeForFile = file => {
  const rel = relative(dist, file).split(sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'/index.html'.length)}`;
  if (rel.endsWith('.html')) return `/${rel.slice(0, -'.html'.length)}`;
  return `/${rel}`;
};

const walk = async dir => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(path);
  }
  return files;
};

for (const file of await walk(dist)) {
  htmlScanned += 1;
  const sourcePath = routeForFile(file);
  const source = routeByPath.get(sourcePath);
  const html = await readFile(file, 'utf8');
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const targetPath = normalizeRoute(match[1]);
    if (!targetPath) continue;
    internalHrefChecks += 1;
    const target = internalTargets.get(targetPath);
    if (!target) continue;
    exposures.push({
      sourcePath,
      sourceCategory: source?.category || 'UNREGISTERED',
      sourceIndexable: source?.indexable === true,
      targetPath,
      targetState: target.state || 'unspecified',
    });
  }
}

const indexableInbound = exposures.filter(item => item.sourceIndexable).length;
const experimentalInbound = exposures.filter(item => internalTargets.get(item.targetPath)?.state === 'experimental').length;

console.log(`INTERNAL_EXPOSURE_AUDIT=PASS html=${htmlScanned} internal_targets=${internalTargets.size} internal_href_checks=${internalHrefChecks} inbound_total=${exposures.length} inbound_from_indexable=${indexableInbound} experimental_inbound=${experimentalInbound}`);
for (const item of exposures) {
  console.log(`- ${item.sourcePath} (${item.sourceCategory}, indexable=${item.sourceIndexable}) -> ${item.targetPath} (state=${item.targetState})`);
}
