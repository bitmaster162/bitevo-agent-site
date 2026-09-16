import registry from '../data/public-route-registry.json';
import buildMeta from '../generated/build-meta.json';

export const prerender = true;

const base = 'https://bitevo.work';
const routes = registry.routes.filter(route => route.indexable).map(route => route.path);
const lastmod = String(buildMeta.commitDate || '');
if (!/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) throw new Error(`Invalid sitemap lastmod commit date: ${lastmod || 'missing'}`);

export function GET() {
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map(route => `  <url><loc>${base}${route}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}\n</urlset>`;
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
