export const prerender = true;

export function GET() {
  const content = [
    '# BitEvo Public Product Manifest',
    '',
    'BitEvo provides bounded engineering review of AI-agent authority, evidence chains, failure controls, logging, traceability and operational recovery.',
    '',
    '## Primary service',
    'Agent Authority & Evidence Audit',
    '- Fixed price: USD 4,900',
    '- Duration: 5 working days',
    '- Scope: 1 staging/test workflow',
    '- Integrations: up to 3 tools / APIs / MCP servers',
    '- Failure plan: 10-20 agreed scenarios',
    '- Deliverables: executive report, reproducible evidence pack, prioritized repair backlog, one retest',
    '',
    '## Commercial ladder',
    '- Free: 20-minute scope/authority triage; qualification only.',
    '- USD 1,500: reduced-scope entry audit of one critical action chain and one primary failure hypothesis.',
    '- USD 4,900: primary Agent Authority & Evidence Audit.',
    '- Hardening: quoted separately only after verified findings.',
    '',
    '## Boundaries',
    'This is an engineering audit. It is not certification, legal advice, guaranteed security, guaranteed absence of defects, production penetration testing by default, or a profit promise.',
    'Written scope and Rules of Engagement are required before testing.',
    'Do not submit API keys, passwords, tokens, private keys, wallet seeds, production credentials, or customer secrets through public forms.',
    '',
    '## Canonical public routes',
    '- /',
    '- /agent-authority-audit',
    '- /audit-intake',
    '- /pricing',
    '- /consulting',
    '- /continuityos',
    '- /guides',
    '- /universe',
    '',
    '## Reviewed public research notes',
    '- /guides/ai-agent-reliability-audit',
    '- /guides/security-sandboxing',
    '- /guides/fleet-coordinator-drift-monitoring',
    '- /guides/d3-tool-io-bridge-contract',
    '',
    'Historical guide routes are not part of the reviewed public research set and may be redirected to /guides.',
    'This manifest intentionally contains no runtime telemetry, internal checkpoints, infrastructure identifiers, private operational state, credentials, or control endpoints.'
  ].join('\n');

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300'
    }
  });
}
