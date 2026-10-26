// R50-G3-L2 LOCAL_ONLY — no network, provider secrets, or cloud resources.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const implementation = await import('../worker/r50-grant-claim.mjs');
const entry = await import('../worker/r50-grant-entry.mjs');

test('G3-L2 entrypoint exports only Worker default, not a SQL constant', () => {
  assert.deepEqual(Object.keys(entry), ['default']);
  assert.equal(entry.default, implementation.default);
  assert.equal(typeof entry.default.fetch, 'function');
});

test('G3-L2 R50_CONSUME_SQL remains the original exact conditional statement', () => {
  assert.equal(implementation.R50_CONSUME_SQL, [
    'UPDATE bitevo_r50_operator_grants SET consumed_at_ms = ?',
    'WHERE claim_key = ? AND policy_digest = ?',
    'AND revoked_at_ms IS NULL AND consumed_at_ms IS NULL',
    'AND not_before_ms <= ? AND expires_at_ms = ? AND expires_at_ms > ?'
  ].join(' '));
});

test('G3-L2 original claim implementation unchanged at pinned local baseline', () => {
  const source = readFileSync(new URL('../worker/r50-grant-claim.mjs', import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'),
    '2643be9a189cfccaec4855e81dbc87c498a2081dbebe1690c0ac3649fe695412');
});

test('G3-L2 new default entrypoint preserves fail-closed OFF response', async () => {
  const response = await entry.default.fetch(new Request('https://r50g3l2-local.invalid/r50/claim'));
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error:'NOT_FOUND' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
