import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const pinned = Object.freeze({
  'src/data/public-route-registry.json': '1ce0eb7e7f56bbb0a1d7573f9024ffc1912fbb585af5dea30257124e28e5936c',
  'src/data/sitemap-currentness.json': '25442846f111bfc5414e5edbaa16b2d6c6065604f3d4cb9dbeaefd779b3e3a0d'
});
const sha = value => createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex');
export function isExactGuide4Successor(registryInput, currentnessInput) {
  try {
    const inputs = {
      'src/data/public-route-registry.json': registryInput ?? readFileSync(new URL('../src/data/public-route-registry.json', import.meta.url), 'utf8'),
      'src/data/sitemap-currentness.json': currentnessInput ?? readFileSync(new URL('../src/data/sitemap-currentness.json', import.meta.url), 'utf8')
    };
    if (Object.entries(pinned).some(([path,digest])=>sha(inputs[path])!==digest)) return false;
    const registry=JSON.parse(inputs['src/data/public-route-registry.json']);
    const manifest=JSON.parse(inputs['src/data/sitemap-currentness.json']);
    if (registry.schema!=='bitevo.public-route-registry/v1'||registry.routes.length!==147||
      registry.routes.filter(x=>x.indexable).length!==135||manifest.routes.length!==135) return false;
    for (const [lang,p] of [['en','/guides/mcp-and-coding-agent-governance'],['ru','/ru/guides/mcp-and-coding-agent-governance']]) {
      const r=registry.routes.find(x=>x.path===p),m=manifest.routes.find(x=>x.path===p);
      if(!r?.indexable||r.locale!==lang||m?.lastmod!=='2026-10-27') return false;
    }
    return true;
  } catch { return false; }
}
