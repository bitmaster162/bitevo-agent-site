import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };
const deepEqual = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks += 1; };

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(join(root, 'src/data/public-monitor.json'), 'utf8'));
const workflow = (await readFile(join(root, '.github/workflows/public-uptime-monitor.yml'), 'utf8')).replace(/\r\n/g, '\n');
const runtime = await readFile(join(root, 'scripts/monitor-public-endpoints.mjs'), 'utf8');
const slotGate = await readFile(join(root, 'scripts/public-monitor-slot-gate.mjs'), 'utf8');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

const redundantCron = '4,9,14,19,24,29,34,39,44,49,54,59 * * * *';

equal(config.schema, 'bitevo.public-monitor/v1', 'monitor config schema');
equal(config.cron, redundantCron, 'monitor redundant trigger cron');
equal(config.monitorCadenceMinutes, 30, 'actual monitor cadence window');
equal(config.triggerAttemptsPerWindow, 6, 'redundant trigger attempts per 30-minute window');
equal(config.timeoutMs, 15000, 'monitor timeout');
equal(config.targets.length, 5, 'monitor target count');

deepEqual(config.targets, [
  { id: 'bitevo-home', url: 'https://bitevo.work/', expectedStatus: 200 },
  { id: 'bitevo-pricing', url: 'https://bitevo.work/pricing', expectedStatus: 200 },
  { id: 'bitevo-start', url: 'https://bitevo.work/start', expectedStatus: 200 },
  { id: 'aiskillab-home', url: 'https://aiskillab.work/', expectedStatus: 200 },
  { id: 'aiskillab-start', url: 'https://aiskillab.work/start', expectedStatus: 200 },
], 'monitor target allowlist is exact');

check(workflow.includes(`cron: '${redundantCron}'`), 'workflow exposes redundant off-boundary schedule attempts');
check(!workflow.includes('push:'), 'workflow has no push trigger');
check(!workflow.includes('pull_request:'), 'workflow has no pull request trigger');
check(workflow.includes('workflow_dispatch:'), 'workflow exposes bounded manual trigger');
check(workflow.includes("description: 'Type SEND_TEST_ALERT to send one test Telegram alert after healthy GET checks'"), 'manual trigger requires explicit test confirmation instruction');
check(workflow.includes("PUBLIC_MONITOR_TEST_CONFIRM: ${{ github.event_name == 'workflow_dispatch' && inputs.confirm || '' }}"), 'manual confirmation is bound only from workflow_dispatch input');
check(workflow.includes('contents: read'), 'workflow repository contents permission is read-only');
check(workflow.includes('actions: read'), 'workflow actions metadata permission is read-only');
check(!workflow.includes('contents: write') && !workflow.includes('actions: write'), 'workflow grants no repository/actions write permission');
check(workflow.includes('actions/checkout@v7'), 'workflow uses current checkout major');
check(workflow.includes('actions/setup-node@v7'), 'workflow uses current setup-node major');
check(workflow.includes("node-version: '24'"), 'workflow uses Node 24');
check(workflow.includes('id: slot'), 'workflow has explicit slot gate step');
check(workflow.includes("if: github.event_name == 'schedule'"), 'slot gate applies to schedule only');
check(workflow.includes('run: node scripts/public-monitor-slot-gate.mjs'), 'workflow invokes bounded slot gate');
check(workflow.includes("if: github.event_name != 'schedule' || steps.slot.outputs.should_run == 'true'"), 'endpoint monitor runs only for due scheduled slot or manual dispatch');
check(workflow.includes('TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}'), 'workflow binds Telegram bot token secret');
check(workflow.includes('TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}'), 'workflow binds Telegram chat id secret');
check(workflow.includes('run: node scripts/monitor-public-endpoints.mjs'), 'workflow runs bounded monitor runtime');
check(workflow.includes('uses: actions/upload-artifact@v4'), 'workflow persists bounded slot marker as Actions artifact');
check(workflow.includes('retention-days: 1'), 'slot marker retention is one day');
check(workflow.includes("if: always() && github.event_name == 'schedule' && steps.slot.outputs.should_run == 'true'"), 'slot marker persists even after a due monitor failure');
check(!workflow.includes('repository_dispatch') && !workflow.includes('workflow_call'), 'workflow adds no remote trigger surface');

equal((runtime.match(/method: 'GET'/g) || []).length, 1, 'runtime defines GET probe method once');
equal((runtime.match(/method: 'POST'/g) || []).length, 1, 'runtime defines exactly one POST path');
check(runtime.includes('https://api.telegram.org/bot${botToken}/sendMessage'), 'only runtime POST destination is Telegram sendMessage');
check(runtime.includes("['bitevo.work', 'aiskillab.work']"), 'runtime host allowlist is exact');
check(runtime.includes("=== 'SEND_TEST_ALERT'"), 'runtime requires exact manual test confirmation');
check(runtime.includes('BitEvo public uptime monitor TEST'), 'manual alert is explicitly marked TEST');
check(runtime.includes('No outage was simulated.'), 'manual alert explicitly states no outage simulation');
check(runtime.includes('PUBLIC_MONITOR_TEST=PASS'), 'runtime emits manual test success receipt');
check(runtime.includes('PUBLIC_MONITOR=PASS'), 'runtime emits healthy receipt');
check(runtime.includes('TELEGRAM_ALERT_ROUTE=BLOCKED'), 'runtime fails closed when Telegram secrets are absent');
check(runtime.includes('TELEGRAM_ALERT=PASS'), 'runtime emits Telegram success receipt');
check(!runtime.includes('/api/scope-handoff') && !runtime.includes('/audit-intake') && !runtime.includes('scope-handoff'), 'runtime contains no form submission route');
check(!runtime.includes('console.log(botToken)') && !runtime.includes('console.error(botToken)'), 'runtime never logs bot token variable');

check(slotGate.includes("import { pathToFileURL } from 'node:url';"), 'slot gate uses cross-platform file URL entrypoint detection');
check(slotGate.includes('import.meta.url === pathToFileURL(process.argv[1]).href'), 'slot gate direct-run detection is provider-portable');
check(slotGate.includes('const SLOT_MINUTES = 30'), 'slot gate is fixed to 30-minute monitoring windows');
check(slotGate.includes('/actions/artifacts?per_page=100'), 'slot gate reads only GitHub Actions artifact metadata');
check(slotGate.includes("state = 'FAIL_OPEN'"), 'slot gate fails open on metadata-read failure');
check(slotGate.includes('artifact?.name === slot.key'), 'slot gate deduplicates by exact window marker name');
check(slotGate.includes("artifact?.expired !== true"), 'expired markers cannot suppress monitoring');
check(!/method\s*:\s*['"](POST|PUT|PATCH|DELETE)['"]/i.test(slotGate), 'slot gate defines no mutating HTTP method');
check(!slotGate.includes('TELEGRAM_BOT_TOKEN') && !slotGate.includes('TELEGRAM_CHAT_ID'), 'slot gate has no access to Telegram secrets');
check(packageJson.scripts?.['verify:core']?.includes('verify-p27-public-monitor-r1.mjs'), 'P27.7 verifier is wired into verify:core');

const validation = execFileSync(process.execPath, [
  join(root, 'scripts/monitor-public-endpoints.mjs'),
  '--validate',
], { cwd: root, encoding: 'utf8' });
check(validation.includes('PUBLIC_MONITOR_CONFIG=PASS targets=5'), 'runtime config validation passes without network');

const runGate = env => spawnSync(process.execPath, [join(root, 'scripts/public-monitor-slot-gate.mjs')], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, ...env, GITHUB_OUTPUT: '' },
});

const due = runGate({
  PUBLIC_MONITOR_SLOT_NOW: '2026-10-04T00:04:00Z',
  PUBLIC_MONITOR_ARTIFACTS_JSON: JSON.stringify({ artifacts: [] }),
});
equal(due.status, 0, 'slot gate empty-artifact fixture exits zero');
check(due.stdout.includes('PUBLIC_MONITOR_SLOT_GATE=RUN should_run=true slot=public-monitor-slot-20261004T000000Z'), 'empty slot is due for monitoring');

const alreadyDone = runGate({
  PUBLIC_MONITOR_SLOT_NOW: '2026-10-04T00:24:00Z',
  PUBLIC_MONITOR_ARTIFACTS_JSON: JSON.stringify({
    artifacts: [{ name: 'public-monitor-slot-20261004T000000Z', expired: false }],
  }),
});
equal(alreadyDone.status, 0, 'slot gate existing-marker fixture exits zero');
check(alreadyDone.stdout.includes('PUBLIC_MONITOR_SLOT_GATE=SKIP should_run=false slot=public-monitor-slot-20261004T000000Z'), 'existing current-window marker suppresses duplicate GET execution');

const expired = runGate({
  PUBLIC_MONITOR_SLOT_NOW: '2026-10-04T00:24:00Z',
  PUBLIC_MONITOR_ARTIFACTS_JSON: JSON.stringify({
    artifacts: [{ name: 'public-monitor-slot-20261004T000000Z', expired: true }],
  }),
});
check(expired.stdout.includes('PUBLIC_MONITOR_SLOT_GATE=RUN should_run=true'), 'expired marker cannot suppress current-window monitoring');

const nextWindow = runGate({
  PUBLIC_MONITOR_SLOT_NOW: '2026-10-04T00:34:00Z',
  PUBLIC_MONITOR_ARTIFACTS_JSON: JSON.stringify({
    artifacts: [{ name: 'public-monitor-slot-20261004T000000Z', expired: false }],
  }),
});
check(nextWindow.stdout.includes('slot=public-monitor-slot-20261004T003000Z'), 'slot gate advances exactly on 30-minute UTC boundary');
check(nextWindow.stdout.includes('should_run=true'), 'prior-window marker cannot suppress next 30-minute window');

const failOpen = runGate({
  PUBLIC_MONITOR_SLOT_NOW: '2026-10-04T00:34:00Z',
  PUBLIC_MONITOR_ARTIFACTS_JSON: '{broken',
});
equal(failOpen.status, 0, 'slot metadata failure remains non-blocking');
check(failOpen.stdout.includes('PUBLIC_MONITOR_SLOT_GATE=FAIL_OPEN should_run=true'), 'slot metadata failure runs monitor rather than skipping it');

const dryRun = spawnSync(process.execPath, [join(root, 'scripts/monitor-public-endpoints.mjs')], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    PUBLIC_MONITOR_TEST_CONFIRM: 'SEND_TEST_ALERT',
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_CHAT_ID: '',
  },
});
equal(dryRun.status, 1, 'manual test dry-run fails closed without secrets');
check((dryRun.stdout + dryRun.stderr).includes('TELEGRAM_ALERT_ROUTE=BLOCKED'), 'manual test dry-run reaches Telegram secret gate');
check(!(dryRun.stdout + dryRun.stderr).includes('TELEGRAM_ALERT=PASS'), 'manual test dry-run cannot report Telegram success without secrets');

console.log('P27_7_PUBLIC_MONITOR_R3_GATE=PASS checks=' + checks + ' targets=5 cadence=30m redundant_schedule_attempts=6_per_window trigger_spacing=5m artifact_dedupe=1d fail_open=MONITOR manual_test=EXACT_CONFIRM synthetic_outage=0 form_posts=0 telegram_post=FAILURE_OR_EXPLICIT_TEST permissions=READ_ONLY secrets=2');
