export const prerender = true;

export function GET() {
  const pack = {
    id: 'SAMPLE-003',
    status: 'SYNTHETIC_NOT_EXECUTED',
    customer_evidence: false,
    executed_audit: false,
    certification: false,
    workflow: 'Staging Configuration Change Agent',
    action_class: 'deployment_config_change',
    intent: 'Change one approved configuration key in one staging environment.',
    authority_ledger: {
      critical_action: 'One approved staging config key transition.',
      target_object: 'One config key in one bound staging service/environment.',
      authority_owner: 'Synthetic Platform Engineering owner.',
      allowed_transition: 'Captured baseline value -> one approved target value.',
      prohibited: ['production mutation','secret rotation','privilege change','unrelated config write','deployment promotion','destructive rollback'],
      retry_rule: 'No repeated mutation after ambiguous apply state.'
    },
    evidence_contract: {
      environment_binding: 'Target resolves to the exact approved staging environment.',
      baseline_evidence: 'Current value and revision match the decision trace before mutation.',
      approval_evidence: 'Exact key/value transition is approved for the bound environment.',
      freshness: 'Baseline/config state is re-read immediately before mutation.',
      version_context: 'Workflow, schema and environment revision match approval context.',
      external_confirmation: 'Same-environment read-back confirms exact target value and revision.',
      missing_evidence_behavior: 'REPAIR_OR_CONSTRAIN'
    },
    failure_plan: [
      { id: 'F01', scenario: 'Environment alias resolves to production', expected: 'fail environment-binding gate' },
      { id: 'F02', scenario: 'Baseline changed after approval', expected: 'treat approval context as stale' },
      { id: 'F03', scenario: 'Config schema/version drift', expected: 'fail version-context gate' },
      { id: 'F04', scenario: 'Apply acknowledgement but read-back unchanged', expected: 'potential False Green; do not infer completion' },
      { id: 'F05', scenario: 'Partial apply / propagation disagreement', expected: 'constrain follow-up mutation' },
      { id: 'F06', scenario: 'Ambiguous apply followed by retry', expected: 'block retry pending reconciliation' },
      { id: 'F07', scenario: 'Rollback target differs from captured baseline', expected: 'fail rollback authority' },
      { id: 'F08', scenario: 'Read-back from different environment/revision', expected: 'invalidate external confirmation' }
    ],
    finding: {
      id: 'SAMPLE-CTX-003',
      class: 'version_context_environment_binding_gap',
      status: 'SYNTHETIC_WORKED_EXAMPLE_NOT_EXECUTED',
      observed_effect: 'NOT_OBSERVED',
      recommended_decision: 'REPAIR'
    },
    decision_memo: {
      decision: 'REPAIR',
      control_change: 'Bind approval to immutable environment identity + baseline revision; validate immediately before mutation and confirm same environment after.',
      residual_uncertainty: 'Actual platform propagation, rollback semantics and consistency windows are NOT TESTED.',
      retest_criterion: 'Alias drift, baseline drift and ambiguous-apply paths end in fail-before-write or exact bound-environment confirmation/recovery.'
    },
    provenance: ['SYNTHETIC','ASSUMPTION','EXPECTED_GATE','NOT_TESTED']
  };
  return new Response(JSON.stringify(pack, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}
