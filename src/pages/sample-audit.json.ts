export const prerender = true;

export function GET() {
  const pack = {
    id: 'SAMPLE-001',
    title: 'Synthetic CRM Qualification Update Agent — Authority & Evidence Audit Pack',
    status: 'synthetic_worked_example_not_executed',
    customer_evidence: false,
    certification: false,
    executed_audit: false,
    doctrine: ['Authority Budget', 'Evidence Before Effect', 'False Green'],
    workflow: {
      environment: 'synthetic staging example',
      intent: 'Update qualification_status and qualification_reason on one matched CRM lead after qualification.',
      external_effect: 'Two fields on one bound staging CRM lead may change.',
      owner_question: 'How much autonomous CRM-write authority is justified by the available evidence and confirmation controls?'
    },
    authority_ledger: {
      critical_action: 'Update qualification_status and qualification_reason on one matched staging CRM lead.',
      target_object: 'Exactly one lead record bound to inbound lead_id.',
      authority_owner: 'Synthetic Product Operations owner for SAMPLE-001.',
      allowed_transitions: ['New -> Qualified', 'New -> Review Required'],
      prohibited: ['contact creation', 'record deletion', 'outbound messaging', 'unrelated-record mutation', 'production write', 'privilege change'],
      retry_rule: 'No blind retry after ambiguous write; reconcile external state first.',
      recovery_owner: 'Synthetic workflow operator.'
    },
    evidence_contract: {
      pre_action: [
        'lead_id resolves to the exact target staging CRM lead',
        'qualification evidence is present',
        'qualification evidence satisfies the illustrative freshness rule',
        'workflow configuration explicitly allows the two target fields and transition',
        'expected workflow/config version matches decision trace'
      ],
      illustrative_freshness_rule: '10 minutes; sample-specific and not a universal BitEvo threshold',
      post_action: 'Read-after-write confirms intended values on the same CRM lead object.',
      missing_evidence_behavior: 'CONSTRAIN and preserve trace; do not create another external effect.'
    },
    failure_plan: [
      { id: 'F01', scenario: 'stale qualification source', expected_gate: 'evidence gate fails before write' },
      { id: 'F02', scenario: 'lead_id resolves to different CRM object', expected_gate: 'object-binding gate fails before write' },
      { id: 'F03', scenario: 'internal acknowledgement without external state change', expected_gate: 'potential False Green; do not infer success' },
      { id: 'F04', scenario: 'ambiguous write followed by retry', expected_gate: 'retry remains constrained until reconciliation' },
      { id: 'F05', scenario: 'approval/config no longer allows target field', expected_gate: 'authority gate fails before write' },
      { id: 'F06', scenario: 'workflow version drift', expected_gate: 'evidence rejected or routed to review' },
      { id: 'F07', scenario: 'partial field update', expected_gate: 'external confirmation exposes mismatch and triggers recovery' },
      { id: 'F08', scenario: 'confirmation references different object', expected_gate: 'result treated as untrusted and authority constrained' }
    ],
    finding_record: {
      id: 'SAMPLE-FG-001',
      class: 'False Green / external-effect confirmation gap',
      status: 'synthetic_worked_example_not_executed',
      trigger: 'Orchestration layer reports success while required external read-back is absent, unchanged or bound to a different object.',
      observed_effect: 'not_observed_in_public_sample',
      decision_relevance: 'Owner cannot distinguish completed write from accepted/enqueued/no-effect/wrong-object outcomes without independent confirmation.',
      recommended_decision: 'CONSTRAIN'
    },
    decision_memo: {
      decision: 'CONSTRAIN',
      reason: 'Proposed Authority Budget exceeds the evidence available to prove the external effect under SAMPLE-FG-001.',
      control_change: 'Require same-object external confirmation as an explicit completion gate and block blind retry while state is ambiguous.',
      authority_after_decision: 'Workflow may prepare the proposed update; ambiguous writes require reconciliation before another mutation.',
      residual_uncertainty: 'Actual CRM consistency, latency and idempotency behavior are NOT TESTED in this synthetic example.',
      retest_criterion: 'Trace ends in confirmed same-object expected state or an explicit constrained/recovery state; never silent success.'
    },
    provenance: {
      synthetic: 'Defined for the worked example only.',
      assumption: 'A condition used to demonstrate the decision structure, not an observation.',
      expected_gate: 'The behavior the audit would test for in a real engagement.',
      not_tested: 'No empirical claim is made.'
    },
    public_boundaries: [
      'not customer evidence',
      'not an executed audit',
      'not certification',
      'not a universal safety score',
      'contains no customer data, credentials or private infrastructure'
    ]
  };

  return new Response(JSON.stringify(pack, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300'
    }
  });
}
