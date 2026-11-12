// R50-D authorized successor: exact SHA pins for PR #252.
// Authority: CLAUDE_INBOX/20261112_2010_DECISIONS.md, Opus 20261112 review.
// Historical R50-D pins remain accepted independently. Never blanket-whitelist.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const pins = Object.freeze({
  "vercel.json": "bc60f5ae87a84bf71ab3f094b0a074094a686956170f1d5f043669ff6e1075de",
  "package.json": "d3505d1d8c80f788b66f36f38f818240a1c4a4573fac8eb45a0ca8109b0c6ef0",
  ".github/workflows/quality-gate.yml": "2b3259596d615091136d59a364e43e874538255543e44fa52048bd0d82ee0781",
  ".github/workflows/bitevo-precheck.yml": "fc6f41d654dfae97db89cd45df675e2d91f43e937e99af495392bbf08dcfb97e",
  "scripts/verify-scope-handoff-r1-runtime.mjs": "33ebb615af01d63662cce13c5b510640a50d20800442d36bad4d0c0394d2ef28",
  "tests/guides-response-headers-node24-r1.test.mjs": "60d71a235ddf41c12aaad92cd58490fb3f2a94f30740c7e7e57620d7b1f65aac"
});
const hash = raw => createHash('sha256').update(raw.replace(/\r\n/g, '\n')).digest('hex');
export function isExactGuidesApiNode24Successor(overrides = {}) {
  try {
    if (!overrides || typeof overrides !== 'object' ||
        Object.keys(overrides).some(key => !Object.hasOwn(pins, key))) return false;
    const files = {};
    for (const [path, sha] of Object.entries(pins)) {
      files[path] = Object.hasOwn(overrides, path) ? overrides[path] :
        readFileSync(new URL('../' + path, import.meta.url), 'utf8');
      if (typeof files[path] !== 'string' || hash(files[path]) !== sha) return false;
    }
    const v = JSON.parse(files['vercel.json']);
    const p = JSON.parse(files['package.json']);
    const json = 'application/json; charset=utf-8';
    const h = { 'Content-Type':json, 'X-Robots-Tag':'noindex' };
    const exact = v.routes.filter(x => x.src === '/api/guides');
    const rules = v.headers.filter(x => x.source === '/api/guides');
    const test = 'node --test --test-reporter=tap tests/guides-response-headers-node24-r1.test.mjs';
    const mandatory = 'node --test --test-reporter=tap tests/b1-2-r50-operator-admission.test.mjs tests/b1-2-r50-durable-grant.test.mjs tests/b1-2-r50-package-runtime.test.mjs';
    return p.engines?.node === '24.x' && p.scripts?.['verify:core']?.endsWith(' && '+test+' && '+mandatory) &&
      v.routes[0]?.src === '/(.*)' && v.routes[0]?.continue === true &&
      exact.length === 1 && exact[0].continue === true &&
      exact.every(x => Object.keys(h).every(k => x.headers?.[k] === h[k])) &&
      rules.length === 1 && rules[0].headers.length === 2 &&
      rules[0].headers.every(x => h[x.key] === x.value) &&
      v.git?.deploymentEnabled?.['gpt/bitevo-guides-headers-node24-20261112'] === false;
  } catch { return false; }
}
