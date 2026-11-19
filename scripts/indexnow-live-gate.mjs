import { readFile } from 'node:fs/promises';
import { requestText } from './indexnow-http.mjs';

export function matchesExactBuild(html, sha) {
  return /^[0-9a-f]{40}$/i.test(sha ?? '') &&
    html.includes('data-build-sha="' + sha + '"');
}

export function checkPublicRelease(home, publicKey, sha, key) {
  const homeOk = home.status === 200;
  const shaOk = homeOk && matchesExactBuild(home.body, sha);
  const keyOk = publicKey.status === 200 && publicKey.body.trim() === key;
  return { ready: shaOk && keyOk, homeStatus: home.status, keyStatus: publicKey.status, shaOk, keyOk };
}

async function probe(origin, key, sha) {
  const [home, keyResponse] = await Promise.allSettled([
    requestText(origin + '/', { timeoutMs: 12000 }),
    requestText(origin + '/' + key + '.txt', { timeoutMs: 12000 })
  ]);
  const homeValue = home.status === 'fulfilled' ? home.value : { status: 0, body: '' };
  const keyValue = keyResponse.status === 'fulfilled' ? keyResponse.value : { status: 0, body: '' };
  const result = checkPublicRelease(homeValue, keyValue, sha, key);
  const homeError = home.status === 'rejected' ? String(home.reason?.message ?? home.reason).slice(0, 140) : 'none';
  const keyError = keyResponse.status === 'rejected' ? String(keyResponse.reason?.message ?? keyResponse.reason).slice(0, 140) : 'none';
  return { ...result, homeError, keyError };
}

async function main() {
  const sha = process.env.GITHUB_SHA ?? '';
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error('Missing exact 40-hex main push SHA');
  const config = JSON.parse(await readFile(new URL('../src/data/indexnow.json', import.meta.url), 'utf8'));
  if (config.origin !== 'https://bitevo.work' || !/^[a-zA-Z0-9-]{8,128}$/.test(config.key)) {
    throw new Error('Invalid canonical IndexNow release configuration');
  }
  const deadline = Date.now() + 450000;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    const result = await probe(config.origin, config.key, sha);
    console.log('INDEXNOW_LIVE_PROBE attempt=' + attempt +
      ' home_http=' + result.homeStatus + ' key_http=' + result.keyStatus +
      ' exact_sha=' + result.shaOk + ' exact_key=' + result.keyOk +
      ' home_error=' + result.homeError + ' key_error=' + result.keyError);
    if (result.ready) {
      console.log('INDEXNOW_LIVE_GATE=PASS attempt=' + attempt + ' sha=' + sha);
      return;
    }
    if (Date.now() + 10000 >= deadline) break;
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  throw new Error('INDEXNOW_LIVE_GATE=FAIL exact production SHA and public key not both verified for ' + sha);
}

if (process.argv[1]?.endsWith('indexnow-live-gate.mjs')) {
  main().catch(error => { console.error(String(error.message ?? error)); process.exitCode = 1; });
}
