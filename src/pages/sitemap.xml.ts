export const prerender = true;

const base = 'https://bitevoagentsite.vercel.app';
const routes = [
  '/',
  '/doctrine',
  '/artifacts',
  '/sample-audit',
  '/diagnostic',
  '/agent-authority-audit',
  '/audit-intake',
  '/pricing',
  '/consulting',
  '/continuityos',
  '/guides',
  '/guides/ai-agent-reliability-audit',
  '/guides/security-sandboxing',
  '/guides/fleet-coordinator-drift-monitoring',
  '/guides/d3-tool-io-bridge-contract',
  '/universe'
];

export function GET() {
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map(route => `  <url><loc>${base}${route}</loc></url>`).join('\n')}\n</urlset>`;
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
