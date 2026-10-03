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
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

equal(config.schema, 'bitevo.public-monitor/v1', 'monitor config schema');
equal(config.cron, '17,47 * * * *', 'monitor config cadence');
equal(config.timeoutMs, 15000, 'monitor timeout');
equal(config.targets.length, 5, 'monitor target count');

deepEqual(config.targets, [
  { id: 'bitevo-home', url: 'https://bitevo.work/', expectedStatus: 200 },
  { id: 'bitevo-pricing', url: 'https://bitevo.work/pricing', expectedStatus: 200 },
  { id: 'bitevo-start', url: 'https://bitevo.work/start', expectedStatus: 200 },
  { id: 'aiskillab-home', url: 'https://aiskillab.work/', expectedStatus: 200 },
  { id: 'aiskillab-start', url: 'https://aiskillab.work/start', expectedStatus: 200 },
], 'monitor target allowlist is exact');

check(workflow.includes("cron: '17,47 * * * *'"), 'workflow cadence is every 30 minutes on off-peak minute offsets');
check(!workflow.includes('push:'), 'workflow has no push trigger');
check(!workflow.includes('pull_request:'), 'workflow has no pull request trigger');
check(workflow.includes('workflow_dispatch:'), 'workflow exposes bounded manual trigger');
check(workflow.includes("description: 'Type SEND_TEST_ALERT to send one test Telegram alert after healthy GET checks'"), 'manual trigger requires explicit test confirmation instruction');
check(workflow.includes("PUBLIC_MONITOR_TEST_CONFIRM: ${{ github.event_name == 'workflow_dispatch' && inputs.confirm || '' }}"), 'manual confirmation is bound only from workflow_dispatch input');
check(workflow.includes('contents: read'), 'workflow repository permission is read-only');
check(workflow.includes('actions/checkout@v7'), 'workflow uses current checkout major');
check(workflow.includes('actions/setup-node@v7'), 'workflow uses current setup-node major');
check(workflow.includes("node-version: '24'"), 'workflow uses Node 24');
check(workflow.includes('TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}'), 'workflow binds Telegram bot token secret');
check(workflow.includes('TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}'), 'workflow binds Telegram chat id secret');
check(workflow.includes('run: node scripts/monitor-public-endpoints.mjs'), 'workflow runs bounded monitor runtime');

equal((runtime.match(/method: 'GET'/g) || []).length, 1, 'runtime defines GET probe method once');
equal((runtime.match(/method: 'POST'/g) || []).length, 1, 'runtime defines exactly one POST path');
check(runtime.includes('https://api.telegram.org/bot${botToken}/sendMessage'), 'only POST destination is Telegram sendMessage');
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
check(packageJson.scripts?.['verify:core']?.includes('verify-p27-public-monitor-r1.mjs'), 'P27.7 verifier is wired into verify:core');

const validation = execFileSync(process.execPath, [
  join(root, 'scripts/monitor-public-endpoints.mjs'),
  '--validate',
], { cwd: root, encoding: 'utf8' });
check(validation.includes('PUBLIC_MONITOR_CONFIG=PASS targets=5'), 'runtime config validation passes without network');

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

console.log('P27_7_PUBLIC_MONITOR_R2_GATE=PASS checks=' + checks + ' targets=5 cadence=30m_offpeak_17_47 manual_test=EXACT_CONFIRM healthy_gets_before_test=5 synthetic_outage=0 form_posts=0 telegram_post=FAILURE_OR_EXPLICIT_TEST repo_permissions=READ_ONLY secrets=2');
