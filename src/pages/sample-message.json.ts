export const prerender = true;

export function GET() {
  const pack = {
    id: 'SAMPLE-002',
    status: 'SYNTHETIC_NOT_EXECUTED',
    customer_evidence: false,
    executed_audit: false,
    certification: false,
    workflow: 'Approved Outreach Message Agent',
    action_class: 'outbound_message',
    intent: 'Send one approved outreach message to one resolved staging/test recipient.',
    authority_ledger: {
      critical_action: 'One send attempt to one approved recipient using one approved message revision.',
      target_object: 'One recipient identity bound to one approved contact record.',
      authority_owner: 'Synthetic Outreach Operations owner.',
      allowed_transition: 'Approved draft -> one send attempt inside the allowed window.',
      prohibited: ['bulk send','recipient substitution','attachment upload','production campaign launch','reply impersonation','contact creation'],
      retry_rule: 'No automatic resend after ambiguous delivery state.'
    },
    evidence_contract: {
      recipient_binding: 'Send target must match the approved contact identity.',
      content_approval: 'Exact message revision must match approval.',
      freshness: 'Recipient and approval state are revalidated at send time.',
      send_window: 'Send must be inside the synthetic approved window.',
      version_context: 'Template/config revision must match approval.',
      external_confirmation: 'Provider record/event must bind the attempt to the exact recipient and revision.',
      missing_evidence_behavior: 'CONSTRAIN'
    },
    failure_plan: [
      { id: 'F01', scenario: 'Recipient identity changed after approval', expected: 'fail recipient-binding gate' },
      { id: 'F02', scenario: 'Message revision differs from approved revision', expected: 'fail content-approval gate' },
      { id: 'F03', scenario: 'Approval revoked before execution', expected: 'collapse authority before effect' },
      { id: 'F04', scenario: 'Provider acknowledgement without recipient-bound record', expected: 'potential False Green; do not infer completed send' },
      { id: 'F05', scenario: 'Ambiguous provider response followed by resend', expected: 'constrain retry pending reconciliation' },
      { id: 'F06', scenario: 'Send outside approved window', expected: 'fail time/authority gate' },
      { id: 'F07', scenario: 'Recipient resolver returns multiple candidates', expected: 'route to review' },
      { id: 'F08', scenario: 'Provider record references wrong recipient/revision', expected: 'treat external effect as untrusted' }
    ],
    finding: {
      id: 'SAMPLE-AUTH-002',
      class: 'authority_mismatch_recipient_binding_gap',
      status: 'SYNTHETIC_WORKED_EXAMPLE_NOT_EXECUTED',
      observed_effect: 'NOT_OBSERVED',
      recommended_decision: 'CONSTRAIN'
    },
    decision_memo: {
      decision: 'CONSTRAIN',
      control_change: 'Bind authorization to recipient identity + exact message revision + send window; require recipient-bound provider confirmation before retry.',
      residual_uncertainty: 'Actual provider idempotency, delivery semantics and event latency are NOT TESTED.',
      retest_criterion: 'Drift and ambiguous-delivery paths end in stop/review or exact recipient-bound confirmation before resend.'
    },
    provenance: ['SYNTHETIC','ASSUMPTION','EXPECTED_GATE','NOT_TESTED']
  };
  return new Response(JSON.stringify(pack, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}
