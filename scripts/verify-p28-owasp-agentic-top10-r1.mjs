import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };
const root = new URL('../', import.meta.url);

const enSource = await readFile(new URL('src/pages/owasp-agentic-top-10.astro', root), 'utf8');
const ruSource = await readFile(new URL('src/pages/ru/owasp-agentic-top-10.astro', root), 'utf8');
const auditSource = await readFile(new URL('src/pages/agent-authority-audit.astro', root), 'utf8');
const pricingSource = await readFile(new URL('src/pages/pricing.astro', root), 'utf8');
const registry = JSON.parse(await readFile(new URL('src/data/public-route-registry.json', root), 'utf8'));
const currentness = JSON.parse(await readFile(new URL('src/data/sitemap-currentness.json', root), 'utf8'));
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const enHtml = await readFile(new URL('dist/owasp-agentic-top-10/index.html', root), 'utf8');
const ruHtml = await readFile(new URL('dist/ru/owasp-agentic-top-10/index.html', root), 'utf8');
const visible = html => html.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&#x27;', "'");
const enVisible = visible(enHtml);
const ruVisible = visible(ruHtml);

const sourceUrl = 'https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/';
const h1 = 'OWASP Top 10 for Agentic Applications, mapped to what BitEvo tests';
const lead = 'OWASP published its Top 10 for Agentic Applications on 9 December 2025. BitEvo audits the action chain of one workflow in staging or test. The table shows which of our seven gates reach each risk, what evidence we look for, and where our scope stops.';
const rows = [
  ['ASI01','Agent Goal Hijack',['Authority Budget','Evidence Before Effect'],'The attempted action and the rule that allowed or refused it','We test what a hijacked agent can still do, not whether the model resists injected text'],
  ['ASI02','Tool Misuse and Exploitation',['Authority Budget','Object binding'],'The object ID checked before execution, and the ID that actually changed','Core scope'],
  ['ASI03','Identity and Privilege Abuse',['Authority owner','Authority Budget'],'The grant or approval record that links the role to the action','Core scope'],
  ['ASI04','Agentic Supply Chain Vulnerabilities',['Authority Budget'],'Which third-party tools and MCP servers can act, and with what permissions','We map their authority; we do not audit their code'],
  ['ASI05','Unexpected Code Execution (RCE)',['Authority Budget'],'Whether code execution is an allowed action at all, and for which inputs','Exploit development is out of scope'],
  ['ASI06','Memory & Context Poisoning',['Freshness','Evidence Before Effect'],'Time, source and version of each item the agent relied on at decision time','We test whether stale or unverified context can trigger an action'],
  ['ASI07','Insecure Inter-Agent Communication',['Authority owner','External confirmation'],'Who delegated authority between agents, and independent confirmation of the effect','Within the one workflow in scope'],
  ['ASI08','Cascading Failures',['Recovery','External confirmation'],'The state change when confirmation is missing, and who released the workflow','Core scope: retries, resume, duplicate effects'],
  ['ASI09','Human-Agent Trust Exploitation',['External confirmation','Authority owner'],'Whether "done" was reported before the external system confirmed it, and what the approver was shown','We test approval evidence, not user training'],
  ['ASI10','Rogue Agents',['Authority Budget','Recovery'],'Actions outside the agreed budget, and the stop or constrained state that follows','Detection tooling is out of scope']
];

check(enSource.includes(h1) && enSource.includes(lead), 'EN source preserves approved Turn 11 H1 and lead');
check(enHtml.includes(h1) && enHtml.includes(lead), 'EN H1 and lead exist in static HTML');
equal((enHtml.match(/data-asi="ASI\d{2}"/g) || []).length, 10, 'EN renders exactly ten ASI rows');
equal((ruHtml.match(/data-asi="ASI\d{2}"/g) || []).length, 10, 'RU renders exactly ten ASI rows');

for (const [id,name,gates,evidence,scope] of rows) {
  for (const source of [enSource, ruSource]) {
    check(source.includes(id) && source.includes(name), `${id}: exact risk id/name present in both sources`);
    for (const gate of gates) check(source.includes(gate), `${id}: exact gate ${gate} present`);
    check(source.includes(evidence), `${id}: exact evidence text present`);
    check(source.includes(scope), `${id}: exact scope note present`);
  }
  check(enVisible.includes(id) && enVisible.includes(name) && enVisible.includes(evidence) && enVisible.includes(scope), `${id}: EN static HTML preserves mapping`);
  check(ruVisible.includes(id) && ruVisible.includes(name) && ruVisible.includes(evidence) && ruVisible.includes(scope), `${id}: RU static HTML preserves substantive EN mapping`);
}

check(enHtml.includes(sourceUrl) && ruHtml.includes(sourceUrl), 'official OWASP source link is present in both static pages');
check(enHtml.includes('Not an OWASP certification or endorsement.'), 'EN certification boundary exact');
check(ruHtml.includes('Это не сертификация и не одобрение OWASP.'), 'RU wrapper preserves certification boundary');
check(!enSource.includes('href="/pre-check"') && !ruSource.includes('href="/pre-check"'), 'deferred Pre-Check CTA is not published');
check(!enSource.includes('[booking-url]') && !ruSource.includes('[booking-url]'), 'booking placeholder is not published');
check(auditSource.includes('href="/owasp-agentic-top-10"') && pricingSource.includes('href="/owasp-agentic-top-10"'), 'required EN internal links are visible in source');

const enRoute = registry.routes.find(row => row.path === '/owasp-agentic-top-10');
const ruRoute = registry.routes.find(row => row.path === '/ru/owasp-agentic-top-10');
check(enRoute?.category === 'RESEARCH' && enRoute?.indexable === true && enRoute?.locale === 'en' && enRoute?.parent === '/agent-authority-audit', 'EN registry route exact');
check(ruRoute?.category === 'RESEARCH' && ruRoute?.indexable === true && ruRoute?.locale === 'ru' && ruRoute?.parent === '/ru/agent-authority-audit', 'RU registry route exact');
equal(registry.routes.filter(row => row.indexable).length, 110, 'indexable route count is 110');
equal(registry.routes.filter(row => row.indexable && row.locale === 'en').length, 55, 'EN indexable route count is 55');
equal(registry.routes.filter(row => row.indexable && row.locale === 'ru').length, 55, 'RU indexable route count is 55');

const expectedCurrentness = {
  '/agent-authority-audit':'sha256:29fe3d7772c41678a964d99ac275b9a3c2c530502da261bafe8ba7fd9248c556',
  '/owasp-agentic-top-10':'sha256:4f8d2b58079cef11abea0033eefb00bb44bdc11a3ff1656feaafbd6a9ed1d2ff',
  '/pricing':'sha256:c39a6c135341211fa8e2246d5a482dc0bf69e9ff287897b3fc5600fe02b5671a',
  '/ru/owasp-agentic-top-10':'sha256:690e445dfd9c562fa495c94553657fb79816556dae7f2636b415c297a2647770'
};
for (const [path,fingerprint] of Object.entries(expectedCurrentness)) {
  const row = currentness.routes.find(item => item.path === path);
  check(row?.lastmod === '2026-10-02' && row?.fingerprint === fingerprint, `currentness exact for ${path}`);
}
equal(currentness.routes.length, 110, 'currentness route count is 110');
check(packageJson.scripts?.['verify:core']?.includes('verify-p28-owasp-agentic-top10-r1.mjs'), 'P28.6 verifier is wired into verify:core');

console.log(`P28_OWASP_AGENTIC_TOP10_R1_GATE=PASS checks=${checks} rows=10 indexable=110 en=55 ru=55 static_html=PASS source_link=BOUND deferred_precheck=OMITTED deferred_booking=OMITTED js_required=0`);
