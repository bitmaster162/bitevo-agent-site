export const prerender = true;

export function GET() {
  return new Response(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /guides/',
      'Allow: /guides/ai-agent-reliability-audit',
      'Allow: /guides/security-sandboxing',
      'Allow: /guides/fleet-coordinator-drift-monitoring',
      'Allow: /guides/d3-tool-io-bridge-contract',
      '',
      'Sitemap: https://bitevoagentsite.vercel.app/sitemap.xml'
    ].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  );
}
