import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const failures = [];
let checks = 0;

const read = path => readFile(path, 'utf8');
const check = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const equal = (actual, expected, message) => { checks += 1; if (actual !== expected) failures.push(message + ': expected=' + expected + ' actual=' + actual); };

const en = await read(join(dist, 'seaport-order-components-decoder', 'index.html'));
const ru = await read(join(dist, 'ru', 'seaport-order-components-decoder', 'index.html'));
const js = await read(join(root, 'public', 'seaport-order-components-decoder.js'));
const registry = JSON.parse(await read(join(root, 'src', 'data', 'public-route-registry.json')));
const currentness = JSON.parse(await read(join(root, 'src', 'data', 'sitemap-currentness.json')));
const pkg = JSON.parse(await read(join(root, 'package.json')));
const intake = await read(join(root, 'public', 'intake-segmentation.js'));

const both = (needle, label = needle) => {
  check(en.includes(needle), 'EN missing ' + label);
  check(ru.includes(needle), 'RU missing ' + label);
};

both('data-c7-dune-seaport-decoder-r1', 'C7 marker');
both('data-can-trade="false"', 'can_trade machine boundary');
both('can_trade=false', 'visible can_trade=false');
both('data-c4-n14="blocked"', 'C4/N14 machine boundary');
both('C4 / N14', 'C4/N14 visible boundary');
both('BLOCKED', 'C4/N14 blocked state');
both('OrderComponents');
both('getOrderHash');
both('getOrderStatus');
both('getCounter');
both('incrementCounter');
both('https://docs.opensea.io/docs/seaport-models', 'Seaport models source');
both('https://docs.opensea.io/docs/seaport-enums', 'Seaport enums source');
both('https://docs.opensea.io/docs/seaport-interface', 'Seaport interface source');
both('https://dune.com/application-terms', 'Dune application boundary source');
both('https://dune.com/sql-api-terms', 'Dune API credential boundary source');

for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'window.ethereum', 'eth_sendTransaction', 'personal_sign', 'eth_signTypedData', 'setApprovalForAll(', '.approve(', 'localStorage', 'sessionStorage']) {
  check(!js.includes(forbidden), 'decoder JS forbidden capability: ' + forbidden);
}
for (const required of ['ORDER_TYPES', 'ITEM_TYPES', 'offerer', 'zone', 'offer', 'consideration', 'orderType', 'startTime', 'endTime', 'zoneHash', 'salt', 'conduitKey', 'counter', 'networkRequests: 0', 'can_trade: false', "orderHash: 'NOT_COMPUTED'", 'BLOCKED_WITHOUT_REAL_AUDITABLE_TX_EVIDENCE', "hostname.toLowerCase() !== 'dune.com'"]) {
  check(js.includes(required), 'decoder JS missing contract: ' + required);
}

for (const [path, locale, parent] of [
  ['/seaport-order-components-decoder', 'en', '/trading-bot-authority-audit'],
  ['/ru/seaport-order-components-decoder', 'ru', '/ru/trading-bot-authority-audit']
]) {
  const route = registry.routes.find(item => item.path === path);
  check(Boolean(route), path + ': missing route registry entry');
  if (route) {
    equal(route.category, 'TOOL', path + ': category');
    equal(route.indexable, true, path + ': indexable');
    equal(route.locale, locale, path + ': locale');
    equal(route.parent, parent, path + ': parent');
  }
  const row = currentness.routes.find(item => item.path === path);
  check(Boolean(row), path + ': missing currentness row');
  if (row) {
    equal(row.lastmod, '2026-10-07', path + ': lastmod');
    check(/^sha256:[0-9a-f]{64}$/.test(row.fingerprint || ''), path + ': fingerprint');
  }
}

equal(registry.routes.filter(row => row.indexable).length, 131, 'indexable route count');
equal(registry.routes.filter(row => row.indexable && row.locale === 'en').length, 66, 'EN indexable route count');
equal(registry.routes.filter(row => row.indexable && row.locale === 'ru').length, 65, 'RU indexable route count');
equal(currentness.routes.length, 131, 'currentness route count');
check(pkg.scripts?.['verify:core']?.includes('verify-c7-dune-seaport-decoder-r1.mjs'), 'C7 verifier wired into verify:core');

const offerKeys = [...intake.matchAll(/^\s{4}'([^']+)': \{$/gm)].map(match => match[1]);
equal(offerKeys.length, 3, 'paid offer allowlist unchanged');
check(!offerKeys.some(key => /dune|seaport/i.test(key)), 'C7 must not create a paid offer');

const hardcodedDune = [...en.matchAll(/https:\/\/dune\.com\/[^"<\s]+/g), ...ru.matchAll(/https:\/\/dune\.com\/[^"<\s]+/g)].map(match => match[0]);
check(hardcodedDune.every(url => url === 'https://dune.com/application-terms' || url === 'https://dune.com/sql-api-terms'), 'no fabricated Dune dashboard/query may be hardcoded');

if (failures.length) {
  console.error('C7_DUNE_SEAPORT_DECODER_R1=FAIL failures=' + failures.length);
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}

console.log('C7_DUNE_SEAPORT_DECODER_R1=PASS checks=' + checks + ' routes=2 local_only=1 network_requests=0 can_trade=false wallet_connect=0 signing=0 rpc_read=0 rpc_write=0 order_submit=0 cancel=0 increment_counter=0 allowance_mutation=0 dune_api=0 fabricated_dashboard=0 c4_n14=BLOCKED');
