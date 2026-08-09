export const prerender = true;

const base = 'https://bitevoagentsite.vercel.app';
const routes = [
  '/',
  '/agent-authority-audit',
  '/audit-intake',
  '/pricing',
  '/consulting',
  '/continuityos',
  '/guides',
  '/universe'
];

export function GET() {
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map(route => `  <url><loc>${base}${route}</loc></url>`).join('\n')}\n</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
