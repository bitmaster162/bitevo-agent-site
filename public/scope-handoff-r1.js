(() => {
  const UI_ENABLED = false;
  const root = document.querySelector('[data-intake-segmentation]');
  if (!root || !UI_ENABLED) return;

  const form = root.querySelector('#audit-intake');
  const brief = root.querySelector('[data-segmented-brief]');
  if (!form || !brief) return;
  const locale = root.getAttribute('data-intake-locale') === 'ru' ? 'ru' : 'en';
  const text = locale === 'ru' ? {
    title:'Отправить scope на ручной review', consent:'Я явно отправляю только перечисленные scope-поля для ручного review. Это не разрешение на тестирование.', submit:'Отправить scope на review', disabled:'Runtime handoff пока выключен.', unknown:'Статус неизвестен — не создавайте новый ID; повторите с тем же ID или используйте ручной контакт.'
  } : {
    title:'Submit scope for human review', consent:'I explicitly submit only the listed scope fields for human review. This does not authorize testing.', submit:'Submit scope for review', disabled:'Runtime handoff is currently disabled.', unknown:'Status is unknown — do not mint a new ID; retry with the same ID or use manual contact.'
  };

  const shell = document.createElement('section');
  shell.dataset.scopeHandoffR1 = 'enabled';
  shell.className = 'panel scope-handoff-r1-shell';
  shell.innerHTML = `<div class="eyebrow">SCOPE HANDOFF · R1</div><h2>${text.title}</h2><p data-scope-boundary></p><label class="confirm"><input type="checkbox" data-scope-consent><span>${text.consent}</span></label><div class="brief-actions"><button type="button" class="button button-primary" data-scope-submit disabled>${text.submit}</button></div><p data-scope-status aria-live="polite"></p>`;
  brief.closest('.brief-panel')?.append(shell);

  const consent = shell.querySelector('[data-scope-consent]');
  const submit = shell.querySelector('[data-scope-submit]');
  const status = shell.querySelector('[data-scope-status]');
  const boundary = shell.querySelector('[data-scope-boundary]');
  const ids = {
    company:'company', business_contact:'contact', role:'role', owner_decision:'ownerDecision', workflow:'workflow', critical_action:'criticalAction', target_object:'targetObject', authority_owner:'authorityOwner', expensive_error:'expensiveError', environment:'environment', access_approver:'approver', external_systems:'externalSystems', forbidden_effects:'forbiddenEffects', pre_action_evidence:'preActionEvidence', freshness_rule:'freshnessRule', object_binding_evidence:'objectBinding', external_confirmation:'externalConfirmation', uncertainty_behavior:'uncertaintyBehavior', allowed_tests:'allowedTests', prohibited_audit_actions:'prohibited', data_classification:'classification', minimum_necessary_data:'minimumData', secret_handling_boundary:'secretBoundary'
  };
  boundary.textContent = locale === 'ru' ? 'Передаются только bounded поля этой формы; generated brief, cookies, analytics IDs и browser storage не передаются.' : 'Only bounded fields from this form are sent; the generated brief, cookies, analytics IDs and browser storage are not sent.';
  const val = id => String(root.querySelector(`#${id}`)?.value || '').trim();
  const enumValue = (id, partial=false) => { const v=val(id).toLowerCase(); if (partial && v.startsWith('partial')) return 'partial'; if (v === 'yes') return 'yes'; if (v === 'no') return 'no'; return 'unknown'; };
  let clientId = null;
  let inFlight = false;
  const makePayload = () => {
    const depth = root.dataset.intakeDepth === 'primary' ? 'primary' : 'entry';
    if (!clientId) clientId = crypto.randomUUID().replaceAll('-','_');
    const payload = { schema_version:'bitevo.scope-handoff.r1', client_submission_id:clientId, submission_intent:'scope_review_only', testing_authorization:false, locale, intake_depth:depth, secret_confirmation:root.querySelector('#secretConfirm')?.checked === true, consent_scope_review:consent?.checked === true };
    for (const [key,id] of Object.entries(ids)) { const value=val(id); if (value) payload[key]=value; }
    if (depth === 'primary') { payload.staging_available=enumValue('staging', true); payload.safe_replay_available=enumValue('replay'); }
    return payload;
  };
  const refresh = () => { submit.disabled = !brief.value || !consent.checked || inFlight; };
  consent.addEventListener('change', refresh);
  form.addEventListener('submit', () => requestAnimationFrame(refresh));
  form.addEventListener('reset', () => { clientId=null; status.textContent=''; requestAnimationFrame(refresh); });
  submit.addEventListener('click', async () => {
    if (inFlight || !brief.value || !consent.checked) return;
    inFlight=true; refresh(); status.textContent='';
    try {
      const res = await fetch('/api/scope-handoff', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(makePayload()), credentials:'same-origin' });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.status === 'RECEIVED_FOR_SCOPE_REVIEW') status.textContent = `${body.status} · ${body.submission_id}`;
      else if (res.status === 503 && body.status === 'SERVICE_DISABLED') status.textContent = text.disabled;
      else if (body.status === 'UNKNOWN_RECONCILE') status.textContent = text.unknown;
      else status.textContent = `${body.error || 'HANDOFF_FAILED'} · HTTP ${res.status}`;
    } catch { status.textContent=text.unknown; }
    finally { inFlight=false; refresh(); }
  });
})();
