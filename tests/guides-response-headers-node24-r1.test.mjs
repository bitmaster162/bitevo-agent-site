import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { GET } from '../src/pages/api/guides.ts';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const branch = 'gpt/bitevo-guides-headers-node24-20261112';
const expected = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Robots-Tag': 'noindex'
};

test('static /api/guides has explicit JSON and noindex in both Vercel header declarations', () => {
  const headerRules = config.headers.filter((item) => item.source === '/api/guides');
  assert.equal(headerRules.length, 1, 'exactly one path-scoped header rule');
  const headerMap = Object.fromEntries(headerRules[0].headers.map(({ key, value }) => [key, value]));
  assert.deepEqual(headerMap, expected);

  const matches = config.routes
    .map((route, index) => ({ route, index }))
    .filter(({ route }) => route.src === '/api/guides');
  assert.equal(matches.length, 1, 'exactly one path-scoped route');
  assert.ok(matches[0].index > 0, 'global security header route stays first');
  assert.ok(matches[0].index < config.routes.findIndex((route) => route.handle === 'filesystem'));
  assert.equal(matches[0].route.continue, true, 'keep filesystem routing');
  assert.deepEqual(matches[0].route.headers, expected);

  assert.equal(config.routes[0].src, '/(.*)');
  assert.equal(config.routes[0].continue, true);
  assert.equal(config.headers[0].source, '/(.*)');
});

test('source handler agrees with Vercel response headers and keeps public JSON manifest', async () => {
  const response = GET();
  assert.equal(response.status, 200);
  for (const [name, value] of Object.entries(expected)) {
    assert.equal(response.headers.get(name), value);
  }
  const body = await response.json();
  assert.equal(body.version, 'public-v2');
  assert.equal(body.reviewed_guides.length, 8);
});

test('build runtime is pinned to Node 24 and review branch cannot auto-deploy', () => {
  assert.equal(pkg.engines.node, '24.x');
  assert.equal(config.git.deploymentEnabled[branch], false);
});
