import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const vercelConfig = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const buildMeta = JSON.parse(await readFile(new URL('../src/generated/build-meta.json', import.meta.url), 'utf8'));
const allowlist = JSON.parse(await readFile(new URL('./csp-inline-allowlist.json', import.meta.url), 'utf8'));
const failures = [];
let securityHeaderChecks = 0;
let cspChecks = 0;
let cacheChecks = 0;
let externalFontDomainChecks = 0;
let routingChecks = 0;
let deploymentChecks = 0;
let provenanceChecks = 0;
let hashChecks = 0;

const raw = JSON.stringify(vercelConfig);
const headerRules = Array.isArray(vercelConfig.headers) ? vercelConfig.headers : [];
const globalHeaders = headerRules.find(rule => rule.source === '/(.*)')?.headers || [];
const globalHeaderMap = new Map(globalHeaders.map(item => [String(item.key).toLowerCase(), String(item.value)]));
const csp = globalHeaderMap.get('content-security-policy') || '';

const deploymentEnabled = vercelConfig.git?.deploymentEnabled;
deploymentChecks += 1;
if (!deploymentEnabled || typeof deploymentEnabled !== 'object' || Array.isArray(deploymentEnabled)) failures.push('vercel.json: git.deploymentEnabled must remain a branch map');
deploymentChecks += 1;
if (deploymentEnabled?.['coordination/site-mutation-lease'] !== false) failures.push('vercel.json: coordination/site-mutation-lease must not trigger Vercel deployments');
deploymentChecks += 1;
if (deploymentEnabled?.['agent/site-p24-scope-handoff-production-readiness-r1'] !== false) failures.push('vercel.json: P24 feature branch must not trigger Vercel deployments');


const requiredSecurityHeaderKeys = ['x-content-type-options','x-frame-options','referrer-policy','permissions-policy','cross-origin-opener-policy','content-security-policy'];
for (const key of requiredSecurityHeaderKeys) {
  securityHeaderChecks += 1;
  if (!globalHeaderMap.has(key)) failures.push(`vercel.json: missing global ${key} header`);
}
for (const [ok, message] of [
  [csp.includes("frame-ancestors 'none'"), "vercel.json: CSP must include frame-ancestors 'none'"],
  [csp.includes("script-src 'self'"), "vercel.json: CSP script-src must include self"],
  [csp.includes("style-src 'self'"), "vercel.json: CSP style-src must include self"],
  [!csp.includes("'unsafe-inline'"), "vercel.json: CSP must not allow unsafe-inline"],
  [!csp.includes("'unsafe-eval'"), "vercel.json: CSP must not allow unsafe-eval"]
]) { cspChecks += 1; if (!ok) failures.push(message); }
for (const hash of allowlist.scripts || []) { hashChecks += 1; if (!csp.includes(`'sha256-${hash}'`)) failures.push(`vercel.json: missing reviewed script hash sha256-${hash}`); }
for (const hash of allowlist.styles || []) { hashChecks += 1; if (!csp.includes(`'sha256-${hash}'`)) failures.push(`vercel.json: missing reviewed style hash sha256-${hash}`); }

for (const [ok, message] of [
  [buildMeta.provider === 'vercel', `build receipt provider must be vercel, got ${buildMeta.provider}`],
  [buildMeta.provenanceClass === 'PROVIDER_BOUND', `build receipt must be PROVIDER_BOUND, got ${buildMeta.provenanceClass}`],
  [/^[0-9a-f]{40}$/i.test(buildMeta.sha), `build receipt must contain exact 40-char SHA, got ${buildMeta.sha}`],
  [typeof buildMeta.ref === 'string' && buildMeta.ref.trim().length > 0, 'build receipt must contain non-empty Vercel Git ref']
]) { provenanceChecks += 1; if (!ok) failures.push(message); }

const immutableRule = headerRules.find(rule => rule.source === '/_astro/(.*)');
const immutableCache = immutableRule?.headers?.find(item => String(item.key).toLowerCase() === 'cache-control')?.value || '';
cacheChecks += 1;
if (!String(immutableCache).includes('immutable') || !String(immutableCache).includes('31536000')) failures.push('vercel.json: hashed Astro assets must use one-year immutable cache');
for (const domain of ['fonts.googleapis.com','fonts.gstatic.com']) { externalFontDomainChecks += 1; if (raw.includes(domain)) failures.push(`vercel.json: external font domain allowed by deployment policy ${domain}`); }
routingChecks += 1; if (vercelConfig.cleanUrls !== true) failures.push('vercel.json: cleanUrls must remain true');
routingChecks += 1; if (vercelConfig.trailingSlash !== false) failures.push('vercel.json: trailingSlash must be false');
const customRoutes = Array.isArray(vercelConfig.routes) ? vercelConfig.routes : [];
const routeHeaderIndex = customRoutes.findIndex(route => route?.src === '/(.*)' && route?.continue === true && route?.headers && typeof route.headers === 'object');
const routeHeaderMap = new Map(Object.entries(routeHeaderIndex >= 0 ? customRoutes[routeHeaderIndex].headers : {}).map(([key,value]) => [String(key).toLowerCase(), String(value)]));
const intakeRedirectIndex = customRoutes.findIndex(route => route?.src === '/intake' && Number(route?.status) === 308 && route?.headers?.Location === '/audit-intake');
const filesystemIndex = customRoutes.findIndex(route => route?.handle === 'filesystem');
const ru404Index = customRoutes.findIndex(route => route?.src === '/ru(?:/.*)?' && Number(route?.status) === 404 && route?.dest === '/ru/404');
routingChecks += 1; if (routeHeaderIndex !== 0) failures.push('vercel.json: security header route must be the first custom route');
for (const key of requiredSecurityHeaderKeys) { routingChecks += 1; if (routeHeaderMap.get(key) !== globalHeaderMap.get(key)) failures.push('vercel.json: route-level ' + key + ' must exactly match global header policy'); }
routingChecks += 1; if (intakeRedirectIndex < 0) failures.push('vercel.json: missing effective /intake 308 redirect route');
routingChecks += 1; if (filesystemIndex < 0) failures.push('vercel.json: localized 404 routing requires filesystem phase');
routingChecks += 1; if (!(routeHeaderIndex < intakeRedirectIndex && intakeRedirectIndex < filesystemIndex)) failures.push('vercel.json: security headers and /intake redirect must run before filesystem phase');
routingChecks += 1; if (ru404Index < 0) failures.push('vercel.json: missing exact RU 404 fallback route');
routingChecks += 1; if (filesystemIndex < 0 || ru404Index <= filesystemIndex) failures.push('vercel.json: RU 404 fallback must run after filesystem phase');
routingChecks += 1; if (customRoutes.some(route => Number(route?.status) === 404 && route?.src !== '/ru(?:/.*)?')) failures.push('vercel.json: 404 fallback must remain scoped to /ru');

if (failures.length) { console.error('VERCEL_POLICY_GATE=FAIL'); for (const failure of failures) console.error(failure); process.exit(1); }
console.log(`VERCEL_POLICY_GATE=PASS security_header_checks=${securityHeaderChecks} csp_checks=${cspChecks} hash_checks=${hashChecks} provenance_checks=${provenanceChecks} cache_checks=${cacheChecks} external_font_domain_checks=${externalFontDomainChecks} routing_checks=${routingChecks} deployment_checks=${deploymentChecks} failures=0`);
