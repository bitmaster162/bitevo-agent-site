import fs from 'node:fs';
const policy = JSON.parse(fs.readFileSync(new URL('../docs/SITE_AGENT_POLICY_PACK_R1.json', import.meta.url), 'utf8'));
const norm = v => String(v ?? '').toLowerCase();
function containsSensitive(lane, payload) {
  const text = norm(JSON.stringify(payload));
  const terms = [...policy.global.sensitive_terms, ...(policy.lanes[lane].extra_sensitive_terms || [])].map(norm);
  return terms.some(t => text.includes(t));
}
function requiredFor(lane, intent) {
  const p = policy.lanes[lane];
  return p.required_fields_by_intent?.[intent] || p.required_fields || [];
}
function evaluate({lane, intent, fields = {}, requested_effect = null, claim = null, evidence_refs = []}) {
  const p = policy.lanes[lane];
  if (!p) return {ok:false, state:'BLOCKED_POLICY', reason:'unknown_lane'};
  if (!p.allowed_intents.includes(intent)) return {ok:false, state:'BLOCKED_POLICY', reason:'intent_not_allowed'};
  if (containsSensitive(lane, fields)) return {ok:false, state:'BLOCKED_SENSITIVE_INPUT', reason:'sensitive_input'};
  const missing = requiredFor(lane, intent).filter(k => !fields[k]);
  if (missing.length) return {ok:false, state:'NEEDS_INFO', reason:'missing_required', missing};
  if (requested_effect && policy.global.forbidden_effects.includes(requested_effect)) return {ok:false, state:'BLOCKED_POLICY', reason:'forbidden_effect'};
  if (claim && p.blocked_claims.includes(claim)) return {ok:false, state:'BLOCKED_POLICY', reason:'blocked_claim'};
  if (claim === 'converted' && policy.global.conversion_requires_evidence && !evidence_refs.length) return {ok:false, state:'BLOCKED_POLICY', reason:'conversion_requires_evidence'};
  return {ok:true, state:p.human_handoff?.verified ? 'READY_FOR_HUMAN_HANDOFF' : 'READY_FOR_HUMAN_REVIEW'};
}
const cases = [
  ['yakov valid',{lane:'yakov',intent:'trip',fields:{dates:'10 Sep',party:'2',interest:'sea'}},true,'READY_FOR_HUMAN_HANDOFF'],
  ['yakov missing dates',{lane:'yakov',intent:'trip',fields:{party:'2',interest:'sea'}},false,'NEEDS_INFO'],
  ['yakov passport block',{lane:'yakov',intent:'trip',fields:{dates:'10 Sep',party:'2',interest:'passport 123'}},false,'BLOCKED_SENSITIVE_INPUT'],
  ['ivan valid',{lane:'ivan',intent:'muay',fields:{goal:'technique'}},true,'READY_FOR_HUMAN_HANDOFF'],
  ['ivan medical claim block',{lane:'ivan',intent:'muay',fields:{goal:'technique'},claim:'medical_advice'},false,'BLOCKED_POLICY'],
  ['stas source handoff',{lane:'stas',intent:'phuket',fields:{dates:'10 Sep',party:'4',interest:'views'}},true,'READY_FOR_HUMAN_HANDOFF'],
  ['haven family valid local',{lane:'haven',intent:'family',fields:{period:'week',area:'Rawai',need:'companionship',schedule:'day'}},true,'READY_FOR_HUMAN_REVIEW'],
  ['haven nursing claim blocked',{lane:'haven',intent:'family',fields:{period:'week',area:'Rawai',need:'companionship',schedule:'day'},claim:'nursing'},false,'BLOCKED_POLICY'],
  ['dar full route valid',{lane:'dar',intent:'production',fields:{company:'X'}},true,'READY_FOR_HUMAN_REVIEW'],
  ['dar stock blocked',{lane:'dar',intent:'business',fields:{company:'X'},claim:'stock'},false,'BLOCKED_POLICY'],
  ['pharaoh reservation human',{lane:'pharaohs',intent:'reservation',fields:{date:'Sep 10'}},true,'READY_FOR_HUMAN_HANDOFF'],
  ['pharaoh confirm blocked',{lane:'pharaohs',intent:'reservation',fields:{date:'Sep 10'},claim:'confirmed_reservation'},false,'BLOCKED_POLICY'],
  ['creator missing adult',{lane:'creator',intent:'application_summary',fields:{voluntary_consent:true,country:'TH',workplace:'TH'}},false,'NEEDS_INFO'],
  ['creator ID block',{lane:'creator',intent:'application_summary',fields:{adult_self_confirmed:true,voluntary_consent:true,country:'TH',workplace:'TH',note:'identity document attached'}},false,'BLOCKED_SENSITIVE_INPUT'],
  ['bitevo valid',{lane:'bitevo',intent:'governance',fields:{company:'A',workflow:'agent',pain:'risk',outcome:'control',systems:'MCP',consequence:'wrong send',never:'payments'}},true,'READY_FOR_HUMAN_REVIEW'],
  ['bitevo secret block',{lane:'bitevo',intent:'build',fields:{company:'A',workflow:'api key abc',pain:'x',outcome:'y',systems:'z',consequence:'q',never:'send'}},false,'BLOCKED_SENSITIVE_INPUT'],
  ['global auto-send block',{lane:'yakov',intent:'trip',fields:{dates:'x',party:'2',interest:'sea'},requested_effect:'auto_send'},false,'BLOCKED_POLICY']
];
let pass=0;
for (const [name,input,wantOk,wantState] of cases) {
  const got=evaluate(input),ok=got.ok===wantOk&&got.state===wantState;
  if(ok)pass++;
  console.log(`${ok?'PASS':'FAIL'} ${name} :: ${got.state}${got.reason?' / '+got.reason:''}`);
}
console.log(`RESULT ${pass}/${cases.length} PASS`);
if(pass!==cases.length)process.exit(1);
