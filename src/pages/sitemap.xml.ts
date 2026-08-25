export const prerender = true;

const base = 'https://bitevo.work';
// Keep focused commercial routes explicit so release verification can bind each public offer to a canonical URL.
const routes = [
  '/',
  '/doctrine',
  '/artifacts',
  '/proof',
  '/dogfood-self-audit',
  '/mapper',
  '/workspace',
  '/build',
  '/sample-audit',
  '/sample-message',
  '/sample-deployment',
  '/diagnostic',
  '/assurance',
  '/evidence-readiness',
  '/control-validation',
  '/phuket-ai-workflow',
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
  '/universe',
  '/vision',
  '/ru',
  '/ru/doctrine',
  '/ru/artifacts',
  '/ru/proof',
  '/ru/dogfood-self-audit',
  '/ru/mapper',
  '/ru/workspace',
  '/ru/diagnostic',
  '/ru/agent-authority-audit',
  '/ru/audit-intake',
  '/ru/pricing',
  '/ru/consulting',
  '/ru/continuityos',
  '/ru/guides',
  '/ru/build',
  '/ru/universe',
  '/ru/vision'
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