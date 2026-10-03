import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };

const root = fileURLToPath(new URL('../', import.meta.url));
const layout = await readFile(join(root, 'src/layouts/Layout.astro'), 'utf8');
const vercel = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
const registry = JSON.parse(await readFile(join(root, 'src/data/public-route-registry.json'), 'utf8'));
const manifest = JSON.parse(await readFile(join(root, 'src/data/sitemap-currentness.json'), 'utf8'));
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

const tag = '<script defer src="/_vercel/insights/script.js"></script>';
equal(layout.split(tag).length - 1, 1, 'shared Layout contains exactly one first-party Vercel analytics script');
check(!packageJson.dependencies?.['@vercel/analytics'], 'manual first-party integration adds no analytics package dependency');
equal(manifest.normalization, 'provider-envelope-v3', 'semantic currentness uses provider-envelope-v3');
check(packageJson.scripts?.['verify:core']?.includes('verify-p27-vercel-analytics-r1.mjs'), 'P27.3 verifier is wired into verify:core');
const csp = JSON.stringify(vercel);
check(csp.includes("script-src 'self'"), "CSP script-src keeps self");
check(csp.includes("connect-src 'self'"), "CSP connect-src keeps self");
check(!csp.includes('vercel-insights.com') && !csp.includes('vercel-scripts.com'), 'CSP adds no external analytics host');

function routeFile(route) {
  if (route === '/') return join(root, 'dist/index.html');
  return join(root, 'dist', route.replace(/^\//, ''), 'index.html');
}

const routes = registry.routes.filter(route => route.indexable).map(route => route.path);
let instrumented = 0;
for (const route of routes) {
  const html = await readFile(routeFile(route), 'utf8');
  equal(html.split(tag).length - 1, 1, 'analytics script exact once on ' + route);
  check(!html.includes('cdn.vercel-insights.com') && !html.includes('va.vercel-scripts.com'), 'no external analytics host on ' + route);
  instrumented += 1;
}

equal(instrumented, routes.length, 'all indexable routes instrumented');
console.log('P27_3_VERCEL_ANALYTICS_R1_GATE=PASS checks=' + checks + ' indexable=' + routes.length + ' instrumented=' + instrumented + ' script=FIRST_PARTY_SELF currentness=PROVIDER_ENVELOPE_V3 external_hosts=0');
