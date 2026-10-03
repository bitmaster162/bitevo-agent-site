import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildIndexNowPayload, changedRoutePaths } from './indexnow-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(new URL('../src/data/indexnow.json', import.meta.url), 'utf8'));
const before = process.argv[2] || '';
const after = process.argv[3] || 'HEAD';

function gitShow(ref, path) {
  if (!ref || /^0+$/.test(ref)) return null;
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function parseManifest(raw, label) {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (parsed.schema !== 'bitevo.sitemap-currentness/v1' || !Array.isArray(parsed.routes)) {
    throw new Error(`${label} sitemap-currentness manifest is invalid`);
  }
  return parsed;
}

const currentRaw = gitShow(after, 'src/data/sitemap-currentness.json');
if (!currentRaw) throw new Error(`cannot read current sitemap-currentness at ${after}`);
const current = parseManifest(currentRaw, 'current');
const previous = parseManifest(gitShow(before, 'src/data/sitemap-currentness.json'), 'previous');
const hadIndexNow = Boolean(gitShow(before, 'src/data/indexnow.json'));
const bootstrap = !hadIndexNow || !previous;
const changedPaths = changedRoutePaths(previous, current, { bootstrap });

console.error(`INDEXNOW_CHANGESET mode=${bootstrap ? 'BOOTSTRAP' : 'DELTA'} urls=${changedPaths.length}`);
const payload = buildIndexNowPayload(config, changedPaths);
process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
