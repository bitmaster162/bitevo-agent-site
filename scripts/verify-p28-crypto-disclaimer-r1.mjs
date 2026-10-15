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
  '/ru/universe':['2026-10-16','sha256:199ba4a8839f95768c54e54870faa299f8c06d0b89ee66cc45958bea2139e198'],
  '/ru/vision':['2026-10-13','sha256:69596fd7cfba45fedcefafa924aa151271032f2743b488cced1198cc6ab6c924'],
  '/universe':['2026-10-13','sha256:ee3bbf1a36a696f133f9d807af21ed16d477c6f93561fb64e7002cfd325e5ea7'],
  '/vision':['2026-10-13','sha256:c05f365e5bf41ee50d39076b1132a80a11710b81d4c65c252b3cc9ef5d649a24']
};
for (const [route, [lastmod, fingerprint]] of Object.entries(expected)) {
  const row = currentness.routes.find(item => item.path === route);
  check(row?.lastmod === lastmod && row?.fingerprint === fingerprint, `${route}: exact currentness`);
}
equal(currentness.routes.length, 133, 'currentness route count is exact P30 baseline');
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
check(packageJson.scripts?.['verify:core']?.includes('verify-p28-crypto-disclaimer-r1.mjs'), 'P28.7A verifier is wired into verify:core');
console.log(`P28_CRYPTO_DISCLAIMER_R1_GATE=PASS checks=${checks} routes=4 static_html=PASS js_required=0`);
