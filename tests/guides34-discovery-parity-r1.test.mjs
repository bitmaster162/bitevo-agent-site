import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { GET } from '../src/pages/api/guides.ts';

const root = new URL('../', import.meta.url);
const source = (file) => readFileSync(new URL(file, root), 'utf8');
const registry = JSON.parse(source('src/data/public-route-registry.json'));
const activeEnglishGuides = registry.routes
  .filter((route) => route.path.startsWith('/guides/') && route.indexable && route.category === 'RESEARCH')
  .map((route) => route.path)
  .sort();
const newSlugs = ['/guides/false-green-and-retry-safety', '/guides/mcp-and-coding-agent-governance'];

test('robots: four user agents explicitly allow both reviewed guides without removing the guide deny', () => {
  const txt = source('public/robots.txt');
  const blocks = txt.trim().split(/\r?\n\r?\n+/).filter((part) => part.startsWith('User-agent:'));
  assert.deepEqual(blocks.map((b) => b.match(/^User-agent: (.+)/)?.[1]), ['*', 'Google-Extended', 'GPTBot', 'ClaudeBot']);
  for (const block of blocks) {
    const rows = block.split(/\r?\n/);
    assert.ok(rows.includes('Disallow: /guides/'), 'legacy guides deny must stay');
    assert.ok(!rows.includes('Allow: /guides/'), 'do not broadly permit legacy guides');
    const allow = rows.filter((r) => r.startsWith('Allow: /guides/')).map((r) => r.slice('Allow: '.length)).sort();
    assert.deepEqual(allow, activeEnglishGuides, 'every indexed research guide must have one explicit allow');
    for (const slug of newSlugs) assert.equal(rows.filter((r) => r === 'Allow: ' + slug).length, 1);
  }
});

test('/api/guides returns exactly the eight indexable English guides (no private routes)', async () => {
  const response = GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex');
  const json = await response.json();
  assert.equal(json.version, 'public-v2');
  assert.equal(json.reviewed_guides.length, 8);
  assert.equal(new Set(json.reviewed_guides).size, 8);
  assert.deepEqual([...json.reviewed_guides].sort(), activeEnglishGuides);
  for (const slug of newSlugs) assert.ok(json.reviewed_guides.includes(slug));
});

test('preexisting Guides 3/4 editorial corrections remain intact in EN and RU', () => {
  const g3en = source('src/content/research-notes/false-green-and-retry-safety.en.md');
  const g3ru = source('src/content/research-notes/false-green-and-retry-safety.ru.md');
  const g4en = source('src/content/research-notes/mcp-and-coding-agent-governance.en.md');
  const g4ru = source('src/content/research-notes/mcp-and-coding-agent-governance.ru.md');
  assert.ok(!g3en.includes('<span>Never let a chat transcript'));
  assert.match(g3ru, /HTTP 202 Accepted/);
  assert.match(g3ru, /\[ценам и границам BitEvo\]\(\/ru\/pricing\)/);
  assert.match(g3ru, /research_source:.*опубликованные условия BitEvo/);
  const expected = 'https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization#security-considerations';
  for (const s of [g4en, g4ru]) {
    assert.ok(s.includes(expected));
    assert.ok(!s.includes('/authorization/security-considerations'));
  }
  assert.match(g4ru, /Anthropic исправила/);
  assert.match(g4ru, /research_source:.*первоисточники/);
  // The Oct 29 report incorrectly called control-validation a 404; it is now an active route.
  for (const p of ['/control-validation', '/ru/control-validation']) {
    assert.ok(registry.routes.some((route) => route.path === p && route.indexable));
  }
});
