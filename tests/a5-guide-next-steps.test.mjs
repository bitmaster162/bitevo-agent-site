import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const registry = JSON.parse(readFileSync(new URL('../src/data/public-route-registry.json', import.meta.url), 'utf8'));
const cases = [
  ['false-green-and-retry-safety', 'en'],
  ['false-green-and-retry-safety', 'ru'],
  ['mcp-and-coding-agent-governance', 'en'],
  ['mcp-and-coding-agent-governance', 'ru']
];
for (const [slug, lang] of cases) {
  test(`A5 next step is scope-bound, localized and linked in ${slug}.${lang}`, () => {
    const source = readFileSync(new URL(`../src/content/research-notes/${slug}.${lang}.md`, import.meta.url), 'utf8');
    const marker = lang === 'en' ? '## What next' : '## Что дальше';
    assert.equal(source.split(marker).length, 2, 'exactly one next-step block');
    const block = source.slice(source.indexOf(marker));
    assert.match(block, /\$1,500/);
    assert.match(block, /robert@bitevo\.work/);
    assert.match(block, /https:\/\/cal\.com\/robert-dumanyan-vlck0x\/free-20-minute-triage/);
    assert.match(block, /staging\/test/);
    assert.match(block, /control-plane/);
    const paths = lang === 'ru' ? ['/ru/entry-audit', '/ru/audit-intake'] : ['/entry-audit', '/audit-intake'];
    for (const path of paths) {
      assert.ok(block.includes(`](${path})`), 'explicit CTA: ' + path);
      assert.ok(registry.routes.some(row => row.path === path), 'registered public route: ' + path);
    }
  });
}
