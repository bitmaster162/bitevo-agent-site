import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const pinned = Object.freeze({
  'src/data/public-route-registry.json': 'b003e4fb817b10a4f2909b8b6c5231bb64c7adab01be7ea3ff226ccd14471ca3',
  'src/data/sitemap-currentness.json': 'd0b25294483eb792ef3886bc1343977fcfaa55ac8689f73397759e302abcebcb'
});
function hash(value) { return createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex'); }
export function isExactGuide3Successor(registryInput, currentnessInput) {
  try {
    const source = {
      'src/data/public-route-registry.json': registryInput ?? readFileSync(new URL('../src/data/public-route-registry.json', import.meta.url), 'utf8'),
      'src/data/sitemap-currentness.json': currentnessInput ?? readFileSync(new URL('../src/data/sitemap-currentness.json', import.meta.url), 'utf8')
    };
    for (const [path, expected] of Object.entries(pinned))
      if (hash(source[path]) !== expected) return false;
    const registry = JSON.parse(source['src/data/public-route-registry.json']);
    const currentness = JSON.parse(source['src/data/sitemap-currentness.json']);
    if (registry.schema !== 'bitevo.public-route-registry/v1' || registry.routes.length !== 147 ||
        registry.routes.filter(x => x.indexable).length !== 135 ||
        registry.routes.filter(x => x.indexable && x.locale === 'en').length !== 68 ||
        registry.routes.filter(x => x.indexable && x.locale === 'ru').length !== 67 ||
        currentness.routes.length !== 135) return false;
    for (const [lang, path] of [['en','/guides/false-green-and-retry-safety'], ['ru','/ru/guides/false-green-and-retry-safety']]) {
      const route = registry.routes.find(x=>x.path===path), row = currentness.routes.find(x=>x.path===path);
      if (!route?.indexable || route.locale !== lang || row?.lastmod !== '2026-10-26') return false;
    }
    return true;
  } catch { return false; }
}
