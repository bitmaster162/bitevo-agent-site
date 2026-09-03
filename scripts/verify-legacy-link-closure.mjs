import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const registry = JSON.parse(await readFile(join(root, 'src/data/public-route-registry.json'), 'utf8'));
const routeByPath = new Map(registry.routes.map(route => [route.path, route]));
const legacyTargets = new Set(registry.routes.filter(route => route.category === 'LEGACY').map(route => route.path));
const failures = [];
let htmlScanned = 0;
let internalHrefChecks = 0;

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
  const sourceCategory = source?.category || 'UNREGISTERED';
  if (sourceCategory === 'LEGACY') continue;

  const html = await readFile(file, 'utf8');
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const target = normalizeRoute(match[1]);
    if (!target) continue;
    internalHrefChecks += 1;
    if (legacyTargets.has(target)) {
      failures.push(`${sourcePath} (${sourceCategory}) -> legacy ${target}`);
    }
  }
}

if (failures.length) {
  console.error(`LEGACY_LINK_CLOSURE_GATE=FAIL html=${htmlScanned} legacy_targets=${legacyTargets.size} internal_href_checks=${internalHrefChecks} failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`LEGACY_LINK_CLOSURE_GATE=PASS html=${htmlScanned} legacy_targets=${legacyTargets.size} internal_href_checks=${internalHrefChecks} nonlegacy_to_legacy=0 failures=0`);
