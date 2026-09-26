import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const valueOf = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const baseInput = valueOf('--base-url');
if (!baseInput) {
  console.error('LIVE_HEADERS_VERIFY=FAIL missing --base-url');
  process.exit(2);
}
const base = new URL(baseInput);
if (base.protocol !== 'https:' || base.username || base.password) {
  console.error('LIVE_HEADERS_VERIFY=FAIL base URL must be credential-free HTTPS');
  process.exit(2);
}
base.pathname = '/';
base.search = '';
base.hash = '';

const expectedCountRaw = valueOf('--expected-count');
const expectedCount = expectedCountRaw === undefined ? null : Number(expectedCountRaw);
if (expectedCount !== null && (!Number.isInteger(expectedCount) || expectedCount < 1)) {
  console.error('LIVE_HEADERS_VERIFY=FAIL --expected-count must be a positive integer');
  process.exit(2);
}

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const globalHeaders = (config.headers || []).find((rule) => rule.source === '/(.*)')?.headers || [];
const globalMap = new Map(globalHeaders.map((item) => [String(item.key).toLowerCase(), String(item.value)]));
const required = [
  'content-security-policy',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'cross-origin-opener-policy',
];
const failures = [];
for (const key of required) {
  if (!globalMap.get(key)) failures.push('local config missing expected ' + key);
}

const request = async (url, init = {}) => {
  try {
    return await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
      headers: { 'user-agent': 'bitevo-live-header-verifier/1' },
      ...init,
    });
  } catch (error) {
    failures.push(String(url) + ': fetch failed: ' + (error instanceof Error ? error.message : String(error)));
    return null;
  }
};

const verifyHeaders = (label, response) => {
  if (!response) return;
  for (const key of required) {
    const actual = response.headers.get(key);
    const expected = globalMap.get(key);
    if (actual !== expected) {
      failures.push(label + ': ' + key + ' mismatch expected=' + JSON.stringify(expected) + ' actual=' + JSON.stringify(actual));
    }
  }
};

const sitemapResponse = await request(new URL('/sitemap.xml', base));
if (!sitemapResponse || sitemapResponse.status !== 200) {
  failures.push('sitemap: expected 200, got ' + (sitemapResponse?.status ?? 'no response'));
}
const sitemapXml = sitemapResponse ? await sitemapResponse.text() : '';
const sitemapLocs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const paths = [...new Set(sitemapLocs.map((loc) => {
  const parsed = new URL(loc);
  return parsed.pathname + parsed.search;
}))];
if (expectedCount !== null && paths.length !== expectedCount) {
  failures.push('sitemap URL count expected=' + expectedCount + ' actual=' + paths.length);
}
if (paths.length === 0) failures.push('sitemap contains no URLs');

let nextIndex = 0;
const worker = async () => {
  while (true) {
    const index = nextIndex++;
    if (index >= paths.length) return;
    const path = paths[index];
    const response = await request(new URL(path, base), { method: 'HEAD' });
    if (!response) continue;
    if (response.status !== 200) {
      failures.push(path + ': expected 200, got ' + response.status);
      continue;
    }
    verifyHeaders(path, response);
  }
};
await Promise.all(Array.from({ length: Math.min(12, Math.max(paths.length, 1)) }, worker));

const intakeResponse = await request(new URL('/intake', base), { method: 'HEAD' });
if (intakeResponse) {
  if (intakeResponse.status !== 308) failures.push('/intake: expected 308, got ' + intakeResponse.status);
  const location = intakeResponse.headers.get('location');
  const locationPath = location ? new URL(location, base).pathname : null;
  if (locationPath !== '/audit-intake') failures.push('/intake: Location expected /audit-intake, got ' + JSON.stringify(location));
  verifyHeaders('/intake', intakeResponse);
}

const missingPath = '/ru/__p24_live_headers_missing__';
const ru404Response = await request(new URL(missingPath, base));
let ru404Text = '';
if (ru404Response) {
  if (ru404Response.status !== 404) failures.push(missingPath + ': expected 404, got ' + ru404Response.status);
  verifyHeaders(missingPath, ru404Response);
  ru404Text = await ru404Response.text();
  if (!/<html\b[^>]*\blang="ru"/i.test(ru404Text)) failures.push(missingPath + ': missing lang=ru');
  if (!ru404Text.includes('404 — Страница не найдена | BitEvo')) failures.push(missingPath + ': missing Russian 404 title');
  if (!ru404Text.includes('Маршрут не найден') || !ru404Text.includes('По этому адресу нет доступной страницы.')) {
    failures.push(missingPath + ': missing Russian 404 content');
  }
}

if (failures.length) {
  console.error('LIVE_HEADERS_VERIFY=FAIL base=' + base.origin + ' sitemap_urls=' + paths.length + ' failures=' + failures.length);
  const detailLimit = 24;
  for (const failure of failures.slice(0, detailLimit)) console.error('- ' + failure);
  if (failures.length > detailLimit) console.error('- additional_failures_omitted=' + (failures.length - detailLimit));
  process.exit(1);
}
console.log(
  'LIVE_HEADERS_VERIFY=PASS base=' + base.origin + ' sitemap_urls=' + paths.length + ' headers=' + required.length +
  ' header_observations=' + (paths.length * required.length) + ' intake_status=' + intakeResponse.status +
  ' ru404_status=' + ru404Response.status + ' ru404_lang=ru failures=0'
);
