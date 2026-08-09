export async function GET() {
	const content = [
		`# BitEvo Public Product Manifest`,
		``,
		`BitEvo provides engineering services for reviewing AI-agent authority, evidence, logging, traceability, and operational controls.`,
		``,
		`## Primary service`,
		`Agent Authority & Evidence Audit`,
		`- Fixed price: USD 4,900`,
		`- Duration: 5 working days`,
		`- Scope: 1 staging/test workflow`,
		`- Integrations: up to 3 tools / APIs / MCP servers`,
		`- Test plan: 10-20 agreed failure scenarios`,
		`- Deliverables: executive report, reproducible evidence pack, prioritized repair backlog, one retest`,
		``,
		`## Other public offers`,
		`- Free: 20-minute scope/authority triage; no written security conclusion, exploit work, or deep log analysis.`,
		`- USD 1,500: reduced-scope entry audit of one critical action chain and one main failure hypothesis; no full authority map or included retest.`,
		`- Hardening: quoted separately after verified findings.`,
		``,
		`## Boundaries`,
		`This is an engineering audit. It is not certification, legal advice, guaranteed security, guaranteed absence of defects, production penetration testing by default, or a profit promise.`,
		`Written scope and Rules of Engagement are required before testing.`,
		`Do not submit API keys, passwords, tokens, private keys, wallet seeds, production credentials, or customer secrets through public forms.`,
		``,
		`## Public routes`,
		`- /agent-authority-audit`,
		`- /audit-intake`,
		`- /pricing`,
		`- /consulting`,
		`- /continuityos`,
		``,
		`This manifest is intentionally static and contains no runtime telemetry, internal checkpoints, infrastructure identifiers, private operational state, or control endpoints.`
	].join('\n');

	return new Response(content, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8'
		}
	});
}
