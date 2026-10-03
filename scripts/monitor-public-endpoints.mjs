import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../src/data/public-monitor.json', import.meta.url), 'utf8'));

function validateConfig(value) {
  if (!value || value.schema !== 'bitevo.public-monitor/v1') throw new Error('public monitor config schema mismatch');
  if (value.cron !== '*/30 * * * *') throw new Error('public monitor cron mismatch');
  if (!Number.isInteger(value.timeoutMs) || value.timeoutMs < 1000 || value.timeoutMs > 30000) throw new Error('public monitor timeout out of bounds');
  if (!Array.isArray(value.targets) || value.targets.length !== 5) throw new Error('public monitor target count mismatch');

  const ids = new Set();
  for (const target of value.targets) {
    if (!target || typeof target.id !== 'string' || !target.id) throw new Error('public monitor target id missing');
    if (ids.has(target.id)) throw new Error(`duplicate public monitor target id: ${target.id}`);
    ids.add(target.id);
    const url = new URL(target.url);
    if (url.protocol !== 'https:') throw new Error(`public monitor target must use https: ${target.id}`);
    if (!['bitevo.work', 'aiskillab.work'].includes(url.hostname)) throw new Error(`public monitor host not allowlisted: ${url.hostname}`);
    if (target.expectedStatus !== 200) throw new Error(`unexpected configured status for ${target.id}`);
  }
}

async function probe(target) {
  const startedAt = Date.now();
  try {
    const response = await fetch(target.url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(config.timeoutMs),
      headers: {
        'user-agent': 'BitEvo-P27.7-Uptime-Monitor/1',
        accept: 'text/html,*/*;q=0.8',
        'cache-control': 'no-cache',
      },
    });
    await response.arrayBuffer();
    return {
      id: target.id,
      url: target.url,
      expectedStatus: target.expectedStatus,
      observedStatus: response.status,
      finalUrl: response.url,
      elapsedMs: Date.now() - startedAt,
      ok: response.status === target.expectedStatus,
      error: null,
    };
  } catch (error) {
    return {
      id: target.id,
      url: target.url,
      expectedStatus: target.expectedStatus,
      observedStatus: null,
      finalUrl: null,
      elapsedMs: Date.now() - startedAt,
      ok: false,
      error: error?.name || 'FETCH_ERROR',
    };
  }
}

async function sendTelegramAlert(alertText) {
  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = String(process.env.TELEGRAM_CHAT_ID || '').trim();

  if (!botToken || !chatId) {
    const missing = [
      !botToken ? 'TELEGRAM_BOT_TOKEN' : null,
      !chatId ? 'TELEGRAM_CHAT_ID' : null,
    ].filter(Boolean).join(',');
    console.error(`TELEGRAM_ALERT_ROUTE=BLOCKED missing=${missing}`);
    return { sent: false, state: 'NOT_SENT' };
  }

  try {
    const body = new URLSearchParams({
      chat_id: chatId,
      text: alertText,
      disable_web_page_preview: 'true',
    });
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    await response.arrayBuffer();
    if (!response.ok) {
      console.error(`TELEGRAM_ALERT=FAIL http=${response.status}`);
      return { sent: false, state: 'FAILED' };
    }
    console.log('TELEGRAM_ALERT=PASS');
    return { sent: true, state: 'SENT' };
  } catch (error) {
    console.error(`TELEGRAM_ALERT=FAIL error=${error?.name || 'FETCH_ERROR'}`);
    return { sent: false, state: 'FAILED' };
  }
}

async function main() {
  validateConfig(config);

  if (process.argv.includes('--validate')) {
    console.log(`PUBLIC_MONITOR_CONFIG=PASS targets=${config.targets.length} cron="${config.cron}" timeout_ms=${config.timeoutMs}`);
    return 0;
  }

  const results = await Promise.all(config.targets.map(probe));
  for (const result of results) {
    const observed = result.observedStatus ?? result.error ?? 'ERROR';
    console.log(`PUBLIC_MONITOR_RESULT id=${result.id} expected=${result.expectedStatus} observed=${observed} elapsed_ms=${result.elapsedMs} ok=${result.ok}`);
  }

  const failures = results.filter(result => !result.ok);
  if (failures.length === 0) {
    console.log(`PUBLIC_MONITOR=PASS targets=${results.length} failures=0`);
    return 0;
  }

  const lines = [
    'BitEvo public uptime monitor alert',
    `UTC: ${new Date().toISOString()}`,
    `Failures: ${failures.length}/${results.length}`,
    ...failures.map(result => {
      const observed = result.observedStatus ?? result.error ?? 'ERROR';
      return `${result.id}: expected ${result.expectedStatus}, observed ${observed} — ${result.url}`;
    }),
  ];
  const alert = await sendTelegramAlert(lines.join('\n'));
  console.error(`PUBLIC_MONITOR=FAIL targets=${results.length} failures=${failures.length} alert=${alert.state}`);
  return 1;
}

process.exitCode = await main();
