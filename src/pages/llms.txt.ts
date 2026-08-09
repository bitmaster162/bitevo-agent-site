export const prerender = true;

export function GET() {
  const content = [
    '# BitEvo Public Product Manifest',
    '',
    'BitEvo audits the action layer of AI-agent systems: what a workflow is allowed to change, what evidence must exist before it acts, how the external effect is confirmed, and how uncertainty is contained or recovered from.',
    '',
    '## Core model',
    '- Audit object: one concrete action-capable workflow, not an abstract model score.',
    '- Authority: what may act, on which object, under whose approval, and which transitions are prohibited.',
    '- Evidence: what must be present, fresh and attributable at decision time.',
    '- Effect: whether the intended external change is independently confirmed.',
    '- Recovery: how retries, interruption, stale state, partial effects and ambiguity are contained.',
    '- Owner decision: expand authority, constrain it, repair the workflow, or retest.',
    '',
    '## Primary service',
    'Agent Authority & Evidence Audit',
    '- Fixed price: USD 4,900',
    '- Duration: 5 working days',
    '- Scope: 1 staging/test workflow',
    '- Integrations: up to 3 tools / APIs / MCP servers',
    '- Failure plan: 10-20 agreed scenarios',
    '- Deliverables: authority map, reproducible evidence pack, owner decision backlog, one retest',
    '',
    '## Commercial decision ladder',
    '- Free / 20 minutes: decide whether the workflow is worth auditing and identify the critical action, authority owner and staging boundary.',
    '- USD 1,500 Entry Audit: determine whether one primary failure hypothesis on one critical action chain is reproducible and decision-relevant.',
    '- USD 4,900 Primary Audit: decide whether one workflow has enough evidence, effect confirmation and recovery control for its current or proposed authority.',
    '- Hardening: quoted separately only after verified findings identify the real control gap.',
    '',
    '## Boundaries',
    'This is a bounded engineering audit. It is not certification, a universal AI safety score, legal advice, guaranteed security, guaranteed absence of defects, production penetration testing by default, or a profit promise.',
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
