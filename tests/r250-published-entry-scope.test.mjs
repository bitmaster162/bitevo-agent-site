import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const cases = [
  { file: 'src/pages/buyer-pack.astro', value: 'one action chain and one primary control or failure hypothesis, tested in staging/test' },
  { file: 'src/pages/ru/buyer-pack.astro', value: 'одна цепочка действий и одна основная гипотеза о контроле или сбое, проверяемые в staging/test' },
  ...['false-green-and-retry-safety', 'mcp-and-coding-agent-governance'].flatMap(slug => [
    { file: `src/content/research-notes/${slug}.en.md`, value: 'One action chain and one primary control or failure hypothesis, tested in staging/test.' },
    { file: `src/content/research-notes/${slug}.ru.md`, value: 'Одна цепочка действий и одна основная гипотеза о контроле или сбое, проверяемые в staging/test.' }
  ])
];
for (const {file,value} of cases) test(`R250 public Entry Audit scope: ${file}`, () => {
  const source = readFileSync(new URL(file,root),'utf8');
  assert.equal(source.split(value).length - 1, 1, 'exactly one authoritative scope in the target block');
  assert.doesNotMatch(source, /one staging workflow|one subsequent agent action|one follow-up agent action|One agreed staging\/test workflow|один staging-воркфлоу|одно последующее действие агента|Один согласованный staging\/test-воркфлоу/u);
  assert.match(source, /(?:\/ru\/entry-audit|\/entry-audit)/);
});
test('R250 research articles have no conflicting earlier Entry scope', () => {
  for (const lang of ['en','ru']) {
    const source=readFileSync(new URL(`src/content/research-notes/false-green-and-retry-safety.${lang}.md`,root),'utf8');
    assert.doesNotMatch(source, /one agreed staging workflow|один согласованный staging-процесс/u);
  }
});
test('R250 changed route metadata has Oct 30 fingerprints; unchanged scope stays pinned', () => {
  const current=JSON.parse(readFileSync(new URL('src/data/sitemap-currentness.json',root),'utf8'));
  for(const x of ['/buyer-pack','/ru/buyer-pack','/guides/false-green-and-retry-safety','/ru/guides/false-green-and-retry-safety','/guides/mcp-and-coding-agent-governance','/ru/guides/mcp-and-coding-agent-governance']) {
    const row=current.routes.find(r=>r.path===x);
    assert.equal(row?.lastmod,'2026-10-30',x);
    assert.match(row.fingerprint,/^sha256:[0-9a-f]{64}$/);
  }
});
