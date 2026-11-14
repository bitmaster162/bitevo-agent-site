import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const base = new URL('../', import.meta.url);
const src = (path) => readFileSync(new URL(path, base), 'utf8');
const json = (path) => JSON.parse(src(path));

test('R11 EN and RU pricing expose only approved Entry and Primary prices', () => {
  for (const route of ['pricing', 'ru/pricing']) {
    const text = src(`src/pages/${route}.astro`);
    assert.match(text, /\$750/, route);
    assert.match(text, /\$2,450/, route);
    assert.doesNotMatch(text, /\$1,500|\$4,900|USD 1,500|USD 4,900/, route);
    assert.match(text, /price: '750'.*name: 'Entry Audit'/, route);
    assert.match(text, /price: '2450'.*name: 'Agent Authority & Evidence Audit'/, route);
  }
});

test('R11 published EN/RU commercial starts preserve pricing and retire standalone SCV', () => {
  const enStart = src('src/pages/start.astro');
  const ruParity = json('src/data/ru-semantic-parity.json');
  const ruStart = ruParity.pages.find(x => x.slug === 'start');
  assert.match(enStart, /\$750 Entry Audit/);
  assert.match(enStart, /\$2,450 Primary Audit/);
  assert.match(enStart, /Security Control Validation \(included in Entry Audit\)/);
  assert.doesNotMatch(enStart, /\$1,500 Security Control Validation/);
  assert.match(ruStart.description, /Entry Audit \$750/);
  assert.match(ruStart.description, /Primary Audit \$2,450/);
  assert.match(ruStart.description, /Security Control Validation в составе Entry Audit/);
  assert.doesNotMatch(ruStart.description, /Security Control Validation \$1,500/);
});

test('R11 consulting EN/RU sell Entry with SCV included and preserve BUILD', () => {
  for (const path of ['consulting', 'ru/consulting']) {
    const text = src(`src/pages/${path}.astro`);
    assert.match(text, /\$750/);
    assert.match(text, /\$2,450/);
    assert.match(text, /Security Control Validation/);
    assert.match(text, /\$3,000/);
    assert.doesNotMatch(text, /\$1,500|\$4,900/, path);
  }
  assert.match(src('src/pages/consulting.astro'), /Included in Entry Audit/);
  assert.match(src('src/pages/ru/consulting.astro'), /В составе Entry Audit/);
});

test('R11 independent Evidence Readiness $1,500 preserved; former SCV is Entry $750', () => {
  const assurance = src('src/pages/assurance.astro');
  assert.match(assurance, /name: 'AI Evidence Readiness Sprint', price: '1500'/);
  assert.match(assurance, /name: 'Entry Audit \(including Security Control Validation\)', price: '750'/);
  assert.match(assurance, /name: 'Agent Authority & Evidence Primary Audit', price: '2450'/);
  assert.match(assurance, /<strong>\$1,500<\/strong><span>fixed · one AI product\/workflow<\/span>/);
  assert.doesNotMatch(assurance, /name: 'Security Control Validation', price: '1500'/);
  assert.match(src('src/pages/evidence-readiness.astro'), /fixed \$1,500/);
});

test('R11 legacy offer alias resolves to Entry without enabling payment or testing', () => {
  const files = ['audit-proposal-readiness','audit-paid-start-gate',
    'audit-measured-value-gate','audit-renewal-expansion-gate'];
  for (const file of files) {
    const manifest = json(`src/data/${file}.json`);
    const lookup = Object.fromEntries(manifest.offer_query_allowlist.map(x => [x.key,x]));
    assert.equal(lookup['entry-audit'].price_usd,750);
    assert.equal(lookup['primary-agent-authority-audit'].price_usd,2450);
    const scv = lookup['security-control-validation'];
    assert.equal(scv.price_usd,750);
    assert.match(scv.name,/included in Entry Audit/);
    assert.match(scv.scope,/not a separate purchasable service/);
    if (manifest.effect_boundary) {
      assert.equal(manifest.effect_boundary.network_write,0);
      assert.equal(manifest.effect_boundary.storage_write,0);
      assert.equal(manifest.effect_boundary.external_effect,0);
    }
    if (manifest.payment_boundary) assert.equal(manifest.payment_boundary.public_site_accepts_payment,false);
  }
  const controller = src('public/intake-segmentation.js');
  assert.match(controller, /Security Control Validation \(included in Entry Audit \$750\)/);
  assert.doesNotMatch(controller, /Security Control Validation \(\$1,500\)/);
});

test('R11 other SKU prices are explicitly unchanged', () => {
  const pricing = src('src/pages/pricing.astro');
  const build = src('src/pages/build.astro');
  const start = src('src/pages/start.astro');
  assert.match(pricing, /price: '3000'.*BUILD Workflow Exception Diagnostic/);
  assert.match(start, /\$3,000 BUILD Workflow Exception Diagnostic/);
  assert.match(start, /Team Twin pilot · \$3,000 fixed/);
  assert.match(start, /Company Twin · 12 months · from \$9,000; support from \$500 per month/);
  assert.match(build, /\$750 Entry Audit/);
  const parity=json('src/data/ru-semantic-parity.json');
  const evidence=parity.pages.find(x => x.slug === 'evidence-readiness');
  assert.match(evidence.description,/\$1,500/);
});

test('R11 llms.txt sells approved prices but not separate SCV', () => {
  const text = src('src/pages/llms.txt.ts');
  assert.match(text,/Entry Audit USD 750/);
  assert.match(text,/Primary.*USD 2,450/);
  assert.match(text,/Security Control Validation included in Entry Audit/);
  assert.doesNotMatch(text,/Security Control Validation USD 1,500/);
});

test('R11 rendered EN/RU pages show approved prices; free review is not paid SLA', () => {
  for (const path of ['pricing','ru/pricing','start','consulting','ru/consulting']) {
    const html=src(`dist/${path}/index.html`);
    assert.match(html,/\$750/,path);
    assert.match(html,/\$2,450/,path);
    assert.doesNotMatch(html,/\$4,900/,path);
    if (path !== 'pricing') assert.doesNotMatch(html,/\$1,500 Entry Audit/,path);
  }
  const start = src('dist/start/index.html');
  assert.match(start,/Within 24 hours on business days/);
  assert.match(start,/free one-page review/);
  assert.doesNotMatch(start,/Entry Audit (?:delivered|completed) in 24 hours/i);
});
