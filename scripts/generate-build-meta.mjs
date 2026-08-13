import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

function gitHead() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

const candidates = [
  ['vercel', process.env.VERCEL_GIT_COMMIT_SHA],
  ['cloudflare', process.env.CF_PAGES_COMMIT_SHA],
  ['github', process.env.GITHUB_SHA],
  ['git', gitHead()]
];

const [provider, rawSha] = candidates.find(([, value]) => typeof value === 'string' && value.trim()) || ['unknown', 'unknown'];
const sha = rawSha.trim();
const shortSha = sha === 'unknown' ? 'unknown' : sha.slice(0, 9);
const ref = process.env.VERCEL_GIT_COMMIT_REF || process.env.CF_PAGES_BRANCH || process.env.GITHUB_REF_NAME || '';

mkdirSync('src/generated', { recursive: true });
writeFileSync(
  'src/generated/build-meta.json',
  `${JSON.stringify({ sha, shortSha, provider, ref }, null, 2)}\n`,
  'utf8'
);

console.log(`BITEVO_BUILD_META sha=${sha} provider=${provider} ref=${ref || 'unknown'}`);
