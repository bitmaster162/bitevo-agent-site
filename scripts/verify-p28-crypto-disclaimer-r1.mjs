import { isExactGuide4Successor } from './guide4-route-successor-r1.mjs';
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
  '/ru/universe':['2026-10-26','sha256:db8d874dcd126869078ed1802e5bf704224142fe2ba8f786abb4c9be48b886c0'],
  '/ru/vision':['2026-10-13','sha256:69596fd7cfba45fedcefafa924aa151271032f2743b488cced1198cc6ab6c924'],
  '/universe':['2026-10-26','sha256:1bd9c9722c2c5a478d43197d58e54441f4042be8461787267724e9efc0c33d15'],
  '/vision':['2026-10-13','sha256:c05f365e5bf41ee50d39076b1132a80a11710b81d4c65c252b3cc9ef5d649a24']
};
// Exact Guide3 successor: the original P28 fingerprint remains the historical baseline.
const guide4RuUniverse = 'sha256:5b0248c118b19c1f56d587e7ed0eb1619e3628c5c65fef0184a5ce523ee251b0';
for (const [route, [lastmod, fingerprint]] of Object.entries(expected)) {
  const row = currentness.routes.find(item => item.path === route);
  check((row?.lastmod === lastmod || (isExactGuide4Successor() && route === '/ru/universe' && row?.lastmod === '2026-10-27')) && (row?.fingerprint === fingerprint || (isExactGuide4Successor() && route === '/ru/universe' && row?.fingerprint === guide4RuUniverse)), `${route}: exact currentness`);
}
equal(currentness.routes.length, isExactGuide4Successor() ? 135 : 133, 'currentness route count is exact P30 baseline');
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
check(packageJson.scripts?.['verify:core']?.includes('verify-p28-crypto-disclaimer-r1.mjs'), 'P28.7A verifier is wired into verify:core');
console.log(`P28_CRYPTO_DISCLAIMER_R1_GATE=PASS checks=${checks} routes=4 static_html=PASS js_required=0`);
