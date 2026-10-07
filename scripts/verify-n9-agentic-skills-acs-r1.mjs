import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const astEn = await read('src/pages/owasp-agentic-skills-top-10.astro');
const astRu = await read('src/pages/ru/owasp-agentic-skills-top-10.astro');
const acsEn = await read('src/pages/agent-control-standard.astro');
const acsRu = await read('src/pages/ru/agent-control-standard.astro');
const astEnHtml = await read('dist/owasp-agentic-skills-top-10/index.html');
const astRuHtml = await read('dist/ru/owasp-agentic-skills-top-10/index.html');
const acsEnHtml = await read('dist/agent-control-standard/index.html');
const acsRuHtml = await read('dist/ru/agent-control-standard/index.html');
const registry = JSON.parse(await read('src/data/public-route-registry.json'));
const currentness = JSON.parse(await read('src/data/sitemap-currentness.json'));
const packageJson = JSON.parse(await read('package.json'));

const astNames = [
  ['AST01','Malicious Skills'],
  ['AST02','Supply Chain Compromise'],
  ['AST03','Over-Privileged Skills'],
  ['AST04','Insecure Metadata'],
  ['AST05','Untrusted External Instructions'],
  ['AST06','Weak Isolation'],
  ['AST07','Update Drift'],
  ['AST08','Poor Scanning'],
  ['AST09','No Governance'],
  ['AST10','Cross-Platform Reuse']
];

for (const [id,name] of astNames) {
  for (const source of [astEn, astRu]) {
    check(source.includes(id), id + ' exact id present in source');
    check(source.includes(name), id + ' current official risk name present in source');
  }
  for (const html of [astEnHtml, astRuHtml]) {
    check(html.includes(id) && html.includes(name), id + ' rendered in static HTML');
  }
}
equal((astEnHtml.match(/data-ast="AST\d{2}"/g) || []).length, 10, 'EN renders exactly ten AST rows');
equal((astRuHtml.match(/data-ast="AST\d{2}"/g) || []).length, 10, 'RU renders exactly ten AST rows');
check(!astEn.includes('Unsafe Deserialization') && !astRu.includes('Unsafe Deserialization'), 'superseded AST05 label is not published');
check(astEn.includes('https://owasp.org/projects/agentic-skills-top-10') && astRu.includes('https://owasp.org/projects/agentic-skills-top-10'), 'official OWASP AST10 source bound');
check(astEn.includes('Not an OWASP certification or endorsement.'), 'EN AST certification boundary exact');
check(astRu.includes('Это не сертификация и не одобрение OWASP.'), 'RU AST certification boundary exact');

const profileIds = ['acs-core','acs-trace','acs-inspect','acs-inspect-dynamic','acs-provenance','acs-crypto','acs-audit'];
for (const id of profileIds) {
  for (const source of [acsEn, acsRu]) check(source.includes(id), id + ' exact profile id present in source');
  for (const html of [acsEnHtml, acsRuHtml]) check(html.includes('data-acs-profile="' + id + '"'), id + ' rendered in static HTML');
}
equal((acsEnHtml.match(/data-acs-profile="acs-[^"]+"/g) || []).length, 7, 'EN renders exactly seven ACS profile rows');
equal((acsRuHtml.match(/data-acs-profile="acs-[^"]+"/g) || []).length, 7, 'RU renders exactly seven ACS profile rows');
for (const source of [acsEn,acsRu]) {
  check(source.includes('v0.1.0'), 'ACS current baseline version stated');
  check(source.includes('1 September 2026') || source.includes('1 сентября 2026'), 'ACS OWASP addition date stated');
  check(source.includes('https://genai.owasp.org/resource/agent-control-standard-acs/'), 'official ACS OWASP source bound');
  check(source.includes('https://github.com/GenAI-Security-Project/agent-control-standard'), 'ACS specification repository bound');
}
check(acsEn.includes('not an ACS implementation, conformance test or certification claim'), 'EN ACS non-conformance boundary exact');
check(acsRu.includes('не заявление о реализации ACS, conformance test или certification'), 'RU ACS non-conformance boundary exact');
check(!acsEn.includes('BitEvo implements ACS') && !acsRu.includes('BitEvo реализует ACS'), 'no ACS implementation claim');

const expectedRoutes = [
  ['/owasp-agentic-skills-top-10','en','/owasp-agentic-top-10'],
  ['/agent-control-standard','en','/owasp-agentic-top-10'],
  ['/ru/owasp-agentic-skills-top-10','ru','/ru/owasp-agentic-top-10'],
  ['/ru/agent-control-standard','ru','/ru/owasp-agentic-top-10']
];
for (const [path,locale,parent] of expectedRoutes) {
  const row = registry.routes.find(item => item.path === path);
  check(row?.category === 'RESEARCH' && row?.indexable === true && row?.locale === locale && row?.parent === parent, path + ' registry binding exact');
  const current = currentness.routes.find(item => item.path === path);
  check(/^\d{4}-\d{2}-\d{2}$/.test(String(current?.lastmod || '')), path + ' currentness date valid');
  check(/^sha256:[0-9a-f]{64}$/.test(String(current?.fingerprint || '')), path + ' currentness fingerprint valid');
}
equal(registry.routes.filter(row => row.indexable).length, 129, 'indexable route count N9 baseline');
equal(registry.routes.filter(row => row.indexable && row.locale === 'en').length, 65, 'EN indexable route count N9 baseline');
equal(registry.routes.filter(row => row.indexable && row.locale === 'ru').length, 64, 'RU indexable route count N9 baseline');
equal(currentness.routes.length, 129, 'currentness route count N9 baseline');
check(packageJson.scripts?.['verify:core']?.includes('verify-n9-agentic-skills-acs-r1.mjs'), 'N9 verifier wired into verify:core');

console.log(
  'N9_AGENTIC_SKILLS_ACS_R1_GATE=PASS checks=' + checks +
  ' ast_rows=10 acs_profiles=7 routes=4 indexable=129 en=65 ru=64' +
  ' ast05=CURRENT acs_v=0.1.0 owaps_sources=BOUND certification_claim=0 implementation_claim=0'
);
