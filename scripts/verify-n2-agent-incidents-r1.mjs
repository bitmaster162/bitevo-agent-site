import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { checks += 1; assert.ok(value, message); };
const equal = (actual, expected, message) => { checks += 1; assert.equal(actual, expected, message); };
const root = new URL('../', import.meta.url);

const rawData = await readFile(new URL('src/data/agent-incidents.json', root), 'utf8');
const rawDates = await readFile(new URL('src/data/agent-incident-source-dates.json', root), 'utf8');
const incidents = JSON.parse(rawData.replace(/^\uFEFF/, ''));
const sourceDates = JSON.parse(rawDates.replace(/^\uFEFF/, ''));
const pageSource = await readFile(new URL('src/pages/agent-incidents.astro', root), 'utf8');
const filterJs = await readFile(new URL('public/agent-incidents.js', root), 'utf8');
const owaspSource = await readFile(new URL('src/pages/owasp-agentic-top-10.astro', root), 'utf8');
const auditSource = await readFile(new URL('src/pages/agent-authority-audit.astro', root), 'utf8');
const layoutSource = await readFile(new URL('src/layouts/Layout.astro', root), 'utf8');
const registry = JSON.parse(await readFile(new URL('src/data/public-route-registry.json', root), 'utf8'));
const currentness = JSON.parse(await readFile(new URL('src/data/sitemap-currentness.json', root), 'utf8'));
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const html = await readFile(new URL('dist/agent-incidents/index.html', root), 'utf8');
const sitemap = await readFile(new URL('dist/sitemap.xml', root), 'utf8');
const llms = await readFile(new URL('dist/llms.txt', root), 'utf8');

const sha = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
equal(sha(rawData), '9e40080b847d283cd3f841d2b011d6c2e7c67abdb3f799d37e615ac9e43f3702', 'canonical N2 incident JSON hash');
equal(sha(rawDates), '4e9f32300b54436c4273c5e093737bf23139cbe8b512b86ef2b7157230b19552', 'verified source-date registry hash');

const ids = Array.from({ length: 12 }, (_, i) => `INC-${String(i + 1).padStart(2, '0')}`);
equal(incidents.length, 12, 'exact incident count');
equal(incidents.map(item => item.id).join('|'), ids.join('|'), 'incident IDs ordered and complete');
equal(incidents.filter(item => item.type === 'incident').length, 11, 'eleven incidents');
equal(incidents.filter(item => item.type === 'demonstration').length, 1, 'one demonstration');
equal(incidents.find(item => item.id === 'INC-12')?.type, 'demonstration', 'INC-12 is the demonstration');

const sourceUrls = incidents.flatMap(item => item.sources);
equal(sourceUrls.length, 21, 'source URL count exact');
equal(Object.keys(sourceDates).length, 21, 'source publication-date count exact');
for (const url of sourceUrls) {
  check(/^https:\/\//.test(url), `source URL is HTTPS: ${url}`);
  check(/^\d{4}-\d{2}-\d{2}$/.test(sourceDates[url] ?? ''), `source publication date exists: ${url}`);
}

const h1 = 'Agent incidents: what action-capable AI did, and what evidence would have caught it';
const lead = 'Public, sourced cases where an AI agent or assistant with the power to act changed something it should not have — or was shown it could. For each: what happened, which of our seven gates it touches, the OWASP Agentic risk, and the record that would have prevented or proven it.';
const title = 'AI agent incidents library — authority, evidence, recovery | BitEvo';
const description = '12 sourced cases of AI agents deleting data, leaking repos or acting without approval, mapped to OWASP Agentic Top 10 and seven evidence gates.';

check(pageSource.includes(h1) && pageSource.includes(lead), 'N2 approved H1 and lead preserved in source');
check(html.includes(h1) && html.includes(lead), 'N2 approved H1 and lead rendered');
check(html.includes(`<title>${title}</title>`), 'SEO title exact');
check(html.includes(`<meta name="description" content="${description}">`), 'SEO description exact');
check(html.includes('<link rel="canonical" href="https://bitevo.work/agent-incidents">'), 'canonical exact');

equal((html.match(/data-incident-id=/g) || []).length, 12, 'twelve rendered incident cards');
for (const id of ids) equal((html.match(new RegExp(`data-incident-id="${id}"`, 'g')) || []).length, 1, `${id} rendered exactly once`);
equal((html.match(/>Demonstration</g) || []).length, 1, 'one Demonstration label');
equal((html.match(/>Self-reported</g) || []).length, 2, 'two Self-reported labels');
equal((html.match(/>Disputed</g) || []).length, 1, 'one Disputed label');

const gates = [
  'Authority Budget',
  'Evidence Before Effect',
  'Object binding',
  'Freshness',
  'External confirmation',
  'Recovery',
  'Authority owner'
];
for (const gate of gates) check(html.includes(`data-gate-filter="${gate}"`), `gate filter rendered: ${gate}`);
for (let i = 1; i <= 10; i++) {
  const asi = `ASI${String(i).padStart(2, '0')}`;
  check(html.includes(`data-asi-filter="${asi}"`), `ASI filter rendered: ${asi}`);
}
equal((html.match(/data-gate-filter=/g) || []).length, 7, 'seven gate filters exact');
equal((html.match(/data-asi-filter=/g) || []).length, 10, 'ten ASI filters exact');
check(!html.includes('type="search"') && !pageSource.toLowerCase().includes('total lost'), 'no search control or aggregate loss counter');
check(pageSource.includes('<script is:inline src="/agent-incidents.js" defer></script>'), 'filter script is external same-origin asset');
check(!/(?:fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket\s*\()/i.test(filterJs), 'client filter adds no network behavior');

for (const url of sourceUrls) {
  check(html.includes(`href="${url}"`), `source link rendered: ${url}`);
  check(html.includes(`datetime="${sourceDates[url]}"`), `source publication date rendered: ${url}`);
}
for (const anchor of html.matchAll(/<a\b[^>]*href=["']https?:\/\/[^"']+["'][^>]*>/gi)) {
  check(/\brel=["'][^"']*\bnoopener\b[^"']*["']/i.test(anchor[0]), 'external source link has rel=noopener');
}

check(html.includes('Cases are summarised from the linked public sources as of 1 October 2026. BitEvo was not involved in any of them.'), 'required non-involvement boundary rendered');
check(html.includes('href="mailto:robert@bitevo.work"'), 'corrections route uses confirmed BitEvo address');

check(owaspSource.includes('href="/agent-incidents"'), 'OWASP page links to incident library');
check(auditSource.includes('href="/agent-incidents"'), 'Agent Authority Audit links to incident library');
check(layoutSource.includes("['Agent incidents', '/agent-incidents']"), 'EN footer links to incident library');

const route = registry.routes.find(item => item.path === '/agent-incidents');
check(route?.category === 'RESEARCH' && route?.indexable === true && route?.locale === 'en' && route?.parent === '/owasp-agentic-top-10' && route?.localePair === 'deferred' && route?.localePairReason === 'grounded_translation_pending', 'registry route exact with grounded deferred locale contract');
equal(registry.routes.filter(item => item.indexable).length, 123, 'indexable route count is N2 baseline');
equal(registry.routes.filter(item => item.indexable && item.locale === 'en').length, 62, 'EN indexable route count is N2 baseline');
equal(registry.routes.filter(item => item.indexable && item.locale === 'ru').length, 61, 'RU indexable route count unchanged');
check(!registry.routes.some(item => item.path === '/ru/agent-incidents'), 'RU route deferred pending grounded translation');
check(!html.includes('hreflang="ru"') && !html.includes('data-global-locale-switch="en-to-ru"'), 'deferred EN route emits no false RU alternate or switch');
let ruPageExists = true;
try { await access(new URL('src/pages/ru/agent-incidents.astro', root)); } catch { ruPageExists = false; }
equal(ruPageExists, false, 'RU page is not created without grounded translation');

const row = currentness.routes.find(item => item.path === '/agent-incidents');
check(Boolean(row), 'N2 currentness row exists');
equal(row?.lastmod, '2026-10-05', 'N2 sitemap currentness date exact');
check(/^sha256:[0-9a-f]{64}$/.test(row?.fingerprint ?? ''), 'N2 currentness fingerprint valid');
equal(currentness.routes.length, 123, 'currentness route count is N2 baseline');
check(sitemap.includes('<loc>https://bitevo.work/agent-incidents</loc><lastmod>2026-10-05</lastmod>'), 'sitemap includes N2 exact route/date');

const researchStart = llms.indexOf('### Research');
const contextStart = llms.indexOf('### Context', researchStart);
check(researchStart >= 0 && contextStart > researchStart, 'llms Research section boundaries');
check(llms.slice(researchStart, contextStart).includes('- /agent-incidents'), 'llms Research includes incident library');

check(packageJson.scripts?.['verify:core']?.includes('verify-n2-agent-incidents-r1.mjs'), 'N2 verifier wired into verify:core');

console.log(`N2_AGENT_INCIDENTS_R1_GATE=PASS checks=${checks} cases=12 incidents=11 demonstrations=1 sources=21 source_dates=21 filters=7x10 indexable=123 en=62 ru=61 ru_route=DEFERRED no_search=PASS network_added=0`);
