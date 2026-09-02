export const prerender = true;

const base = 'https://bitevo.work';
// Keep focused commercial routes explicit so every reviewed public surface is bound to a canonical URL.
const routes = [
  '/',
  '/doctrine',
  '/artifacts',
  '/proof',
  '/dogfood-self-audit',
  '/mapper',
  '/workspace',
  '/build',
  '/build/exception-workflow-diagnostic',
  '/sample-audit',
  '/sample-message',
  '/sample-deployment',
  '/diagnostic',
  '/assurance',
  '/evidence-readiness',
  '/control-validation',
  '/mcp-governance',
  '/mcp-governance-checklist',
  '/coding-agent-governance',
  '/failure-recovery',
  '/agent-identity-worksheet',
  '/trust-evidence-template',
  '/ai-skill-lab-sample',
  '/security',
  '/entry-audit',
  '/consequential-actions',
  '/phuket-ai-workflow',
  '/operator',
  '/agent-authority-audit',
  '/audit-intake',
  '/pricing',
  '/consulting',
  '/continuityos',
  '/ruap',
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