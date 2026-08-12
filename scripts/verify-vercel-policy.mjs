import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const vercelConfigPath = fileURLToPath(new URL('../vercel.json', import.meta.url));
const failures = [];
let securityHeaderChecks = 0;
let cspChecks = 0;
let cacheChecks = 0;
let externalFontDomainChecks = 0;
let routingChecks = 0;

const raw = await readFile(vercelConfigPath, 'utf8');
const vercelConfig = JSON.parse(raw);
const headerRules = Array.isArray(vercelConfig.headers) ? vercelConfig.headers : [];
const globalHeaders = headerRules.find(rule => rule.source === '/(.*)')?.headers || [];
const globalHeaderMap = new Map(globalHeaders.map(item => [String(item.key).toLowerCase(), String(item.value)]));

for (const key of ['x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy', 'content-security-policy']) {
  securityHeaderChecks += 1;
  if (!globalHeaderMap.has(key)) failures.push(`vercel.json: missing global ${key} header`);
}

cspChecks += 1;
if (!globalHeaderMap.get('content-security-policy')?.includes("frame-ancestors 'none'")) {
  failures.push("vercel.json: CSP must include frame-ancestors 'none'");
}

const immutableRule = headerRules.find(rule => rule.source === '/_astro/(.*)');
const immutableCache = immutableRule?.headers?.find(item => String(item.key).toLowerCase() === 'cache-control')?.value || '';
cacheChecks += 1;
if (!String(immutableCache).includes('immutable') || !String(immutableCache).includes('31536000')) {
  failures.push('vercel.json: hashed Astro assets must use one-year immutable cache');
}

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

console.log(`VERCEL_POLICY_GATE=PASS security_header_checks=${securityHeaderChecks} csp_checks=${cspChecks} cache_checks=${cacheChecks} external_font_domain_checks=${externalFontDomainChecks} routing_checks=${routingChecks} failures=0`);
