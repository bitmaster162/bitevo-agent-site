export const prerender = true;

export function GET() {
  const manifest = {
    version: 'public-v2',
    purpose: 'Reviewed public research discovery manifest',
    guides_index: '/guides',
    primary_audit: '/agent-authority-audit',
    audit_intake: '/audit-intake',
    reviewed_guides: [
      '/guides/ai-agent-reliability-audit',
      '/guides/security-sandboxing',
      '/guides/fleet-coordinator-drift-monitoring',
      '/guides/d3-tool-io-bridge-contract'
    ],
    legacy_policy: 'Historical guide routes are not in the reviewed public set and may redirect to /guides.',
    boundary: 'Internal hostnames, IP addresses, operator-control endpoints, credentials, private registry paths, changing runtime metrics and secret-bearing logs are intentionally excluded from this public API.'
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Robots-Tag': 'noindex'
    }
  });
}
