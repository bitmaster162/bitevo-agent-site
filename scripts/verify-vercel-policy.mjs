import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const vercelConfigPath = fileURLToPath(new URL('../vercel.json', import.meta.url));
const buildMetaPath = fileURLToPath(new URL('../src/generated/build-meta.json', import.meta.url));
const failures = [];
let securityHeaderChecks = 0;
let cspChecks = 0;
let cacheChecks = 0;
let externalFontDomainChecks = 0;
let routingChecks = 0;
let provenanceChecks = 0;

const raw = await readFile(vercelConfigPath, 'utf8');
const vercelConfig = JSON.parse(raw);
const buildMeta = JSON.parse(await readFile(buildMetaPath, 'utf8'));
const headerRules = Array.isArray(vercelConfig.headers) ? vercelConfig.headers : [];
const globalHeaders = headerRules.find(rule => rule.source === '/(.*)')?.headers || [];
const globalHeaderMap = new Map(globalHeaders.map(item => [String(item.key).toLowerCase(), String(item.value)]));
const csp = globalHeaderMap.get('content-security-policy') || '';

for (const key of ['x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy', 'content-security-policy']) {
  securityHeaderChecks += 1;
  if (!globalHeaderMap.has(key)) failures.push(`vercel.json: missing global ${key} header`);
}

for (const [ok, message] of [
  [csp.includes("frame-ancestors 'none'"), "vercel.json: CSP must include frame-ancestors 'none'"],
  [csp.includes("script-src 'self'"), "vercel.json: CSP script-src must be self-only"],
  [csp.includes("style-src 'self'"), "vercel.json: CSP style-src must be self-only"],
  [!csp.includes("'unsafe-inline'"), "vercel.json: CSP must not allow unsafe-inline"],
  [!csp.includes("'unsafe-eval'"), "vercel.json: CSP must not allow unsafe-eval"]
]) {
  cspChecks += 1;
  if (!ok) failures.push(message);
}

for (const [ok, message] of [
  [buildMeta.provider === 'vercel', `build receipt provider must be vercel, got ${buildMeta.provider}`],
  [buildMeta.provenanceClass === 'PROVIDER_BOUND', `build receipt must be PROVIDER_BOUND, got ${buildMeta.provenanceClass}`],
  [/^[0-9a-f]{40}$/i.test(buildMeta.sha), `build receipt must contain exact 40-char SHA, got ${buildMeta.sha}`],
  [typeof buildMeta.ref === 'string' && buildMeta.ref.trim().length > 0, 'build receipt must contain non-empty Vercel Git ref']
]) {
  provenanceChecks += 1;
  if (!ok) failures.push(message);
}

const immutableRule = headerRules.find(rule => rule.source === '/_astro/(.*)');
const immutableCache = immutableRule?.headers?.find(item => String(item.key).toLowerCase() === 'cache-control')?.value || '';
cacheChecks += 1;
if (!String(immutableCache).includes('immutable') || !String(immutableCache).includes('31536000')) failures.push('vercel.json: hashed Astro assets must use one-year immutable cache');

for (const domain of ['fonts.googleapis.com', 'fonts.gstatic.com']) {
  externalFontDomainChecks += 1;
  if (raw.includes(domain)) failures.push(`vercel.json: external font domain allowed by deployment policy ${domain}`);
}

routingChecks += 1;
if (vercelConfig.cleanUrls !== true) failures.push('vercel.json: cleanUrls must remain true');
routingChecks += 1;
if (vercelConfig.trailingSlash !== false) failures.push('vercel.json: trailingSlash must be false to enforce no-trailing-slash canonical routing');

if (failures.length) {
  console.error('VERCEL_POLICY_GATE=FAIL');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log(`VERCEL_POLICY_GATE=PASS security_header_checks=${securityHeaderChecks} csp_checks=${cspChecks} provenance_checks=${provenanceChecks} cache_checks=${cacheChecks} external_font_domain_checks=${externalFontDomainChecks} routing_checks=${routingChecks} failures=0`);
