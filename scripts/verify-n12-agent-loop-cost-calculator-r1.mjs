import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const component = await read('src/components/AgentLoopCostCalculator.astro');
const en = await read('src/pages/agent-loop-cost-calculator.astro');
const ru = await read('src/pages/ru/agent-loop-cost-calculator.astro');
const js = await read('public/agent-loop-cost-calculator.js');
const enHtml = await read('dist/agent-loop-cost-calculator/index.html');
const ruHtml = await read('dist/ru/agent-loop-cost-calculator/index.html');
const registry = JSON.parse(await read('src/data/public-route-registry.json'));
const currentness = JSON.parse(await read('src/data/sitemap-currentness.json'));
const packageJson = JSON.parse(await read('package.json'));

for (const source of [en, ru]) {
  check(source.includes('AgentLoopCostCalculator'), 'shared calculator component used');
  check(source.includes('safety verdict'), 'safety-verdict boundary explicit');
  check(source.includes('failure-recovery'), 'failure recovery linked');
}
for (const html of [enHtml, ruHtml]) {
  equal((html.match(/data-loop-cost-calculator/g) || []).length, 1, 'exactly one calculator surface rendered');
  equal((html.match(/<input /g) || []).length, 5, 'exactly five user inputs rendered');
  check(html.includes('/agent-loop-cost-calculator.js'), 'first-party calculator JS linked');
  check(!html.includes('/agent-loop-cost-calculator.css'), 'no extra calculator CSS asset');
  check(html.includes('LOCAL ONLY'), 'local-only boundary rendered');
}
for (const token of [
  'burnPerMinute = cost * rate * parallel',
  'attemptsBeforeDetection = rate * parallel * detection',
  'spendBeforeDetection = cost * attemptsBeforeDetection',
  'minutesToBudget = budget / burnPerMinute',
  'attemptsAtBudget = Math.max(1, Math.floor(budget / cost))'
]) check(js.includes(token), 'formula bound: ' + token);

for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'localStorage', 'sessionStorage', '/api/', 'openrouter', 'navigator.sendBeacon']) {
  check(!js.includes(forbidden), 'network/storage forbidden token absent: ' + forbidden);
}
check(!component.includes(' value='), 'no preset numeric values in calculator inputs');
check(component.includes('owner-approved loss budget') || component.includes('Owner-approved loss budget'), 'owner-approved budget is the numerical authority');
check(component.includes('Cost math cannot infer it honestly') && component.includes('Из стоимости его честно вывести нельзя'), 'retry cap is not invented from cost math');
check(component.includes('0 network requests'), 'zero-network claim is explicit and locally verifiable');
check(component.includes('<style is:inline>'), 'calculator layout uses hash-bound inline style instead of a new CSS asset');

const routes = [
  ['/agent-loop-cost-calculator','en','/failure-recovery'],
  ['/ru/agent-loop-cost-calculator','ru','/ru/failure-recovery']
];
for (const [path,locale,parent] of routes) {
  const row = registry.routes.find(item => item.path === path);
  check(row?.category === 'TOOL' && row?.indexable === true && row?.locale === locale && row?.parent === parent, path + ' registry exact');
  const current = currentness.routes.find(item => item.path === path);
  check(/^\d{4}-\d{2}-\d{2}$/.test(String(current?.lastmod || '')), path + ' currentness date valid');
  check(/^sha256:[0-9a-f]{64}$/.test(String(current?.fingerprint || '')), path + ' currentness fingerprint valid');
}
equal(registry.routes.filter(row => row.indexable).length, 129, 'indexable route count N12 baseline');
equal(registry.routes.filter(row => row.indexable && row.locale === 'en').length, 65, 'EN indexable route count N12 baseline');
equal(registry.routes.filter(row => row.indexable && row.locale === 'ru').length, 64, 'RU indexable route count N12 baseline');
equal(currentness.routes.length, 129, 'currentness route count N12 baseline');
check(packageJson.scripts?.['verify:core']?.includes('verify-n12-agent-loop-cost-calculator-r1.mjs'), 'N12 verifier wired into verify:core');

console.log(
  'N12_AGENT_LOOP_COST_CALCULATOR_R1_GATE=PASS checks=' + checks +
  ' routes=2 inputs=5 formulas=5 local_only=1 network_requests=0 storage_writes=0 llm_calls=0' +
  ' hard_limits=OWNER_BUDGET_DERIVED retry_cap=OWNER_DEFINED indexable=129 en=65 ru=64'
);
