import registry from '../data/public-route-registry.json';
import currentness from '../data/sitemap-currentness.json';
import buildMeta from '../generated/build-meta.json';

export const prerender = true;

const base = 'https://bitevo.work';
const routes = registry.routes.filter(route => route.indexable).map(route => route.path);
const currentnessByRoute = new Map(currentness.routes.map(route => [route.path, route]));
const fallbackLastmod = String(buildMeta.commitDate || '');
if (!/^\d{4}-\d{2}-\d{2}$/.test(fallbackLastmod)) throw new Error(`Invalid sitemap fallback commit date: ${fallbackLastmod || 'missing'}`);

function lastmodFor(route) {
  const value = String(currentnessByRoute.get(route)?.lastmod || fallbackLastmod);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid sitemap lastmod for ${route}: ${value || 'missing'}`);
  return value;
}

export function GET() {
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map(route => `  <url><loc>${base}${route}</loc><lastmod>${lastmodFor(route)}</lastmod></url>`).join('\n')}\n</urlset>`;
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
