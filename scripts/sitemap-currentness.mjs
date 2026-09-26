import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const distRoot = join(repoRoot, 'dist');
const registryPath = join(repoRoot, 'src/data/public-route-registry.json');
const manifestPath = join(repoRoot, 'src/data/sitemap-currentness.json');
const schema = 'bitevo.sitemap-currentness/v1';
const normalization = 'provider-envelope-v2';

function normalizeRenderedHtml(html) {
  return html
    .replace(/<meta\b(?=[^>]*\bdata-cloudflare-csp="hash-bound")[^>]*>/gi, '')
    .replace(/data-scope-handoff-r1-activation="(?:disabled|isolated_staging_preview_r1|production_scope_review_r1)"/gi, 'data-scope-handoff-r1-activation="__SCOPE_HANDOFF_ACTIVATION__"')
    .replace(/data-build-sha="[0-9a-f]{40}"/gi, 'data-build-sha="__BUILD_SHA__"')
    .replace(/<meta name="bitevo-build-sha" content="[0-9a-f]{40}">/gi, '<meta name="bitevo-build-sha" content="__BUILD_SHA__">')
    .replace(/data-public-build-receipt="[0-9a-f]{40}"/gi, 'data-public-build-receipt="__BUILD_SHA__"')
    .replace(/>Build [0-9a-f]{9}</gi, '>Build __BUILD_SHORT__<');
}

function fingerprint(html) {
  return `sha256:${createHash('sha256').update(normalizeRenderedHtml(html)).digest('hex')}`;
}

function verifyActivationMarkerNormalization() {
  const variants = [
    'disabled',
    'isolated_staging_preview_r1',
    'production_scope_review_r1'
  ].map(value => fingerprint(`<main data-scope-handoff-r1-activation="${value}"></main>`));
  if (new Set(variants).size !== 1) throw new Error('scope handoff activation marker normalization drift');
  const unknown = fingerprint('<main data-scope-handoff-r1-activation="unexpected"></main>');
  if (unknown === variants[0]) throw new Error('unknown scope handoff activation marker must not normalize');
}

function routeFile(route) {
  if (route === '/') return join(distRoot, 'index.html');
  return join(distRoot, route.replace(/^\//, ''), 'index.html');
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

async function readJson(path, fallback = null) {
  try {
    return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
  } catch (error) {
    if (fallback !== null && error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function currentRows() {
  const registry = await readJson(registryPath);
  const routes = registry.routes.filter(route => route.indexable).map(route => route.path);
  const rows = [];
  for (const path of routes) {
    const html = await readFile(routeFile(path), 'utf8');
    rows.push({ path, fingerprint: fingerprint(html) });
  }
  return rows;
}

async function verify() {
  verifyActivationMarkerNormalization();
  const manifest = await readJson(manifestPath);
  if (manifest.schema !== schema) throw new Error(`sitemap currentness schema mismatch: ${manifest.schema || 'missing'}`);
  if (manifest.normalization !== normalization) throw new Error(`sitemap currentness normalization mismatch: ${manifest.normalization || 'missing'}`);
  if (!Array.isArray(manifest.routes)) throw new Error('sitemap currentness routes must be an array');

  const rows = await currentRows();
  const byPath = new Map(manifest.routes.map(row => [row.path, row]));
  const expectedPaths = new Set(rows.map(row => row.path));
  const manifestPaths = new Set(manifest.routes.map(row => row.path));
  const failures = [];

  if (byPath.size !== manifest.routes.length) failures.push('duplicate route paths in sitemap currentness manifest');
  for (const path of expectedPaths) if (!manifestPaths.has(path)) failures.push(`missing route in sitemap currentness manifest: ${path}`);
  for (const path of manifestPaths) if (!expectedPaths.has(path)) failures.push(`stale route in sitemap currentness manifest: ${path}`);

  for (const row of rows) {
    const saved = byPath.get(row.path);
    if (!saved) continue;
    if (!validDate(saved.lastmod)) failures.push(`invalid lastmod for ${row.path}: ${saved.lastmod || 'missing'}`);
    if (!/^sha256:[0-9a-f]{64}$/.test(String(saved.fingerprint || ''))) failures.push(`invalid fingerprint for ${row.path}`);
    else if (saved.fingerprint !== row.fingerprint) failures.push(`rendered fingerprint drift for ${row.path}`);
  }

  if (failures.length) {
    console.error(`SITEMAP_CURRENTNESS_VERIFY_FAIL count=${failures.length}`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(`SITEMAP_CURRENTNESS_VERIFY_PASS routes=${rows.length} normalization=${normalization}`);
}

async function update() {
  const date = String(process.env.SITEMAP_CURRENTNESS_DATE || new Date().toISOString().slice(0, 10));
  if (!validDate(date)) throw new Error(`invalid SITEMAP_CURRENTNESS_DATE: ${date}`);
  const existing = await readJson(manifestPath, { schema, normalization, routes: [] });
  const oldByPath = new Map(Array.isArray(existing.routes) ? existing.routes.map(row => [row.path, row]) : []);
  const rows = await currentRows();
  let changed = 0;
  const nextRoutes = rows.map(row => {
    const old = oldByPath.get(row.path);
    const stable = old && old.fingerprint === row.fingerprint && validDate(old.lastmod);
    if (!stable) changed += 1;
    return { path: row.path, lastmod: stable ? old.lastmod : date, fingerprint: row.fingerprint };
  });
  const next = { schema, normalization, routes: nextRoutes };
  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  const prior = await readFile(manifestPath, 'utf8').catch(() => '');
  if (serialized !== prior) await writeFile(manifestPath, serialized, 'utf8');
  console.log(`SITEMAP_CURRENTNESS_UPDATE_PASS routes=${rows.length} changed=${changed} date=${date}`);
}

const mode = process.argv[2] || 'verify';
if (mode === 'verify') await verify();
else if (mode === 'update') await update();
else throw new Error(`unsupported sitemap currentness mode: ${mode}`);
