(()=>{
  const $=id=>document.getElementById(id);let policy=null,last=null;
  const sensitive=(value,terms)=>{const s=JSON.stringify(value).toLowerCase();return terms.filter(t=>s.includes(String(t).toLowerCase()))};
  const requiredFor=(lane,intent)=>{if(lane.required_fields_by_intent)return lane.required_fields_by_intent[intent]||[];return lane.required_fields||[]};
  const samples={
    dar:{intent:'business',fields:{company:'Cafe Example',city:'Moscow',product:'tea / cups',qty:'monthly need',timing:'this month'}},
    pharaohs:{intent:'reservation',fields:{date:'2026-09-10',time:'19:30',party:'4',name:'Guest'}},
    yakov:{intent:'trip',fields:{dates:'10-15 Sep',party:'2 adults',interest:'island trip'}},
    ivan:{intent:'muay',fields:{goal:'beginner technique',level:'first time'}},
    stas:{intent:'phuket',fields:{dates:'12 Sep',party:'family of 4',interest:'Phuket day'}},
    haven:{intent:'cook',fields:{period:'12 Sep',party:'4',format:'meal prep',preferences:'Mediterranean'}},
    creator:{intent:'application_summary',fields:{adult_self_confirmed:true,voluntary_consent:true,country:'Thailand',workplace:'Thailand'}},
    bitevo:{intent:'automation',fields:{company:'Example',workflow:'lead intake',pain:'manual triage',outcome:'faster qualification',systems:'website + CRM',consequence:'wrong routing',never:'auto-send or payment'}}
  };
  async function loadPolicy(){if(policy)return policy;const r=await fetch('/site-agent-policy-r1.json',{cache:'no-store'});if(!r.ok)throw new Error('Policy pack fetch failed');policy=await r.json();$('status').textContent='Policy loaded: '+policy.schema_version;return policy}
  function envelopeFor(site){const s=samples[site]||samples.bitevo;return{schema_version:'SITE_AGENT_ENVELOPE_V1',site,session_id:'lab-'+Math.random().toString(36).slice(2,10),created_at:new Date().toISOString(),intent:s.intent,state:'READY_FOR_HUMAN_REVIEW',fields:s.fields,effect_authority:{auto_send:false,auto_reply:false,auto_booking:false,auto_order:false,auto_payment:false,crm_write:false,account_access:false,auto_publish:false}}}
  function evaluate(env){
    const out={schema_version:'OWNER_COPILOT_OUTPUT_V1',evaluated_at:new Date().toISOString(),site:env.site||null,intent:env.intent||null,decision:'HUMAN_REVIEW_REQUIRED',classification:null,missing_information:[],risk_flags:[],blocked_effects:[],reply_draft:'',suggested_next_action:'Review the brief manually.',execute_authority:false,write_authority:false};
    if(!env||env.schema_version!=='SITE_AGENT_ENVELOPE_V1'){out.decision='BLOCKED_SCHEMA';out.risk_flags.push('invalid_or_missing_envelope_schema');return out}
    const lane=policy.lanes?.[env.site];if(!lane){out.decision='BLOCKED_POLICY';out.risk_flags.push('unknown_site_lane');return out}
    out.classification={release_level:lane.release_level,intent:env.intent,handoff:lane.human_handoff||null};
    if(!lane.allowed_intents?.includes(env.intent)){out.decision='BLOCKED_POLICY';out.risk_flags.push('intent_not_allowed')}
    const fields=env.fields||{};for(const f of requiredFor(lane,env.intent)){const v=fields[f];if(v===undefined||v===null||v===''||v===false)out.missing_information.push(f)}
    const terms=[...(policy.global?.sensitive_terms||[]),...(lane.extra_sensitive_terms||[])];const hits=sensitive(fields,terms);if(hits.length){out.decision='BLOCKED_SENSITIVE_INPUT';out.risk_flags.push('sensitive_input:'+hits.join(','))}
    const auth=env.effect_authority||{};for(const fx of policy.global?.forbidden_effects||[]){if(auth[fx]===true){out.blocked_effects.push(fx);out.risk_flags.push('forbidden_effect_requested:'+fx);out.decision='BLOCKED_POLICY'}}
    const claims=Array.isArray(env.claims)?env.claims:[];for(const c of claims){if(lane.blocked_claims?.includes(c)){out.risk_flags.push('blocked_claim:'+c);out.decision='BLOCKED_POLICY'}}
    if(out.decision==='HUMAN_REVIEW_REQUIRED'&&out.missing_information.length)out.decision='NEEDS_INFO';
    const label=env.site+' / '+env.intent;out.reply_draft=out.decision==='NEEDS_INFO'?`Thanks. Before a human can continue with ${label}, please add: ${out.missing_information.join(', ')}. No booking, order, payment or final commercial term is confirmed by this draft.`:out.decision.startsWith('BLOCKED')?'This request needs manual review because a policy or data-safety boundary was triggered. Please remove sensitive data or prohibited assumptions before continuing.':`Thanks. We have enough information to route this ${label} request for human review. Current price, availability, booking/order status and other consequential terms remain subject to human confirmation.`;
    out.suggested_next_action=out.decision==='NEEDS_INFO'?'Ask only for the listed missing fields.':out.decision.startsWith('BLOCKED')?'Stop automated processing and review the flagged boundary.':'Have the owner/operator review the brief and decide the next action.';
    return out
  }
  $('sample').onclick=()=>{$('input').value=JSON.stringify(envelopeFor($('lane').value),null,2);$('output').textContent='Sample loaded. Run review.'};
  $('run').onclick=async()=>{try{await loadPolicy();const env=JSON.parse($('input').value);last=evaluate(env);$('output').textContent=JSON.stringify(last,null,2);$('status').textContent='Review complete: '+last.decision}catch(e){last=null;$('output').textContent=String(e.message||e);$('status').textContent='Review failed'} };
  $('clear').onclick=()=>{$('input').value='';$('output').textContent='No review yet.';$('status').textContent=policy?'Policy loaded: '+policy.schema_version:'Policy not loaded yet.';last=null};
  $('copy').onclick=async()=>{if(!last)return;try{await navigator.clipboard.writeText(JSON.stringify(last,null,2))}catch(_){}};
  $('download').onclick=()=>{if(!last)return;const b=new Blob([JSON.stringify(last,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='owner-copilot-output.json';a.click();URL.revokeObjectURL(u)};
  loadPolicy().catch(e=>$('status').textContent='Policy load failed: '+e.message);
})();
