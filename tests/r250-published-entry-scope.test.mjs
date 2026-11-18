import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const cases = [
  { file: 'src/pages/buyer-pack.astro', value: 'One action/authority boundary, up to 2 connected tools, 3–5 agreed failure/retry scenarios in staging/test or synthetic by default, with one in-scope retest if a corrected test artifact is provided within 14 calendar days after delivery of the finding memo and written testing authority remains valid. The USD 750 fee is credited in full toward the USD 2,450 Primary Audit if the Primary Audit is separately agreed in writing within 30 calendar days after delivery of the Entry finding memo.' },
  { file: 'src/pages/ru/buyer-pack.astro', value: 'Одна граница полномочий, до 2 подключённых инструментов, 3–5 согласованных сценариев сбоя/повтора в staging/test или на синтетике по умолчанию, одна повторная проверка исправления в исходной границе при получении тестового артефакта в течение 14 календарных дней после передачи заключения Entry и действующем письменном разрешении. Оплата $750 полностью засчитывается в $2,450 Primary Audit только если Primary Audit отдельно согласован письменно в течение 30 календарных дней после передачи заключения Entry.' },
  ...['false-green-and-retry-safety', 'mcp-and-coding-agent-governance'].flatMap(slug => [
    { file: `src/content/research-notes/${slug}.en.md`, expectedCount: slug === 'false-green-and-retry-safety' ? 2 : 1, value: 'One action/authority boundary, up to 2 connected tools, 3–5 agreed failure/retry scenarios in staging/test or synthetic by default, with one in-scope retest if a corrected test artifact is provided within 14 calendar days after delivery of the finding memo and written testing authority remains valid. The USD 750 fee is credited in full toward the USD 2,450 Primary Audit if the Primary Audit is separately agreed in writing within 30 calendar days after delivery of the Entry finding memo.' },
    { file: `src/content/research-notes/${slug}.ru.md`, expectedCount: slug === 'false-green-and-retry-safety' ? 2 : 1, value: 'Одна граница полномочий, до 2 подключённых инструментов, 3–5 согласованных сценариев сбоя/повтора в staging/test или на синтетике по умолчанию, одна повторная проверка исправления в исходной границе при получении тестового артефакта в течение 14 календарных дней после передачи заключения Entry и действующем письменном разрешении. Оплата $750 полностью засчитывается в $2,450 Primary Audit только если Primary Audit отдельно согласован письменно в течение 30 календарных дней после передачи заключения Entry.' }
  ])
];
for (const {file,value,expectedCount=1} of cases) test(`R250 public Entry Audit scope: ${file}`, () => {
  const source = readFileSync(new URL(file,root),'utf8');
  assert.equal(source.split(value).length - 1, expectedCount, 'exact canonical scope count in the target blocks');
  assert.doesNotMatch(source, /14 календарных дней после заключения Entry/u,
    'RU retest clock must start on delivery of finding memo, not ambiguous Entry conclusion');
  // Opus B1 negative fixture: canonical text may be present yet followed by broken punctuation.
  assert.doesNotMatch(source, /scope\.\s*[,;]|We test One action|охватывает Одна граница/u, 'no malformed scope join or capitalization regression');
  assert.doesNotMatch(source, /one staging workflow|one subsequent agent action|one follow-up agent action|One agreed staging\/test workflow|один staging-воркфлоу|одно последующее действие агента|Один согласованный staging\/test-воркфлоу/u);
  assert.match(source, /(?:\/ru\/entry-audit|\/entry-audit)/);
});
test('R250 research articles have no conflicting earlier Entry scope', () => {
  for (const lang of ['en','ru']) {
    const source=readFileSync(new URL(`src/content/research-notes/false-green-and-retry-safety.${lang}.md`,root),'utf8');
    assert.doesNotMatch(source, /one agreed staging workflow|один согласованный staging-процесс/u);
  }
});
test('R250 commercial source route metadata is current and exact', () => {
  const current=JSON.parse(readFileSync(new URL('src/data/sitemap-currentness.json',root),'utf8'));
  const expectedDates = {
    '/buyer-pack': '2026-11-16',
    '/ru/buyer-pack': '2026-11-16',
    '/guides/false-green-and-retry-safety': '2026-11-18',
    '/ru/guides/false-green-and-retry-safety': '2026-11-18',
    '/guides/mcp-and-coding-agent-governance': '2026-11-16',
    '/ru/guides/mcp-and-coding-agent-governance': '2026-11-16'
  };
  for (const [path, lastmod] of Object.entries(expectedDates)) {
    const row = current.routes.find(route => route.path === path);
    assert.equal(row?.lastmod, lastmod, path);
    assert.match(row.fingerprint, /^sha256:[0-9a-f]{64}$/);
  }
});

test('R21 A-D copy stays consistent across all published and machine-readable sources', () => {
  const affected = [
    "src/content/research-notes/false-green-and-retry-safety.en.md",
    "src/content/research-notes/false-green-and-retry-safety.ru.md",
    "src/content/research-notes/mcp-and-coding-agent-governance.en.md",
    "src/content/research-notes/mcp-and-coding-agent-governance.ru.md",
    "src/data/audit-measured-value-gate.json",
    "src/data/audit-paid-start-gate.json",
    "src/data/audit-proposal-readiness.json",
    "src/data/audit-renewal-expansion-gate.json",
    "src/data/ru-semantic-parity.json",
    "src/pages/build.astro",
    "src/pages/buyer-pack.astro",
    "src/pages/consequential-actions.astro",
    "src/pages/consulting.astro",
    "src/pages/entry-audit-vs-pentest-ai-security-grc.astro",
    "src/pages/entry-audit.astro",
    "src/pages/index.astro",
    "src/pages/llms.txt.ts",
    "src/pages/operator.astro",
    "src/pages/pricing.astro",
    "src/pages/ru/buyer-pack.astro",
    "src/pages/ru/consulting.astro",
    "src/pages/ru/entry-audit-vs-pentest-ai-security-grc.astro",
    "src/pages/ru/index.astro",
    "src/pages/ru/pricing.astro",
    "src/pages/start.astro"
  ];
  const all = affected.map(file => readFileSync(new URL(file, root), 'utf8')).join('\n');
  assert.doesNotMatch(all, /booked within 30 days|contracted within 30 days|при заказе в течение 30 дней|24 hours on business days|24 часа в рабочие дни|one retest within 14 days|один retest в течение 14 дней|free%2024-hour/i, 'retired commercial promises must stay retired');
  assert.match(all, /30 calendar days/);
  assert.match(all, /30 календарных дней/);
  assert.match(all, /14 calendar days/);
  assert.match(all, /14 календарных дней/);
  assert.match(all, /non-binding response target/);
  assert.match(all, /не договорной SLA/);
  assert.match(all, /one business day/);
  assert.match(all, /одного рабочего дня/);
  const pricing = readFileSync(new URL('src/pages/pricing.astro',root),'utf8');
  const ruPricing = readFileSync(new URL('src/pages/ru/pricing.astro',root),'utf8');
  assert.match(pricing, /price: '750'/);
  assert.match(ruPricing, /name: 'Entry Audit', price: '\$750'/);
  assert.match(pricing, /price: '2450'/);
});
