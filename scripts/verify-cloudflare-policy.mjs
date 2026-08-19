import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const wrangler = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const headers = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
const worker = await readFile(new URL('../worker/index.mjs', import.meta.url), 'utf8');
const buildMeta = JSON.parse(await readFile(new URL('../src/generated/build-meta.json', import.meta.url), 'utf8'));
const allowlist = JSON.parse(await readFile(new URL('./csp-inline-allowlist.json', import.meta.url), 'utf8'));
const failures = [];
let configChecks = 0, routingChecks = 0, headerChecks = 0, provenanceChecks = 0, hashChecks = 0;
const check = (bucket, ok, message) => { if (bucket === 'config') configChecks += 1; if (bucket === 'routing') routingChecks += 1; if (bucket === 'headers') headerChecks += 1; if (bucket === 'provenance') provenanceChecks += 1; if (bucket === 'hash') hashChecks += 1; if (!ok) failures.push(message); };

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
check('headers', headers.includes("frame-ancestors 'none'"), "public/_headers: CSP must include frame-ancestors 'none'");
check('headers', !headers.includes("'unsafe-inline'"), 'public/_headers: CSP must not allow unsafe-inline');
check('headers', !headers.includes("'unsafe-eval'"), 'public/_headers: CSP must not allow unsafe-eval');
for (const hash of allowlist.scripts || []) check('hash', headers.includes(`'sha256-${hash}'`), `public/_headers: missing reviewed script hash sha256-${hash}`);
for (const hash of allowlist.styles || []) check('hash', headers.includes(`'sha256-${hash}'`), `public/_headers: missing reviewed style hash sha256-${hash}`);

check('provenance', buildMeta.provider === 'cloudflare', `build receipt provider must be cloudflare, got ${buildMeta.provider}`);
check('provenance', buildMeta.provenanceClass === 'PROVIDER_BOUND', `build receipt must be PROVIDER_BOUND, got ${buildMeta.provenanceClass}`);
check('provenance', /^[0-9a-f]{40}$/i.test(buildMeta.sha), `build receipt must contain exact 40-char SHA, got ${buildMeta.sha}`);
check('provenance', typeof buildMeta.ref === 'string' && buildMeta.ref.trim().length > 0, 'build receipt must contain non-empty Cloudflare branch');

if (failures.length) { console.error('CLOUDFLARE_POLICY_GATE=FAIL'); for (const failure of failures) console.error(failure); process.exit(1); }
console.log(`CLOUDFLARE_POLICY_GATE=PASS config=${configChecks} routing=${routingChecks} headers=${headerChecks} hash_checks=${hashChecks} provenance=${provenanceChecks} failures=0`);
