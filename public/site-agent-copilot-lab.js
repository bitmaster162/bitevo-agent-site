(()=>{
  const $=id=>document.getElementById(id);let policy=null,last=null;
  const sensitive=(value,terms)=>{const s=JSON.stringify(value).toLowerCase();return terms.filter(t=>s.includes(String(t).toLowerCase()))};
  const requiredFor=(lane,intent)=>lane.required_fields_by_intent?.[intent]||lane.required_fields||[];
  const allowedKeys=new Set(['schema_version','lane','session_id','created_at','intent','fields','source','state','proposed_claims','requested_effects','handoff_role','evidence_refs']);
  const requiredKeys=['schema_version','lane','session_id','created_at','intent','fields','source','state'];
  const allowedStates=new Set(['DRAFT_LOCAL','NEEDS_INFO','BLOCKED_SENSITIVE_INPUT','BLOCKED_POLICY','READY_FOR_HUMAN_REVIEW','READY_FOR_HUMAN_HANDOFF']);
  const plainObject=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const scalar=v=>v===null||['string','number','boolean'].includes(typeof v);
  function schemaErrors(env){const out=[];if(!plainObject(env))return['$:type'];
    for(const k of Object.keys(env))if(!allowedKeys.has(k))out.push(`$.${k}:additionalProperty`);
    for(const k of requiredKeys)if(!Object.hasOwn(env,k))out.push(`$.${k}:required`);
    if(env.schema_version!=='SITE_AGENT_ENVELOPE_V1')out.push('$.schema_version:const');
    if(typeof env.lane!=='string')out.push('$.lane:type');
    if(typeof env.session_id!=='string'||env.session_id.length<8)out.push('$.session_id:minLength');
    if(typeof env.created_at!=='string'||Number.isNaN(Date.parse(env.created_at)))out.push('$.created_at:format:date-time');
    if(typeof env.intent!=='string'||!env.intent)out.push('$.intent:type');
    if(!plainObject(env.fields)||Object.values(env.fields).some(v=>!scalar(v)))out.push('$.fields:type');
    if(!plainObject(env.source))out.push('$.source:type');
    if(!allowedStates.has(env.state))out.push('$.state:enum');
    for(const k of ['proposed_claims','requested_effects','evidence_refs'])if(env[k]!==undefined&&(!Array.isArray(env[k])||env[k].some(v=>typeof v!=='string')))out.push(`$.${k}:type`);
    if(env.handoff_role!==undefined&&env.handoff_role!==null&&typeof env.handoff_role!=='string')out.push('$.handoff_role:type');return out}
  const samples={
    dar:{intent:'business',fields:{company:'Cafe Example',city:'Moscow',product:'tea / cups',qty:'monthly need',timing:'this month'}},
    pharaohs:{intent:'reservation',fields:{date:'2026-09-10',time:'19:30',party:'4',name:'Guest'}},
    yakov:{intent:'trip',fields:{dates:'10-15 Sep',party:'2 adults',interest:'island trip'}},
    ivan:{intent:'muay',fields:{goal:'beginner technique',level:'first time'}},
    stas:{intent:'phuket',fields:{dates:'12 Sep',party:'family of 4',interest:'Phuket day'}},
    haven:{intent:'cook',fields:{period:'12 Sep',party:'4',format:'meal prep',preferences:'Mediterranean'}},
    creator:{intent:'application_summary',fields:{adult_self_confirmed:true,voluntary_consent:true,country:'Thailand',workplace:'Thailand'}},
    bitevo:{intent:'automation',fields:{company:'Example',workflow:'lead intake',pain:'manual triage',outcome:'faster qualification',systems:'website + CRM',consequence:'wrong routing',never:'auto-send or payment'}}
  };  async function loadPolicy(){if(policy)return policy;const r=await fetch('/site-agent-policy-r1.json',{cache:'no-store'});if(!r.ok)throw new Error('Policy pack fetch failed');policy=await r.json();$('status').textContent='Policy loaded: '+policy.schema_version;return policy}
  function envelopeFor(lane){const s=samples[lane]||samples.bitevo;return{schema_version:'SITE_AGENT_ENVELOPE_V1',lane,session_id:'lab-'+Math.random().toString(36).slice(2,10),created_at:new Date().toISOString(),intent:s.intent,fields:s.fields,source:{page_path:location.pathname,utm_source:null,utm_medium:null,utm_campaign:null,ref:null},state:'READY_FOR_HUMAN_REVIEW',proposed_claims:[],requested_effects:[],handoff_role:null,evidence_refs:[]}}
  function evaluate(env){
    const out={schema_version:'OWNER_COPILOT_OUTPUT_V1',evaluated_at:new Date().toISOString(),lane:env?.lane||null,intent:env?.intent||null,decision:'HUMAN_REVIEW_REQUIRED',classification:null,missing_information:[],risk_flags:[],blocked_effects:[],reply_draft:'',suggested_next_action:'Review the brief manually.',execute_authority:false,write_authority:false};
    const errors=schemaErrors(env);if(errors.length){out.decision='BLOCKED_SCHEMA';out.risk_flags.push(...errors.map(x=>'schema:'+x));return out}
    const lane=policy.lanes?.[env.lane];if(!lane){out.decision='BLOCKED_POLICY';out.risk_flags.push('unknown_lane');return out}
    out.classification={release_level:lane.release_level,intent:env.intent,handoff:lane.human_handoff||null};
    if(!lane.allowed_intents?.includes(env.intent)){out.decision='BLOCKED_POLICY';out.risk_flags.push('intent_not_allowed')}
    const fields=env.fields||{};for(const f of requiredFor(lane,env.intent)){const v=fields[f];if(v===undefined||v===null||v===''||v===false)out.missing_information.push(f)}
    const terms=[...(policy.global?.sensitive_terms||[]),...(lane.extra_sensitive_terms||[])];const hits=sensitive(fields,terms);if(hits.length){out.decision='BLOCKED_SENSITIVE_INPUT';out.risk_flags.push('sensitive_input:'+hits.join(','))}
    for(const fx of env.requested_effects||[]){if(fx==='human_handoff'){if(!(lane.human_handoff?.verified&&String(lane.release_level).startsWith('L1')))out.blocked_effects.push(fx)}else out.blocked_effects.push(fx)}
    if(lane.human_handoff?.role_label_required&&(env.requested_effects||[]).includes('human_handoff')&&env.handoff_role!==lane.human_handoff.role_label_required)out.blocked_effects.push('handoff_role_mismatch');
    if(out.blocked_effects.length){out.decision='BLOCKED_POLICY';out.risk_flags.push(...out.blocked_effects.map(x=>'forbidden_effect_requested:'+x))}
    for(const c of env.proposed_claims||[]){if(lane.blocked_claims?.includes(c)){out.risk_flags.push('blocked_claim:'+c);out.decision='BLOCKED_POLICY'}}
    if(out.decision==='HUMAN_REVIEW_REQUIRED'&&out.missing_information.length)out.decision='NEEDS_INFO';
    if(out.decision==='HUMAN_REVIEW_REQUIRED'&&lane.human_handoff?.verified&&String(lane.release_level).startsWith('L1'))out.decision='READY_FOR_HUMAN_HANDOFF';
    const label=env.lane+' / '+env.intent;out.reply_draft=out.decision==='NEEDS_INFO'?`Thanks. Before a human can continue with ${label}, please add: ${out.missing_information.join(', ')}. No booking, order, payment or final commercial term is confirmed by this draft.`:out.decision.startsWith('BLOCKED')?'This request needs manual review because a schema, policy or data-safety boundary was triggered. Please correct the flagged input before continuing.':`Thanks. We have enough information to route this ${label} request for human review. Current price, availability, booking/order status and other consequential terms remain subject to human confirmation.`;
    out.suggested_next_action=out.decision==='NEEDS_INFO'?'Ask only for the listed missing fields.':out.decision.startsWith('BLOCKED')?'Stop automated processing and review the flagged boundary.':'Have the owner/operator review the brief and decide the next action.';
    return out
  }  $('sample').onclick=()=>{$('input').value=JSON.stringify(envelopeFor($('lane').value),null,2);$('output').textContent='Sample loaded. Run review.'};
  $('run').onclick=async()=>{try{await loadPolicy();const env=JSON.parse($('input').value);last=evaluate(env);$('output').textContent=JSON.stringify(last,null,2);$('status').textContent='Review complete: '+last.decision}catch(e){last=null;$('output').textContent=String(e.message||e);$('status').textContent='Review failed'}};
  $('clear').onclick=()=>{$('input').value='';$('output').textContent='No review yet.';$('status').textContent=policy?'Policy loaded: '+policy.schema_version:'Policy not loaded yet.';last=null};
  $('copy').onclick=async()=>{if(!last)return;try{await navigator.clipboard.writeText(JSON.stringify(last,null,2))}catch(_){}};
  $('download').onclick=()=>{if(!last)return;const b=new Blob([JSON.stringify(last,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='owner-copilot-output.json';a.click();URL.revokeObjectURL(u)};
  loadPolicy().catch(e=>$('status').textContent='Policy load failed: '+e.message);
})();
