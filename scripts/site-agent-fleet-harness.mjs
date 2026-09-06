import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const policy=JSON.parse(fs.readFileSync(path.join(root,'public','site-agent-policy-r1.json'),'utf8'));
const forbidden=policy.global.forbidden_effects||[];
const globalSensitive=policy.global.sensitive_terms||[];
const req=(lane,intent)=>lane.required_fields_by_intent?.[intent]||lane.required_fields||[];

function evaluate(e){
  const out={decision:'HUMAN_REVIEW_REQUIRED',priority:3,missing:[],risk_flags:[],blocked_effects:[],execute_authority:false,write_authority:false};
  if(!e||e.schema_version!=='SITE_AGENT_ENVELOPE_V1'){out.decision='BLOCKED_SCHEMA';out.priority=1;return out}
  const lane=policy.lanes[e.site]; if(!lane){out.decision='BLOCKED_POLICY';out.priority=1;out.risk_flags.push('unknown_lane');return out}
  if(!lane.allowed_intents.includes(e.intent)){out.decision='BLOCKED_POLICY';out.priority=1;out.risk_flags.push('intent_not_allowed')}
  const fields=e.fields||{};
  for(const f of req(lane,e.intent)){const v=fields[f];if(v===undefined||v===null||v===''||v===false)out.missing.push(f)}
  const raw=JSON.stringify(fields).toLowerCase();
  for(const t of [...globalSensitive,...(lane.extra_sensitive_terms||[])])if(raw.includes(String(t).toLowerCase())){out.decision='BLOCKED_SENSITIVE_INPUT';out.priority=1;out.risk_flags.push('sensitive:'+t)}
  for(const fx of forbidden)if(e.effect_authority?.[fx]===true){out.decision='BLOCKED_POLICY';out.priority=1;out.blocked_effects.push(fx)}
  for(const c of e.claims||[])if(lane.blocked_claims?.includes(c)){out.decision='BLOCKED_POLICY';out.priority=1;out.risk_flags.push('blocked_claim:'+c)}
  if(out.decision==='HUMAN_REVIEW_REQUIRED'&&out.missing.length){out.decision='NEEDS_INFO';out.priority=2}
  return out;
}

const E=(site,intent,fields={},extra={})=>({schema_version:'SITE_AGENT_ENVELOPE_V1',site,intent,fields,effect_authority:{auto_send:false,auto_reply:false,auto_booking:false,auto_order:false,auto_payment:false,crm_write:false,account_access:false,auto_publish:false},...extra});
const cases=[
  ['yakov safe',E('yakov','trip',{dates:'10 Sep',party:'2 adults',interest:'islands'}),'HUMAN_REVIEW_REQUIRED'],
  ['yakov missing',E('yakov','trip',{dates:'10 Sep'}),'NEEDS_INFO'],
  ['ivan medical record blocked',E('ivan','muay',{goal:'Here is my medical record'}),'BLOCKED_SENSITIVE_INPUT'],
  ['stas safe',E('stas','phuket',{dates:'12 Sep',party:'4',interest:'family day'}),'HUMAN_REVIEW_REQUIRED'],
  ['haven safe cooking',E('haven','cook',{period:'12 Sep',party:'4',format:'meal prep',preferences:'Mediterranean'}),'HUMAN_REVIEW_REQUIRED'],
  ['dar stock claim blocked',E('dar','business',{}, {claims:['stock']}),'BLOCKED_POLICY'],
  ['dar auto order blocked',E('dar','business',{}, {effect_authority:{auto_order:true}}),'BLOCKED_POLICY'],
  ['pharaohs reservation claim blocked',E('pharaohs','reservation',{}, {claims:['confirmed_reservation']}),'BLOCKED_POLICY'],
  ['creator missing consent',E('creator','application_summary',{adult_self_confirmed:true,country:'TH',workplace:'TH'}),'NEEDS_INFO'],
  ['creator identity document blocked',E('creator','application_summary',{adult_self_confirmed:true,voluntary_consent:true,country:'TH',workplace:'TH',notes:'identity document'}),'BLOCKED_SENSITIVE_INPUT'],
  ['bitevo safe',E('bitevo','automation',{company:'X',workflow:'intake',pain:'manual',outcome:'faster',systems:'web',consequence:'wrong route',never:'auto-send'}),'HUMAN_REVIEW_REQUIRED'],
  ['bitevo api key blocked',E('bitevo','automation',{company:'X',workflow:'api key abc',pain:'manual',outcome:'faster',systems:'web',consequence:'wrong route',never:'send'}),'BLOCKED_SENSITIVE_INPUT'],
  ['unknown lane blocked',E('unknown','x',{}),'BLOCKED_POLICY']
];
let pass=0;
for(const [name,e,want] of cases){const got=evaluate(e).decision;if(got!==want){console.error(`FAIL ${name}: expected ${want}, got ${got}`);process.exitCode=1}else{console.log(`PASS ${name} :: ${got}`);pass++}}
console.log(`SITE_AGENT_FLEET_HARNESS ${pass}/${cases.length} PASS`);
if(pass!==cases.length)process.exit(1);
