import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };
const root = new URL('../', import.meta.url);
const EN = "This is the author's own practice and research. It is not investment advice or an offer to manage anyone's funds. Trading crypto-assets can lose all the money you put in; past results do not predict future ones.";
const RU = 'Здесь — личная практика и исследования автора. Это не инвестиционный совет и не предложение управлять чужими средствами. Торговля криптоактивами может привести к потере всех вложенных денег; прошлые результаты не гарантируют будущих.';
const sha = value => createHash('sha256').update(value, 'utf8').digest('hex');

equal(sha(EN), '9900d9e98fc20ec130e5b2f71b3bbf7a6fff014bb382e4767dd42d621689ee24', 'approved EN disclaimer hash');
equal(sha(RU), '6dd6a7500f9265a42e1f35bf0981cfdf1da0217bffcd0e01dc8af5e6d7b232dc', 'approved RU disclaimer hash');

const routes = [
  ['/universe', 'dist/universe/index.html', EN],
  ['/ru/universe', 'dist/ru/universe/index.html', RU],
  ['/vision', 'dist/vision/index.html', EN],
  ['/ru/vision', 'dist/ru/vision/index.html', RU],
];
for (const [route, file, disclaimer] of routes) {
  const html = await readFile(new URL(file, root), 'utf8');
  equal(html.split(disclaimer).length - 1, 1, `${route}: exact approved disclaimer once in static HTML`);
}
const currentness = JSON.parse(await readFile(new URL('src/data/sitemap-currentness.json', root), 'utf8'));
const expected = {
  '/ru/universe':['2026-10-05','sha256:622e32256dd64c5a6a3a82a07a7d9447a9379fc76c12a0ea1e2c092dc02d3d90'],
  '/ru/vision':['2026-10-03','sha256:e96019902180e4eae6f575139339c2413c4defa94643338d045ec75eef553f65'],
  '/universe':['2026-10-05','sha256:a0775ea6378d12e60480cb1f5bf8f27d2cfa381f991cab74304be66849e14a15'],
  '/vision':['2026-10-05','sha256:d26e083493e274f5e3e98401294c3567d19e05c6d7e5e08e70ce9f89d7af479d']
};
for (const [route, [lastmod, fingerprint]] of Object.entries(expected)) {
  const row = currentness.routes.find(item => item.path === route);
  check(row?.lastmod === lastmod && row?.fingerprint === fingerprint, `${route}: exact currentness`);
}
equal(currentness.routes.length, 121, 'currentness route count is exact P30 baseline');
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
check(packageJson.scripts?.['verify:core']?.includes('verify-p28-crypto-disclaimer-r1.mjs'), 'P28.7A verifier is wired into verify:core');
console.log(`P28_CRYPTO_DISCLAIMER_R1_GATE=PASS checks=${checks} routes=4 static_html=PASS js_required=0`);
