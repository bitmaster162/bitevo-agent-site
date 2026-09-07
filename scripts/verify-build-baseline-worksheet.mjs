import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { calculateWorkflowBaseline } from '../src/lib/workflow-baseline.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const failures = [];
let checks = 0;
const check = (ok, label) => { checks += 1; if (!ok) failures.push(label); };

const fixture = calculateWorkflowBaseline({
  cases_per_period: 120,
  first_pass_minutes_per_case: 22,
  repeat_touch_rate: 0.2,
  repeat_touch_minutes: 15,
  loaded_labor_cost_per_hour: 30
});
check(fixture.first_pass_hours_per_period === 44, 'fixture first-pass hours drift');
check(fixture.repeat_touch_hours_per_period === 6, 'fixture repeat-touch hours drift');
check(fixture.total_exception_hours_per_period === 50, 'fixture total hours drift');
check(fixture.labor_cost_per_period === 1500, 'fixture labor translation drift');

const noRepeat = calculateWorkflowBaseline({ cases_per_period: 10, first_pass_minutes_per_case: 12, repeat_touch_rate: 0, repeat_touch_minutes: 99 });
check(noRepeat.total_exception_hours_per_period === 2, 'zero-repeat fixture drift');
check(noRepeat.labor_cost_per_period === null, 'optional labor must remain null');
let invalidRateBlocked = false;
try { calculateWorkflowBaseline({ cases_per_period: 1, first_pass_minutes_per_case: 1, repeat_touch_rate: 1.01, repeat_touch_minutes: 1 }); } catch { invalidRateBlocked = true; }
check(invalidRateBlocked, 'repeat-touch rate > 1 must fail closed');
const en = await readFile(`${dist}/build/workflow-baseline-worksheet/index.html`, 'utf8');
const ru = await readFile(`${dist}/ru/build/workflow-baseline-worksheet/index.html`, 'utf8');
const component = await readFile(`${root}/src/components/WorkflowBaselineWorksheet.astro`, 'utf8');
const calculator = await readFile(`${root}/src/lib/workflow-baseline.mjs`, 'utf8');

for (const [label, html] of [['EN', en], ['RU', ru]]) {
  check(html.includes('data-build-baseline-worksheet'), `${label}: worksheet marker missing`);
  check(html.includes('data-network-write="none"'), `${label}: no-network marker missing`);
  check(html.includes('data-storage-write="none"'), `${label}: no-storage marker missing`);
  check(html.includes('BUYER_SUPPLIED_UNVERIFIED_LOCAL_DRAFT') || component.includes('BUYER_SUPPLIED_UNVERIFIED_LOCAL_DRAFT'), `${label}: draft status missing`);
  check(!/<form\b[^>]*\baction=/i.test(html), `${label}: form action must be absent`);
}

for (const forbidden of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket(', 'EventSource(', 'localStorage', 'sessionStorage', 'document.cookie']) {
  check(!component.includes(forbidden), `component forbidden effect primitive: ${forbidden}`);
}
check(calculator.includes('repeat_touch_rate must be between 0 and 1'), 'calculator fail-closed rate guard missing');
check(en.includes('Testing authorization: NOT GRANTED'), 'EN authorization boundary missing');
check(ru.includes('Testing authorization: NOT GRANTED'), 'RU authorization boundary missing');
check(en.includes('href="/build/exception-workflow-diagnostic"'), 'EN diagnostic backlink missing');
check(ru.includes('href="/ru/build/exception-workflow-diagnostic"'), 'RU diagnostic backlink missing');

if (failures.length) {
  console.error(`BUILD_BASELINE_WORKSHEET_GATE=FAIL checks=${checks} failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`BUILD_BASELINE_WORKSHEET_GATE=PASS checks=${checks} calculations=PASS network_write=0 storage_write=0 locales=2 failures=0`);
