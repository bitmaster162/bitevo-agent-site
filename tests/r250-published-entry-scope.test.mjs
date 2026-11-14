import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const cases = [
  { file: 'src/pages/buyer-pack.astro', value: 'One action/authority boundary, up to 2 connected tools, 3–5 agreed failure/retry scenarios in staging/test or synthetic by default, with one retest within 14 days of the finding memo. The USD 750 fee is credited in full toward the USD 2,450 Primary Audit if booked within 30 days of the finding memo under a separate written scope.' },
  { file: 'src/pages/ru/buyer-pack.astro', value: 'Одна граница полномочий, до 2 подключённых инструментов, 3–5 согласованных сценариев сбоя/повтора в staging/test или на синтетике по умолчанию, один retest в течение 14 дней после finding memo. Оплата $750 полностью засчитывается в $2,450 Primary Audit при заказе в течение 30 дней после finding memo по отдельному письменному scope.' },
  ...['false-green-and-retry-safety', 'mcp-and-coding-agent-governance'].flatMap(slug => [
    { file: `src/content/research-notes/${slug}.en.md`, expectedCount: slug === 'false-green-and-retry-safety' ? 2 : 1, value: 'One action/authority boundary, up to 2 connected tools, 3–5 agreed failure/retry scenarios in staging/test or synthetic by default, with one retest within 14 days of the finding memo. The USD 750 fee is credited in full toward the USD 2,450 Primary Audit if booked within 30 days of the finding memo under a separate written scope.' },
    { file: `src/content/research-notes/${slug}.ru.md`, expectedCount: slug === 'false-green-and-retry-safety' ? 2 : 1, value: 'Одна граница полномочий, до 2 подключённых инструментов, 3–5 согласованных сценариев сбоя/повтора в staging/test или на синтетике по умолчанию, один retest в течение 14 дней после finding memo. Оплата $750 полностью засчитывается в $2,450 Primary Audit при заказе в течение 30 дней после finding memo по отдельному письменному scope.' }
  ])
];
for (const {file,value,expectedCount=1} of cases) test(`R250 public Entry Audit scope: ${file}`, () => {
  const source = readFileSync(new URL(file,root),'utf8');
  assert.equal(source.split(value).length - 1, expectedCount, 'exact canonical scope count in the target blocks');
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
  for(const x of ['/buyer-pack','/ru/buyer-pack','/guides/false-green-and-retry-safety','/ru/guides/false-green-and-retry-safety','/guides/mcp-and-coding-agent-governance','/ru/guides/mcp-and-coding-agent-governance']) {
    const row=current.routes.find(r=>r.path===x);
    assert.equal(row?.lastmod,'2026-11-14',x);
    assert.match(row.fingerprint,/^sha256:[0-9a-f]{64}$/);
  }
});
