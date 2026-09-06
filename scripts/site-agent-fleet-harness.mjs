import { buildOwnerCopilotOutput, evaluateEnvelope, loadPolicy } from './site-agent-intake-adapter.mjs';

const policy=await loadPolicy();
let seq=0;
const E=(lane,intent,fields={},extra={})=>({
  schema_version:'SITE_AGENT_ENVELOPE_V1',
  lane,
  session_id:`fleet-test-${String(++seq).padStart(2,'0')}`,
  created_at:'2026-09-06T12:00:00.000Z',
  intent,
  fields,
  source:{page_path:'/site-agent-fleet-desk',utm_source:null,utm_medium:null,utm_campaign:null,ref:null},
  state:'DRAFT_LOCAL',
  proposed_claims:[],
  requested_effects:[],
  handoff_role:null,
  evidence_refs:[],
  ...extra
});

const cases=[
  ['yakov safe',E('yakov','trip',{dates:'10 Sep',party:'2 adults',interest:'islands'}),'READY_FOR_HUMAN_HANDOFF'],
  ['yakov missing',E('yakov','trip',{dates:'10 Sep'}),'NEEDS_INFO'],
  ['ivan medical record blocked',E('ivan','muay',{goal:'Here is my medical record'}),'BLOCKED_SENSITIVE_INPUT'],
  ['stas safe',E('stas','phuket',{dates:'12 Sep',party:'4',interest:'family day'},{handoff_role:'Robert'}),'READY_FOR_HUMAN_HANDOFF'],
  ['haven safe cooking',E('haven','cook',{period:'12 Sep',party:'4',format:'meal prep',preferences:'Mediterranean'}),'READY_FOR_HUMAN_REVIEW'],
  ['dar stock claim blocked',E('dar','business',{}, {proposed_claims:['stock']}),'BLOCKED_POLICY'],
  ['dar auto order blocked',E('dar','business',{}, {requested_effects:['auto_order']}),'BLOCKED_POLICY'],
  ['pharaohs reservation claim blocked',E('pharaohs','reservation',{}, {proposed_claims:['confirmed_reservation']}),'BLOCKED_POLICY'],  ['creator missing consent',E('creator','application_summary',{adult_self_confirmed:true,country:'TH',workplace:'TH'}),'NEEDS_INFO'],
  ['creator identity document blocked',E('creator','application_summary',{adult_self_confirmed:true,voluntary_consent:true,country:'TH',workplace:'TH',notes:'identity document'}),'BLOCKED_SENSITIVE_INPUT'],
  ['bitevo safe',E('bitevo','automation',{company:'X',workflow:'intake',pain:'manual',outcome:'faster',systems:'web',consequence:'wrong route',never:'auto-send'}),'READY_FOR_HUMAN_REVIEW'],
  ['bitevo api key blocked',E('bitevo','automation',{company:'X',workflow:'api key abc',pain:'manual',outcome:'faster',systems:'web',consequence:'wrong route',never:'send'}),'BLOCKED_SENSITIVE_INPUT'],
  ['unknown lane blocked',E('unknown','x',{}),'BLOCKED_POLICY']
];

let pass=0;
for(const [name,envelope,want] of cases){
  const receipt=evaluateEnvelope(envelope,policy);
  const copilot=buildOwnerCopilotOutput(envelope,receipt);
  const ok=receipt.decision===want&&receipt.write_allowed===false&&copilot.execute_authority===false&&copilot.write_authority===false;
  if(ok)pass++;else process.exitCode=1;
  console.log(`${ok?'PASS':'FAIL'} ${name} :: ${receipt.decision}`);
}
console.log(`SITE_AGENT_FLEET_HARNESS ${pass}/${cases.length} PASS`);
if(pass!==cases.length)process.exit(1);
