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
  // Owner-approved A-D R41: exact 142-route rendered fingerprint successor only.
  const currentnessSha = hash(content['src/data/sitemap-currentness.json']);
  const isR41ApprovedCurrentness = currentnessSha === '78ebc3a97fafeb2b03e58f6b478b764cccfbafef404bdf637f531b15419a2aaa';
  const allowedCurrentnessHashes = new Set([
    pins['src/data/sitemap-currentness.json'],
    '393afbf298aefa6de91c7b63a882a2ad2156e3fdf11c9a080068c12e8237163e',
    '5995adf644771bb29ce7afb5535235bd5aadd4047011fc1b81ffa5da8973187b',
    'd87a40175f60f8c653fff8c1aad0916f82b5adbb7f3bd7be8d5de75f6b4a06f9',
    '21a1a8d9a17d4696f845a4de58d8af8ffe2b334f29a6340be5919336fab7df9c',
    // 2026-11-14 audited offer + Article schema + canonical fix, 142-route exact render.
    'a685886ddef0621d54c048e061452ba42dd15b669ab71adc2d38e72eabd8aeb3',
    // 2026-11-14 all 16 indexed editorial guides have scoped Article + author; 11 source-render updates.
    '5a8485acb844a0c125a073e1fcaac085c918b520187e47f39484acb53f12ecd1',
    // 2026-11-15 Opus B1/B2 repair: 7 modified published routes, 142 exact currentness records.
    'b50fdcc5a2f9b7b7b0f32394ba2d28e6564bea3545292b20961e22ae35feca11',
    // 2026-11-16 owner-approved A-D: official two-build 142-route verify (R38).
    '78ebc3a97fafeb2b03e58f6b478b764cccfbafef404bdf637f531b15419a2aaa'
  ]);
  if (hash(content['src/data/public-route-registry.json']) !== pins['src/data/public-route-registry.json'] ||
      !allowedCurrentnessHashes.has(currentnessSha)) return false;
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
      if (!row?.indexable || row.locale !== locale || fingerprint?.lastmod !== (path === '/ru/agent-incidents' ? '2026-11-07' : (path.endsWith('/buyer-pack') ? (isR41ApprovedCurrentness ? '2026-11-16' : '2026-11-15') : '2026-10-29')) ||
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
