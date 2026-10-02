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
  '/ru/universe':'sha256:729f50300779ad80c7466a904140449553f329868032c4a50c90edf0a06c12f6',
  '/ru/vision':'sha256:66a51ddfa3c483d0732b62a452d721987c74948ea11147fcd33ea6e515703b50',
  '/universe':'sha256:fbbb258d54ef02f183591e3f7a4c327268e4cb0e4fcb0ee9c8151b5efdc643bb',
  '/vision':'sha256:ecdf08f2fa847b55774a5f7e349c71c9446fb97d25a3db4edcca96463fdea04d'
};
for (const [route, fingerprint] of Object.entries(expected)) {
  const row = currentness.routes.find(item => item.path === route);
  check(row?.lastmod === '2026-10-02' && row?.fingerprint === fingerprint, `${route}: exact currentness`);
}
equal(currentness.routes.length, 110, 'currentness route count remains 110');
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
check(packageJson.scripts?.['verify:core']?.includes('verify-p28-crypto-disclaimer-r1.mjs'), 'P28.7A verifier is wired into verify:core');
console.log(`P28_CRYPTO_DISCLAIMER_R1_GATE=PASS checks=${checks} routes=4 static_html=PASS js_required=0`);
