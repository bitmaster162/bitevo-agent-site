import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const wrangler = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const headers = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
const worker = await readFile(new URL('../worker/index.mjs', import.meta.url), 'utf8');
const buildMeta = JSON.parse(await readFile(new URL('../src/generated/build-meta.json', import.meta.url), 'utf8'));
const allowlist = JSON.parse(await readFile(new URL('./csp-inline-allowlist.json', import.meta.url), 'utf8'));
const failures = [];
let configChecks = 0, routingChecks = 0, headerChecks = 0, provenanceChecks = 0, hashChecks = 0, htmlChecks = 0;
const check = (bucket, ok, message) => {
  if (bucket === 'config') configChecks += 1;
  if (bucket === 'routing') routingChecks += 1;
  if (bucket === 'headers') headerChecks += 1;
  if (bucket === 'provenance') provenanceChecks += 1;
  if (bucket === 'hash') hashChecks += 1;
  if (bucket === 'html') htmlChecks += 1;
  if (!ok) failures.push(message);
};

check('config', wrangler.name === 'bitevo-agent-site', 'wrangler: unexpected Worker name');
check('config', wrangler.compatibility_date === '2026-08-12', 'wrangler: compatibility_date must be pinned');
check('config', wrangler.main === 'worker/index.mjs', 'wrangler: main must bind the bounded guide router');
check('config', wrangler.workers_dev === true, 'wrangler: workers.dev preview must remain enabled during migration');
check('config', wrangler.assets?.directory === './dist', 'wrangler: assets.directory must be ./dist');
check('config', wrangler.assets?.binding === 'ASSETS', 'wrangler: assets binding must be ASSETS');
check('config', wrangler.assets?.not_found_handling === '404-page', 'wrangler: custom 404 handling must remain 404-page');
check('routing', wrangler.assets?.html_handling === 'drop-trailing-slash', 'wrangler: HTML handling must canonicalize to no trailing slash');
const runFirst = wrangler.assets?.run_worker_first || [];
for (const pattern of ['/guides/*','!/guides/ai-agent-reliability-audit','!/guides/security-sandboxing','!/guides/fleet-coordinator-drift-monitoring','!/guides/d3-tool-io-bridge-contract']) check('routing', runFirst.includes(pattern), `wrangler: missing bounded guide routing pattern ${pattern}`);
check('routing', worker.includes("Response.redirect(new URL('/guides', url), 302)"), 'worker: legacy guide fallback must remain temporary 302 -> /guides');
for (const slug of ['ai-agent-reliability-audit','security-sandboxing','fleet-coordinator-drift-monitoring','d3-tool-io-bridge-contract']) check('routing', worker.includes(`/guides/${slug}`), `worker: missing canonical guide allowlist ${slug}`);

for (const required of ['X-Content-Type-Options: nosniff','X-Frame-Options: DENY','Referrer-Policy: strict-origin-when-cross-origin','Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()','Cross-Origin-Opener-Policy: same-origin','Cache-Control: public, max-age=31536000, immutable','Cache-Control: public, max-age=3600, stale-while-revalidate=86400']) check('headers', headers.includes(required), `public/_headers: missing ${required}`);
check('headers', headers.includes("Content-Security-Policy: frame-ancestors 'none'"), "public/_headers: CSP must retain HTTP-only frame-ancestors 'none'");
check('headers', !headers.includes("'unsafe-inline'"), 'public/_headers: CSP must not allow unsafe-inline');
check('headers', !headers.includes("'unsafe-eval'"), 'public/_headers: CSP must not allow unsafe-eval');

const headerLines = headers.split(/\r?\n/);
for (let index = 0; index < headerLines.length; index += 1) {
  check('headers', headerLines[index].length <= 2000, `public/_headers: line ${index + 1} exceeds Cloudflare 2000-character limit (${headerLines[index].length})`);
}

const cspHashes = values => values.map(hash => `'sha256-${hash}'`).join(' ');
const cloudflareMetaCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  `script-src 'self' ${cspHashes(allowlist.scripts || [])}`.trim(),
  `style-src 'self' ${cspHashes(allowlist.styles || [])}`.trim(),
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  'upgrade-insecure-requests'
].join('; ');
const cloudflareMetaTag = `<meta http-equiv="Content-Security-Policy" content="${cloudflareMetaCsp}" data-cloudflare-csp="hash-bound">`;

check('html', !cloudflareMetaCsp.includes('frame-ancestors'), 'Cloudflare meta CSP must not contain frame-ancestors');
check('html', !cloudflareMetaCsp.includes("'unsafe-inline'"), 'Cloudflare meta CSP must not allow unsafe-inline');
check('html', !cloudflareMetaCsp.includes("'unsafe-eval'"), 'Cloudflare meta CSP must not allow unsafe-eval');
for (const hash of allowlist.scripts || []) check('hash', cloudflareMetaCsp.includes(`'sha256-${hash}'`), `Cloudflare meta CSP missing reviewed script hash sha256-${hash}`);
for (const hash of allowlist.styles || []) check('hash', cloudflareMetaCsp.includes(`'sha256-${hash}'`), `Cloudflare meta CSP missing reviewed style hash sha256-${hash}`);

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
for (const path of await walk(dist)) {
  const html = await readFile(path, 'utf8');
  const route = relative(dist, path).replaceAll('\\', '/');
  htmlFiles += 1;
  const cspIndex = html.indexOf(cloudflareMetaTag);
  const headIndex = html.search(/<head(?:\s[^>]*)?>/i);
  const firstControlledIndexes = [
    html.search(/<script\b/i),
    html.search(/<style\b/i),
    html.search(/<link\b[^>]*\brel=["']stylesheet["']/i)
  ].filter(index => index >= 0);
  const firstControlled = firstControlledIndexes.length ? Math.min(...firstControlledIndexes) : Number.POSITIVE_INFINITY;
  check('html', cspIndex >= 0, `${route}: missing exact Cloudflare hash-bound meta CSP`);
  check('html', headIndex >= 0 && cspIndex > headIndex, `${route}: Cloudflare meta CSP must be inside <head>`);
  check('html', cspIndex >= 0 && cspIndex < firstControlled, `${route}: Cloudflare meta CSP must precede script/style/stylesheet content`);
}

check('provenance', buildMeta.provider === 'cloudflare', `build receipt provider must be cloudflare, got ${buildMeta.provider}`);
check('provenance', buildMeta.provenanceClass === 'PROVIDER_BOUND', `build receipt must be PROVIDER_BOUND, got ${buildMeta.provenanceClass}`);
check('provenance', /^[0-9a-f]{40}$/i.test(buildMeta.sha), `build receipt must contain exact 40-char SHA, got ${buildMeta.sha}`);
check('provenance', typeof buildMeta.ref === 'string' && buildMeta.ref.trim().length > 0, 'build receipt must contain non-empty Cloudflare branch');

if (failures.length) {
  console.error('CLOUDFLARE_POLICY_GATE=FAIL');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log(`CLOUDFLARE_POLICY_GATE=PASS config=${configChecks} routing=${routingChecks} headers=${headerChecks} hash_checks=${hashChecks} html_files=${htmlFiles} html_checks=${htmlChecks} provenance=${provenanceChecks} max_header_line=${Math.max(...headerLines.map(line => line.length))} failures=0`);
