import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

function gitHead() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function gitRef() {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

const candidates = [
  { provider: 'vercel', sha: process.env.VERCEL_GIT_COMMIT_SHA, ref: process.env.VERCEL_GIT_COMMIT_REF },
  { provider: 'cloudflare', sha: process.env.WORKERS_CI_COMMIT_SHA, ref: process.env.WORKERS_CI_BRANCH },
  { provider: 'cloudflare', sha: process.env.CF_PAGES_COMMIT_SHA, ref: process.env.CF_PAGES_BRANCH },
  { provider: 'github', sha: process.env.GITHUB_SHA, ref: process.env.GITHUB_REF_NAME },
  { provider: 'git', sha: gitHead(), ref: gitRef() }
];

const selected = candidates.find(({ sha }) => typeof sha === 'string' && sha.trim()) || { provider: 'unknown', sha: 'unknown', ref: '' };
const provider = selected.provider;
const sha = String(selected.sha || 'unknown').trim();
const ref = String(selected.ref || '').trim();
const validSha = /^[0-9a-f]{40}$/i.test(sha);

let provenanceClass = 'UNKNOWN_INVALID';
if ((provider === 'vercel' || provider === 'cloudflare') && validSha && ref) provenanceClass = 'PROVIDER_BOUND';
else if (provider === 'github' && validSha && ref) provenanceClass = 'CI_BOUND';
else if (provider === 'git' && validSha) provenanceClass = 'LOCAL_GIT';

const shortSha = validSha ? sha.slice(0, 9) : 'unknown';
const meta = {
  schema: 'bitevo.public-build.v2',
  sha,
  shortSha,
  provider,
  ref,
  provenanceClass
};
const serialized = `${JSON.stringify(meta, null, 2)}\n`;

mkdirSync('src/generated', { recursive: true });
mkdirSync('public', { recursive: true });
writeFileSync('src/generated/build-meta.json', serialized, 'utf8');
writeFileSync('public/version.json', serialized, 'utf8');

console.log(`BITEVO_BUILD_META sha=${sha} provider=${provider} ref=${ref || 'unknown'} provenance=${provenanceClass}`);
