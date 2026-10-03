import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndexNowPayload, changedRoutePaths } from './indexnow-lib.mjs';

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
check(workflow.includes('fetch-depth: 2'), 'workflow fetches previous main commit for delta');
check(workflow.includes('data-build-sha=\\"$GITHUB_SHA\\"'), 'workflow waits for exact production build SHA');
check(workflow.includes('https://bitevo.work/${KEY}.txt'), 'workflow waits for public key file derived from config key');
check(workflow.includes('https://api.indexnow.org/indexnow'), 'workflow posts only to global IndexNow endpoint');
check(workflow.includes('200|202)'), 'workflow accepts documented success/pending verification codes');
check(!workflow.includes('${{ secrets.'), 'IndexNow workflow requires no repository secrets');

check(packageJson.scripts?.['verify:core']?.includes('verify-p27-indexnow-r1.mjs'), 'P27.4 verifier is wired into verify:core');

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
const parentManifest = parentManifestRaw ? JSON.parse(parentManifestRaw) : null;
const expectedPaths = parentIndexNow && parentManifest
  ? changedRoutePaths(parentManifest, manifest)
  : changedRoutePaths(null, manifest, { bootstrap: true });
const expectedPayload = buildIndexNowPayload(config, expectedPaths);

deepEqual(generated.urlList, expectedPayload.urlList, parentIndexNow ? 'post-bootstrap history emits exact semantic delta' : 'pre-IndexNow history emits exact one-time bootstrap');
check(generated.urlList.every(url => url.startsWith('https://bitevo.work/')), 'generated URLs stay on canonical host');
check(generated.urlList.length <= 10000, 'generated batch stays below IndexNow bulk limit');

console.log('P27_4_INDEXNOW_R1_GATE=PASS checks=' + checks + ' mode=' + (parentIndexNow ? 'DELTA' : 'BOOTSTRAP') + ' urls=' + generated.urlList.length + ' delta_add_modify_delete=PASS provider_write=WORKFLOW_MAIN_ONLY secrets=0 endpoint=GLOBAL_INDEXNOW key_file=ROOT_UTF8');
