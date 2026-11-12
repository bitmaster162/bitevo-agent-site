import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const pins = Object.freeze({
  'src/data/public-route-registry.json': 'bc4d8876b9cf92a7925ffe276e66ecdb387196536a83696c27fb6f830f7e5759',
  'src/data/sitemap-currentness.json': '78a4015a51bcd0794473eb6bdcea5b260ef8bd01e227b29574513bc4a9855797'
});
const hash = value => createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex');
export function isExactRGapsSuccessor(registryInput, currentnessInput) {
  try {
    const content = {
      'src/data/public-route-registry.json': registryInput ?? readFileSync(new URL('../src/data/public-route-registry.json', import.meta.url), 'utf8'),
      'src/data/sitemap-currentness.json': currentnessInput ?? readFileSync(new URL('../src/data/sitemap-currentness.json', import.meta.url), 'utf8')
    };
    // Admit only the prior sealed manifest or the exact A3 V2 /sample-audit
  // fingerprint successor; do not widen route or registry acceptance.
  const allowedCurrentnessHashes = new Set([
    pins['src/data/sitemap-currentness.json'],
    '393afbf298aefa6de91c7b63a882a2ad2156e3fdf11c9a080068c12e8237163e'
  ]);
  if (hash(content['src/data/public-route-registry.json']) !== pins['src/data/public-route-registry.json'] ||
      !allowedCurrentnessHashes.has(hash(content['src/data/sitemap-currentness.json']))) return false;
    const registry = JSON.parse(content['src/data/public-route-registry.json']);
    const manifest = JSON.parse(content['src/data/sitemap-currentness.json']);
    if (registry.schema !== 'bitevo.public-route-registry/v1' || registry.routes.length !== 154 ||
        registry.routes.filter(r => r.indexable).length !== 142 ||
        registry.routes.filter(r => r.indexable && r.locale === 'en').length !== 71 ||
        registry.routes.filter(r => r.indexable && r.locale === 'ru').length !== 71 ||
        manifest.routes.length !== 142) return false;
    const expected = [['/contact','en'],['/ru/contact','ru'],['/buyer-pack','en'],['/ru/buyer-pack','ru'],['/ru/agent-incidents','ru']];
    for (const [path,locale] of expected) {
      const row = registry.routes.find(r => r.path === path);
      const fingerprint = manifest.routes.find(r => r.path === path);
      if (!row?.indexable || row.locale !== locale || fingerprint?.lastmod !== (path === '/ru/agent-incidents' ? '2026-11-07' : (path.endsWith('/buyer-pack') ? '2026-10-30' : '2026-10-29')) ||
          !/^sha256:[a-f0-9]{64}$/.test(fingerprint.fingerprint)) return false;
    }
    const paired = registry.routes.find(r => r.path === '/agent-incidents');
    if (!paired || paired.localePair === 'deferred' || paired.localePairReason) return false;
    return true;
  } catch { return false; }
}

export function rgapsExpectedFingerprint(path, historicalFingerprint) {
  if (!isExactRGapsSuccessor()) return historicalFingerprint;
  const manifest = JSON.parse(readFileSync(new URL('../src/data/sitemap-currentness.json', import.meta.url), 'utf8'));
  return manifest.routes.find(row => row.path === path)?.fingerprint ?? null;
}

export function rgapsExpectedLastmod(path, historicalLastmod) {
  if (!isExactRGapsSuccessor()) return historicalLastmod;
  const manifest = JSON.parse(readFileSync(new URL('../src/data/sitemap-currentness.json', import.meta.url), 'utf8'));
  return manifest.routes.find(row => row.path === path)?.lastmod ?? null;
}
