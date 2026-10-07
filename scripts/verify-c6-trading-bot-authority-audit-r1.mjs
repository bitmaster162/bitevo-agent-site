import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const failures = [];

const read = path => readFile(path, 'utf8');
const en = await read(join(dist, 'trading-bot-authority-audit', 'index.html'));
const ru = await read(join(dist, 'ru', 'trading-bot-authority-audit', 'index.html'));
const registry = JSON.parse(await read(join(root, 'src', 'data', 'public-route-registry.json')));
const intake = await read(join(root, 'public', 'intake-segmentation.js'));

const check = (condition, message) => { if (!condition) failures.push(message); };
const both = (needle, label = needle) => {
  check(en.includes(needle), `EN missing ${label}`);
  check(ru.includes(needle), `RU missing ${label}`);
};

both('data-c6-trading-bot-authority-audit-r1', 'C6 route marker');
both('data-can-trade="false"', 'can_trade machine boundary');
both('can_trade=false', 'visible can_trade=false');
both('NO LIVE FUNDS BY DEFAULT');
both('NO CREDENTIAL COLLECTION');
both('primary-agent-authority-audit', 'existing Primary Audit intent');
both('Withdraw disabled');
both('IP allowlist');
both('sub-account');
both('API acknowledgement', 'ACK is not fill boundary');
both('wallet seeds', 'secret boundary');
both('production credentials', 'production secret boundary');

check(en.includes('not strategy profitability') || en.includes('not strategy profitability'.replace('not ', '')), 'EN missing profitability exclusion');
check(ru.includes('не прибыльность стратегии') || ru.includes('не является прибыльность стратегии'), 'RU missing profitability exclusion');
check(!/Dune|Seaport/i.test(en), 'EN C6 must not pull C7 Dune/Seaport scope');
check(!/Dune|Seaport/i.test(ru), 'RU C6 must not pull C7 Dune/Seaport scope');

for (const [path, locale, parent] of [
  ['/trading-bot-authority-audit', 'en', '/agent-authority-audit'],
  ['/ru/trading-bot-authority-audit', 'ru', '/ru/agent-authority-audit']
]) {
  const route = registry.routes.find(item => item.path === path);
  check(Boolean(route), `${path}: missing route registry entry`);
  if (route) {
    check(route.category === 'SPECIALIST', `${path}: category must be SPECIALIST`);
    check(route.indexable === true, `${path}: must be indexable`);
    check(route.locale === locale, `${path}: locale drift`);
    check(route.parent === parent, `${path}: parent drift`);
  }
}

const offerKeys = [...intake.matchAll(/^\s{4}'([^']+)': \{$/gm)].map(match => match[1]);
check(offerKeys.includes('primary-agent-authority-audit'), 'Primary Audit offer intent missing');
check(!offerKeys.some(key => /trading|bot/i.test(key)), 'C6 must reuse existing offer intent, not create a trading-bot paid offer');
check(offerKeys.length === 3, `offer allowlist drift: expected 3, found ${offerKeys.length}`);

if (failures.length) {
  console.error(`C6_TRADING_BOT_AUTHORITY_AUDIT_R1=FAIL failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('C6_TRADING_BOT_AUTHORITY_AUDIT_R1=PASS routes=2 offer_reuse=primary-agent-authority-audit can_trade=false live_funds_default=DENY credential_collection=DENY c7_scope=ABSENT');
