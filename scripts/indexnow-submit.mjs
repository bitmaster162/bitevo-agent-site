import { readFile } from 'node:fs/promises';
import { requestText } from './indexnow-http.mjs';

async function main() {
  const payloadPath = process.argv[2];
  if (!payloadPath) throw new Error('Missing IndexNow payload path');
  const config = JSON.parse(await readFile(new URL('../src/data/indexnow.json', import.meta.url), 'utf8'));
  const payload = JSON.parse(await readFile(payloadPath, 'utf8'));
  if (config.endpoint !== 'https://api.indexnow.org/indexnow' ||
      payload.host !== config.host || payload.key !== config.key ||
      payload.keyLocation !== config.keyLocation ||
      !Array.isArray(payload.urlList) ||
      payload.urlList.length < 1 || payload.urlList.length > 10000 ||
      !payload.urlList.every(value => {
        try { return new URL(value).origin === config.origin; } catch { return false; }
      })) {
    throw new Error('IndexNow payload fails exact canonical host/key/URL validation');
  }
  const response = await requestText(config.endpoint, {
    method: 'POST', body: JSON.stringify(payload), timeoutMs: 20000
  });
  if (response.status !== 200 && response.status !== 202) {
    throw new Error('INDEXNOW_SUBMIT=FAIL http=' + response.status +
      ' provider_response=' + response.body.slice(0, 300));
  }
  console.log('INDEXNOW_SUBMIT=PASS http=' + response.status +
    ' urls=' + payload.urlList.length + ' provider_ack=HTTP_' + response.status);
}

main().catch(error => { console.error(String(error.message ?? error)); process.exitCode = 1; });
