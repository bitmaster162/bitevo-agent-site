import { buildOwnerCopilotOutput, evaluateEnvelope, loadPolicy } from './site-agent-intake-adapter.mjs';

const policy = await loadPolicy();
let seq = 0;
const base = (lane, intent, fields = {}) => ({
  schema_version: 'SITE_AGENT_ENVELOPE_V1',
  lane,
  session_id: `test-session-${String(++seq).padStart(2, '0')}`,
  created_at: '2026-09-01T11:30:00.000Z',
  intent,
  fields,
  source: { page_path: '/test', utm_source: null, utm_medium: null, utm_campaign: null, ref: null },
  state: 'DRAFT_LOCAL',
  proposed_claims: [],
  requested_effects: [],
  handoff_role: null,
  evidence_refs: []
});

const cases = [
  ['yakov valid handoff', { ...base('yakov','trip',{dates:'10-12 Sep',party:'2',interest:'islands'}), requested_effects:['human_handoff'] }, 'READY_FOR_HUMAN_HANDOFF'],
  ['yakov missing', base('yakov','trip',{party:'2',interest:'islands'}), 'NEEDS_INFO'],
  ['yakov sensitive passport', base('yakov','trip',{dates:'10 Sep',party:'2',interest:'passport 123'}), 'BLOCKED_SENSITIVE_INPUT'],
  ['global auto booking denied', { ...base('yakov','trip',{dates:'10 Sep',party:'2',interest:'islands'}), requested_effects:['auto_booking'] }, 'BLOCKED_POLICY'],
  ['ivan valid handoff', { ...base('ivan','muay',{goal:'technique'}), requested_effects:['human_handoff'] }, 'READY_FOR_HUMAN_HANDOFF'],
  ['ivan medical claim denied', { ...base('ivan','sc',{goal:'power'}), proposed_claims:['medical_advice'] }, 'BLOCKED_POLICY'],
  ['stas correct role', { ...base('stas','phuket',{dates:'10 Sep',party:'4',interest:'family day'}), requested_effects:['human_handoff'], handoff_role:'Robert' }, 'READY_FOR_HUMAN_HANDOFF'],
  ['stas wrong role', { ...base('stas','phuket',{dates:'10 Sep',party:'4',interest:'family day'}), requested_effects:['human_handoff'], handoff_role:'Stas' }, 'BLOCKED_POLICY'],
  ['haven cook valid', base('haven','cook',{period:'10 Sep',party:'3',format:'meal prep',preferences:'Mediterranean'}), 'READY_FOR_HUMAN_REVIEW'],
  ['haven medical claim denied', { ...base('haven','family',{period:'10 Sep',area:'Rawai',need:'companionship',schedule:'day'}), proposed_claims:['medical_care'] }, 'BLOCKED_POLICY'],
  ['haven medical record blocked', base('haven','family',{period:'10 Sep',area:'Rawai',need:'medical record attached',schedule:'day'}), 'BLOCKED_SENSITIVE_INPUT'],
  ['dar valid review', base('dar','business',{company:'Cafe',city:'Moscow',product:'cups'}), 'READY_FOR_HUMAN_REVIEW'],
  ['dar stock claim denied', { ...base('dar','business',{company:'Cafe'}), proposed_claims:['stock'] }, 'BLOCKED_POLICY'],
  ['pharaohs valid phone handoff', { ...base('pharaohs','reservation',{date:'Sep 10'}), requested_effects:['human_handoff'] }, 'READY_FOR_HUMAN_HANDOFF'],
  ['pharaohs reservation claim denied', { ...base('pharaohs','reservation',{date:'Sep 10'}), proposed_claims:['confirmed_reservation'] }, 'BLOCKED_POLICY'],
  ['creator valid review', base('creator','application_summary',{adult_self_confirmed:true,voluntary_consent:true,country:'France',workplace:'France'}), 'READY_FOR_HUMAN_REVIEW'],
  ['creator adult gate', base('creator','application_summary',{adult_self_confirmed:false,voluntary_consent:true,country:'France',workplace:'France'}), 'NEEDS_INFO'],
  ['creator ID blocked', base('creator','application_summary',{adult_self_confirmed:true,voluntary_consent:true,country:'France',workplace:'France',note:'ID scan'}), 'BLOCKED_SENSITIVE_INPUT'],
  ['bitevo valid review', base('bitevo','audit',{company:'Acme',workflow:'agent',pain:'manual checks',outcome:'safer review',systems:'GitHub',consequence:'bad deploy',never:'deploy'}), 'READY_FOR_HUMAN_REVIEW'],
  ['bitevo secret blocked', base('bitevo','audit',{company:'Acme',workflow:'agent',pain:'api key abc',outcome:'review',systems:'GitHub',consequence:'risk',never:'deploy'}), 'BLOCKED_SENSITIVE_INPUT'],
  ['unknown lane denied', base('unknown','trip',{}), 'BLOCKED_POLICY']
];

let passed = 0;
for (const [name, envelope, expected] of cases) {
  const receipt = evaluateEnvelope(envelope, policy);
  const copilot = buildOwnerCopilotOutput(envelope, receipt);
  const ok = receipt.decision === expected && receipt.write_allowed === false && copilot.execute_authority === false && copilot.write_authority === false;
  if (ok) passed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} :: ${receipt.decision}`);
}

console.log(`TOTAL ${passed}/${cases.length} PASS`);
if (passed !== cases.length) process.exit(1);
