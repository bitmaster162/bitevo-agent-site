import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const pinned = Object.freeze({
  'src/data/public-route-registry.json': '52749f610fead495b4b5256f107388653d924b862114f7cb1f30503bbae807af',
  'src/data/sitemap-currentness.json': 'ce26f6747e6b48162860f808af65c8b975464101d378667fa2270c98d3eb958e'
});
function hash(value) { return createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex'); }
export function isExactGuides34Successor(registryInput, currentnessInput) {
  try {
    const source = {
      'src/data/public-route-registry.json': registryInput ?? readFileSync(new URL('../src/data/public-route-registry.json', import.meta.url), 'utf8'),
      'src/data/sitemap-currentness.json': currentnessInput ?? readFileSync(new URL('../src/data/sitemap-currentness.json', import.meta.url), 'utf8')
    };
    for (const [path, expected] of Object.entries(pinned))
      if (hash(source[path]) !== expected) return false;
    const registry = JSON.parse(source['src/data/public-route-registry.json']);
    const currentness = JSON.parse(source['src/data/sitemap-currentness.json']);
    if (registry.schema !== 'bitevo.public-route-registry/v1' || registry.routes.length !== 149 ||
        registry.routes.filter(x => x.indexable).length !== 137 ||
        registry.routes.filter(x => x.indexable && x.locale === 'en').length !== 69 ||
        registry.routes.filter(x => x.indexable && x.locale === 'ru').length !== 68 ||
        currentness.routes.length !== 137) return false;
    for (const [lang, path] of [['en','/guides/false-green-and-retry-safety'], ['ru','/ru/guides/false-green-and-retry-safety'], ['en','/guides/mcp-and-coding-agent-governance'], ['ru','/ru/guides/mcp-and-coding-agent-governance']]) {
      const route = registry.routes.find(x=>x.path===path), row = currentness.routes.find(x=>x.path===path);
      if (!route?.indexable || route.locale !== lang || row?.lastmod !== (path.includes('mcp-and-coding-agent-governance') ? '2026-10-27' : '2026-10-26')) return false;
    }
    return true;
  } catch { return false; }
}
