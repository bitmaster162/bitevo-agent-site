export async function GET() {
	const manifest = {
		version: 'public-v1',
		purpose: 'Public guide discovery manifest',
		guides_index: '/guides',
		primary_audit: '/agent-authority-audit',
		audit_intake: '/audit-intake',
		boundary: 'Internal hostnames, IP addresses, operator-control endpoints, credentials, private registry paths, changing runtime metrics and secret-bearing logs are intentionally excluded from this public API.',
	};

	return new Response(JSON.stringify(manifest, null, 2), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'public, max-age=300',
			'X-Robots-Tag': 'noindex',
		},
	});
}
