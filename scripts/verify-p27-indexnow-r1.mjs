import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndexNowPayload, changedRoutePaths } from './indexnow-lib.mjs';
import { checkPublicRelease, matchesExactBuild } from './indexnow-live-gate.mjs';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };
const deepEqual = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks += 1; };

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(join(root, 'src/data/indexnow.json'), 'utf8'));
const keyFile = await readFile(join(root, 'public', `${config.key}.txt`), 'utf8');
const workflow = (await readFile(join(root, '.github/workflows/indexnow.yml'), 'utf8')).replace(/\r\n/g, '\n');
const robots = await readFile(join(root, 'public/robots.txt'), 'utf8');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(await readFile(join(root, 'src/data/sitemap-currentness.json'), 'utf8'));

equal(config.schema, 'bitevo.indexnow/v1', 'IndexNow config schema');
equal(config.host, 'bitevo.work', 'IndexNow host');
equal(config.origin, 'https://bitevo.work', 'IndexNow origin');
equal(config.endpoint, 'https://api.indexnow.org/indexnow', 'IndexNow global endpoint');
check(/^[A-Za-z0-9-]{8,128}$/.test(config.key), 'IndexNow key matches protocol character and length requirements');
equal(config.keyLocation, `https://bitevo.work/${config.key}.txt`, 'IndexNow keyLocation is root key file');
equal(keyFile.trim(), config.key, 'public key file contains exact key');
check(robots.includes('Sitemap: https://bitevo.work/sitemap.xml'), 'robots advertises canonical sitemap');

check(workflow.includes('push:\n    branches:\n      - main'), 'workflow runs on main pushes');
check(!workflow.includes('pull_request:'), 'workflow never submits on pull requests');
check(!workflow.includes('workflow_dispatch:'), 'workflow has no manual provider-write trigger');
check(workflow.includes('contents: read'), 'workflow uses read-only repository permission');
check(workflow.includes('fetch-depth: 0'), 'workflow can compare across skipped pushes');
check(workflow.includes('node scripts/indexnow-live-gate.mjs'), 'workflow waits for exact live release with checked HTTPS');
check(workflow.includes('node scripts/indexnow-submit.mjs indexnow-payload.json'), 'workflow gates provider submission behind live readback');
check(workflow.includes('actions: read') && workflow.includes('indexnow.yml/runs?branch=main&event=push&status=success&per_page=1'), 'checkpoint comes from successful pushes of the same workflow');
check(workflow.includes('"$CHECKPOINT_SHA" "$GITHUB_SHA" --since-success') && !workflow.includes('--full'), 'regular pushes only notify changes since a successful run');
equal(workflow.split("if: steps.payload.outputs.count != '0'").length - 1, 2, 'both live check and submit skip an empty change set');
check(!workflow.includes('curl '), 'workflow no longer uses runner curl prone to error 100');
check(!workflow.includes('${{ secrets.'), 'IndexNow workflow requires no repository secrets');

check(packageJson.scripts?.['verify:core']?.includes('verify-p27-indexnow-r1.mjs'), 'P27.4 verifier is wired into verify:core');

const liveGateSource = await readFile(join(root, 'scripts/indexnow-live-gate.mjs'), 'utf8');
const submitSource = await readFile(join(root, 'scripts/indexnow-submit.mjs'), 'utf8');
const httpSource = await readFile(join(root, 'scripts/indexnow-http.mjs'), 'utf8');
check(liveGateSource.includes('requestText(origin') && liveGateSource.includes('INDEXNOW_LIVE_GATE=PASS'), 'live gate uses checked HTTPS');
check(submitSource.includes('response.status !== 200 && response.status !== 202'), 'submission requires documented HTTP acceptance');
check(httpSource.includes('maxHeaderSize: 128 * 1024'), 'HTTP transport tolerates large response headers');
const fakeSha = 'a'.repeat(40);
const goodHome = { status: 200, body: '<main data-build-sha="' + fakeSha + '"></main>' };
const goodKey = { status: 200, body: config.key + '\n' };
check(matchesExactBuild(goodHome.body, fakeSha), 'exact build attribute accepted');
check(!matchesExactBuild(goodHome.body, 'b'.repeat(40)), 'wrong build SHA rejected');
check(checkPublicRelease(goodHome, goodKey, fakeSha, config.key).ready, 'complete live and key readback accepted');
check(!checkPublicRelease({ ...goodHome, status: 404 }, goodKey, fakeSha, config.key).ready, 'HTTP error fails closed');
check(!checkPublicRelease(goodHome, { ...goodKey, body: 'wrong' }, fakeSha, config.key).ready, 'wrong public key fails closed');

const previous = {
  schema: 'bitevo.sitemap-currentness/v1',
  routes: [
    { path: '/a', fingerprint: 'sha256:a' },
    { path: '/b', fingerprint: 'sha256:b-old' },
    { path: '/gone', fingerprint: 'sha256:gone' },
  ],
};
const current = {
  schema: 'bitevo.sitemap-currentness/v1',
  routes: [
    { path: '/a', fingerprint: 'sha256:a' },
    { path: '/b', fingerprint: 'sha256:b-new' },
    { path: '/new', fingerprint: 'sha256:new' },
  ],
};
deepEqual(changedRoutePaths(previous, current), ['/b', '/gone', '/new'], 'delta contains modified, deleted and added routes only');
deepEqual(changedRoutePaths(previous, current, { bootstrap: true }), ['/a', '/b', '/new'], 'bootstrap contains all current routes only');
deepEqual(changedRoutePaths(current, current), [], 'unchanged manifests produce empty delta');

const fixturePayload = buildIndexNowPayload(config, ['/a', '/b']);
equal(fixturePayload.host, 'bitevo.work', 'payload host is exact');
equal(fixturePayload.key, config.key, 'payload key matches public key');
equal(fixturePayload.keyLocation, config.keyLocation, 'payload keyLocation matches public key');
deepEqual(fixturePayload.urlList, ['https://bitevo.work/a', 'https://bitevo.work/b'], 'payload URLs stay on canonical origin');

function gitShow(ref, path) {
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

const generated = JSON.parse(execFileSync(process.execPath, [
  join(root, 'scripts/indexnow-changed-urls.mjs'),
  'HEAD^',
  'HEAD',
], { cwd: root, encoding: 'utf8' }));
const parentIndexNow = gitShow('HEAD^', 'src/data/indexnow.json');
const parentManifestRaw = gitShow('HEAD^', 'src/data/sitemap-currentness.json');
const headManifestRaw = gitShow('HEAD', 'src/data/sitemap-currentness.json');
const parentManifest = parentManifestRaw ? JSON.parse(parentManifestRaw) : null;
check(Boolean(headManifestRaw), 'committed HEAD sitemap-currentness manifest exists');
const headManifest = JSON.parse(headManifestRaw);
check(manifest.schema === headManifest.schema && Array.isArray(manifest.routes), 'worktree sitemap-currentness schema remains valid');
const expectedPaths = parentIndexNow && parentManifest
  ? changedRoutePaths(parentManifest, headManifest)
  : changedRoutePaths(null, headManifest, { bootstrap: true });
const expectedPayload = buildIndexNowPayload(config, expectedPaths);

deepEqual(generated.urlList, expectedPayload.urlList, parentIndexNow ? 'post-bootstrap history emits exact semantic delta' : 'pre-IndexNow history emits exact one-time bootstrap');
check(generated.urlList.every(url => url.startsWith('https://bitevo.work/')), 'generated URLs stay on canonical host');
check(generated.urlList.length <= 10000, 'generated batch stays below IndexNow bulk limit');

const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
function checkpointDelta(before, after, ...flags) {
  return spawnSync(process.execPath, [join(root, 'scripts/indexnow-changed-urls.mjs'), before, after, '--since-success', ...flags], { cwd: root, encoding: 'utf8' });
}
const sameRelease = checkpointDelta(headSha, headSha);
equal(sameRelease.status, 0, 'a verified unchanged release is valid');
deepEqual(JSON.parse(sameRelease.stdout).urlList, [], 'unchanged release sends no URLs');
for (const baseline of ['', '0'.repeat(40), 'HEAD']) {
  const missing = checkpointDelta(baseline, headSha);
  check(missing.status !== 0 && !missing.stdout, 'missing or unverified checkpoint cannot emit a payload');
}
check(checkpointDelta(headSha, headSha, '--full').status !== 0, 'normal notifications cannot enter recovery mode');
if (parentIndexNow && parentManifest) {
  const parentSha = execFileSync('git', ['rev-parse', 'HEAD^'], { cwd: root, encoding: 'utf8' }).trim();
  const fromParent = checkpointDelta(parentSha, headSha);
  equal(fromParent.status, 0, 'an earlier successful main revision is valid');
  deepEqual(JSON.parse(fromParent.stdout).urlList, expectedPayload.urlList, 'verified delta includes only editorial changes');
  check(checkpointDelta(headSha, parentSha).status !== 0, 'stale reruns cannot notify a backwards delta');
}

const recovery = JSON.parse(execFileSync(process.execPath, [
  join(root, 'scripts/indexnow-changed-urls.mjs'), 'HEAD^', 'HEAD', '--full'
], { cwd: root, encoding: 'utf8' }));
const expectedRecovery = buildIndexNowPayload(config, changedRoutePaths(null, headManifest, { bootstrap: true }));
deepEqual(recovery.urlList, expectedRecovery.urlList, 'recovery mode replays every current indexed URL, not only the delta');
equal(recovery.urlList.length, headManifest.routes.length, 'recovery payload matches current sitemap route census');

console.log('P27_4_INDEXNOW_R1_GATE=PASS checks=' + checks + ' mode=' + (parentIndexNow ? 'DELTA' : 'BOOTSTRAP') + ' urls=' + generated.urlList.length + ' delta_add_modify_delete=PASS provider_write=WORKFLOW_MAIN_ONLY secrets=0 endpoint=GLOBAL_INDEXNOW key_file=ROOT_UTF8');
