(() => {
  'use strict';

  const UI_ENABLED = false;
  const TEST_MODE = globalThis.__BITEVO_SCOPE_HANDOFF_R1_TEST_MODE__ === true;
  const ENDPOINT = '/api/scope-handoff';
  const REQUEST_TIMEOUT_MS = 15_000;
  const SCHEMA_VERSION = 'bitevo.scope-handoff.r1';
  const RECEIPT_STATUS = 'RECEIVED_FOR_SCOPE_REVIEW';
  const DELIVERY_STATUS = 'INTAKE_RECORD_ACCEPTED';
  const HUMAN_REVIEW_STATUS = 'NOT_CONFIRMED';

  const baseIds = {
    en: {
      company:'company', business_contact:'contact', role:'role', owner_decision:'ownerDecision', workflow:'workflow',
      critical_action:'criticalAction', target_object:'targetObject', authority_owner:'authorityOwner',
      expensive_error:'expensiveError', environment:'environment'
    },
    ru: {
      company:'company', business_contact:'contact', role:'role', owner_decision:'decision', workflow:'workflow',
      critical_action:'action', target_object:'target', authority_owner:'owner', expensive_error:'error', environment:'environment'
    }
  };

  const primaryIds = {
    en: {
      access_approver:'approver', external_systems:'externalSystems', forbidden_effects:'forbiddenEffects',
      pre_action_evidence:'preActionEvidence', freshness_rule:'freshnessRule', object_binding_evidence:'objectBinding',
      external_confirmation:'externalConfirmation', uncertainty_behavior:'uncertaintyBehavior', allowed_tests:'allowedTests',
      prohibited_audit_actions:'prohibited', data_classification:'classification', minimum_necessary_data:'minimumData',
      secret_handling_boundary:'secretBoundary'
    },
    ru: {
      access_approver:'approver', external_systems:'systems', forbidden_effects:'forbidden', pre_action_evidence:'pre',
      freshness_rule:'fresh', object_binding_evidence:'binding', external_confirmation:'confirm',
      uncertainty_behavior:'uncertain', allowed_tests:'allowed', prohibited_audit_actions:'prohibited',
      data_classification:'classification', minimum_necessary_data:'minimum', secret_handling_boundary:'secretBoundary'
    }
  };

  const STRING_LIMITS = Object.freeze({
    company:200, business_contact:200, role:160, owner_decision:2000, workflow:3000, critical_action:2000,
    target_object:2000, authority_owner:500, expensive_error:2000, environment:500, access_approver:500,
    external_systems:3000, forbidden_effects:3000, pre_action_evidence:4000, freshness_rule:2000,
    object_binding_evidence:2000, external_confirmation:2000, uncertainty_behavior:2000, allowed_tests:4000,
    prohibited_audit_actions:4000, data_classification:500, minimum_necessary_data:3000,
    secret_handling_boundary:3000
  });

  const PRIMARY_REQUIRED = Object.freeze([
    'access_approver','external_systems','forbidden_effects','pre_action_evidence','freshness_rule',
    'object_binding_evidence','external_confirmation','uncertainty_behavior','staging_available',
    'safe_replay_available','allowed_tests','prohibited_audit_actions','data_classification',
    'minimum_necessary_data','secret_handling_boundary'
  ]);

  const BASE_REQUIRED = Object.freeze([
    'company','business_contact','role','owner_decision','workflow','critical_action','target_object',
    'authority_owner','expensive_error','environment'
  ]);

  const COPY = Object.freeze({
    en: {
      title:'Submit scope for human review',
      consent:'I explicitly submit only the structured scope fields shown above for human review. This does not authorize testing, access, deployment, booking, payment or execution.',
      boundary:'Only the bounded structured fields are sent. The generated brief, mapper draft, browser storage, cookies, analytics identifiers and files are not sent.',
      manual:'Online handoff is optional. Copy, download and Contact Robert remain available as the manual fallback.',
      submit:'Submit scope for review', retry:'Retry same request', accepted:'Accepted for scope review',
      local:'Generate the local brief first. Nothing has been transmitted.',
      consentNeeded:'Review the boundary and explicitly consent before submitting. Nothing has been transmitted.',
      ready:'Ready for one explicit scope-review request. Nothing has been transmitted yet.',
      stale:'The form changed after the local brief was generated. Generate the brief again before any handoff.',
      submitting:'Submitting one bounded request. Do not close or repeat the action.',
      acceptedPrefix:'The intake record was accepted for scope review. Human review is not confirmed and testing remains unauthorized.',
      rateLimited:'This attempt was rate-limited and was not accepted. Retry manually with the same request ID after the stated delay.',
      unavailable:'Online intake is unavailable and issued no acceptance receipt. Copy, download or manual contact remain available; a retry uses the same request ID.',
      rejected:'The endpoint rejected this request and issued no acceptance receipt. Correct the form, regenerate the local brief and start a new request.',
      unknown:'Status is unknown. Do not create a new request ID. Retry this exact scope with the same ID or use manual contact and quote the ID.',
      conflict:'Idempotency conflict. Do not retry with changed data or create a replacement ID; use manual contact and quote the ID.',
      changedLocked:'The scope changed while the prior request remains unresolved. Do not mint a new ID; restore and retry the exact scope or use manual contact.',
      invalid:'The structured fields do not satisfy the bounded request contract. Regenerate the local brief after correcting the form.',
      requestId:'Client request ID', retryAfter:'Retry-After', manualLink:'Contact Robert manually'
    },
    ru: {
      title:'Отправить scope на ручной review',
      consent:'Я явно отправляю только структурированные scope-поля выше на ручной review. Это не разрешает testing, access, deployment, booking, payment или execution.',
      boundary:'Передаются только bounded structured fields. Generated brief, mapper draft, browser storage, cookies, analytics identifiers и файлы не передаются.',
      manual:'Online handoff необязателен. Copy, download и Contact Robert остаются ручным fallback.',
      submit:'Отправить scope на review', retry:'Повторить тот же request', accepted:'Принято на scope review',
      local:'Сначала сгенерируйте local brief. Ничего не передано.',
      consentNeeded:'Проверьте boundary и явно подтвердите consent. Ничего не передано.',
      ready:'Готово к одному явному scope-review request. Пока ничего не передано.',
      stale:'Форма изменилась после генерации local brief. Сгенерируйте brief заново до handoff.',
      submitting:'Отправляется один bounded request. Не закрывайте страницу и не повторяйте действие.',
      acceptedPrefix:'Intake record принят на scope review. Human review не подтверждён, testing authorization не предоставлен.',
      rateLimited:'Эта попытка ограничена rate limit и не принята. Повторите вручную с тем же request ID после указанной задержки.',
      unavailable:'Online intake недоступен и не выдал acceptance receipt. Copy, download и ручной contact доступны; retry использует тот же request ID.',
      rejected:'Endpoint отклонил request и не выдал acceptance receipt. Исправьте форму, заново сгенерируйте brief и начните новый request.',
      unknown:'Статус неизвестен. Не создавайте новый request ID. Повторите exact scope с тем же ID или используйте ручной contact с этим ID.',
      conflict:'Idempotency conflict. Не повторяйте изменённые данные и не создавайте replacement ID; используйте ручной contact с этим ID.',
      changedLocked:'Scope изменился, пока предыдущий request не reconciled. Не создавайте новый ID; восстановите exact scope или используйте ручной contact.',
      invalid:'Structured fields не соответствуют bounded request contract. Исправьте форму и сгенерируйте local brief заново.',
      requestId:'Client request ID', retryAfter:'Retry-After', manualLink:'Связаться с Robert вручную'
    }
  });

  const TERMINAL_NO_RETRY = new Set(['accepted','rejected','conflict']);
  const CHANGE_LOCKED = new Set(['submitting','unknown','conflict']);
  const CHANGE_RELEASED = new Set(['accepted','rejected','rate_limited','unavailable']);

  const canonicalize = value => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
    }
    return value;
  };
  const stableStringify = value => JSON.stringify(canonicalize(value));
  const trim = value => String(value ?? '').trim();

  function enumValue(value, partial = false) {
    const v = trim(value).toLowerCase();
    if (partial && (v.startsWith('partial') || v.startsWith('частич'))) return 'partial';
    if (v === 'yes' || v === 'да') return 'yes';
    if (v === 'no' || v === 'нет') return 'no';
    return 'unknown';
  }

  function buildScopeFields({ locale, depth:requestedDepth, values, secretConfirmation = true, consent = true }) {
    const chosenLocale = locale === 'ru' ? 'ru' : 'en';
    const depth = requestedDepth === 'primary' ? 'primary' : 'entry';
    const payload = {
      schema_version:SCHEMA_VERSION,
      submission_intent:'scope_review_only',
      testing_authorization:false,
      locale:chosenLocale,
      intake_depth:depth,
      secret_confirmation:secretConfirmation === true,
      consent_scope_review:consent === true
    };
    for (const key of BASE_REQUIRED) payload[key] = trim(values?.[key]);
    if (depth === 'primary') {
      for (const key of Object.keys(primaryIds[chosenLocale])) payload[key] = trim(values?.[key]);
      payload.staging_available = enumValue(values?.staging_available, true);
      payload.safe_replay_available = enumValue(values?.safe_replay_available);
    }
    return payload;
  }

  function validateScopeFields(payload) {
    const errors = [];
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return ['BODY_NOT_OBJECT'];
    if (payload.schema_version !== SCHEMA_VERSION) errors.push('SCHEMA_VERSION');
    if (payload.submission_intent !== 'scope_review_only') errors.push('SUBMISSION_INTENT');
    if (payload.testing_authorization !== false) errors.push('TESTING_AUTHORIZATION');
    if (!['en','ru'].includes(payload.locale)) errors.push('LOCALE');
    if (!['entry','primary'].includes(payload.intake_depth)) errors.push('INTAKE_DEPTH');
    if (payload.secret_confirmation !== true) errors.push('SECRET_CONFIRMATION');
    if (payload.consent_scope_review !== true) errors.push('CONSENT_SCOPE_REVIEW');
    const required = payload.intake_depth === 'primary' ? [...BASE_REQUIRED, ...PRIMARY_REQUIRED] : BASE_REQUIRED;
    for (const key of required) {
      const value = payload[key];
      if (typeof value !== 'string' || value.length < 1) errors.push(`MISSING:${key}`);
      else if (key in STRING_LIMITS && value.length > STRING_LIMITS[key]) errors.push(`LENGTH:${key}`);
    }
    if (payload.intake_depth === 'entry') {
      for (const key of PRIMARY_REQUIRED) if (key in payload) errors.push(`ENTRY_PRIMARY:${key}`);
    }
    if (payload.intake_depth === 'primary') {
      if (!['yes','no','partial','unknown'].includes(payload.staging_available)) errors.push('STAGING_AVAILABLE');
      if (!['yes','no','unknown'].includes(payload.safe_replay_available)) errors.push('SAFE_REPLAY_AVAILABLE');
    }
    return errors;
  }

  function scopeFingerprint(payload) {
    const { consent_scope_review, secret_confirmation, ...scope } = payload;
    void consent_scope_review;
    void secret_confirmation;
    return stableStringify(scope);
  }

  function createClientId(cryptoApi = globalThis.crypto) {
    if (typeof cryptoApi?.randomUUID === 'function') return `shr1_${cryptoApi.randomUUID().replaceAll('-','')}`;
    if (typeof cryptoApi?.getRandomValues === 'function') {
      const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
      return `shr1_${[...bytes].map(byte => byte.toString(16).padStart(2,'0')).join('')}`;
    }
    throw new Error('SECURE_RANDOM_UNAVAILABLE');
  }

  function validReceipt(statusCode, body, expectedClientId) {
    if (![200,201].includes(statusCode) || !body || typeof body !== 'object') return false;
    const replayMatchesStatus = (statusCode === 201 && body.replayed === false) || (statusCode === 200 && body.replayed === true);
    return body.schema_version === SCHEMA_VERSION && body.status === RECEIPT_STATUS &&
      body.delivery_status === DELIVERY_STATUS && body.human_review_status === HUMAN_REVIEW_STATUS &&
      body.testing_authorization === false && body.client_submission_id === expectedClientId &&
      typeof body.submission_id === 'string' && /^sh_r1_[a-f0-9]{32}$/.test(body.submission_id) &&
      typeof body.accepted_at === 'string' && Number.isFinite(Date.parse(body.accepted_at)) && replayMatchesStatus;
  }

  function headerValue(headers, name) {
    if (typeof headers?.get === 'function') return headers.get(name);
    const wanted = name.toLowerCase();
    const key = Object.keys(headers || {}).find(item => item.toLowerCase() === wanted);
    return key ? headers[key] : null;
  }

  function classifyResponse(response, body, expectedClientId) {
    const status = Number(response?.status || 0);
    if (validReceipt(status, body, expectedClientId)) {
      return { kind:'accepted', receipt:body, retryAfter:null };
    }
    if (status === 429 && body?.error === 'RATE_LIMITED' && body?.testing_authorization === false) {
      const raw = Number(headerValue(response.headers, 'Retry-After'));
      return { kind:'rate_limited', error:'RATE_LIMITED', retryAfter:Number.isSafeInteger(raw) && raw > 0 ? raw : null };
    }
    if (status === 503 && ['SERVICE_DISABLED','RATE_LIMIT_CONFIG_INVALID'].includes(body?.status) &&
        body?.provider_io === 0 && body?.testing_authorization === false) {
      return { kind:'unavailable', error:body.status, retryAfter:null };
    }
    if (status === 409 && body?.error === 'IDEMPOTENCY_CONFLICT') {
      return { kind:'conflict', error:'IDEMPOTENCY_CONFLICT', retryAfter:null };
    }
    if (body?.status === 'UNKNOWN_RECONCILE' || body?.status === 'RATE_LIMIT_UNKNOWN_RECONCILE') {
      return { kind:'unknown', error:body.status, retryAfter:null };
    }
    if (status >= 400 && status < 500) {
      return { kind:'rejected', error:trim(body?.error || `HTTP_${status}`), retryAfter:null };
    }
    return { kind:'unknown', error:trim(body?.status || body?.error || `HTTP_${status || 'UNKNOWN'}`), retryAfter:null };
  }

  function createSubmissionMachine(options = {}) {
    const fetchImpl = options.fetchImpl || ((url, requestOptions) => { void url; return fetch('/api/scope-handoff', requestOptions); });
    const cryptoApi = options.cryptoApi || globalThis.crypto;
    const AbortControllerImpl = options.AbortControllerImpl || globalThis.AbortController;
    const setTimer = options.setTimeoutImpl || globalThis.setTimeout;
    const clearTimer = options.clearTimeoutImpl || globalThis.clearTimeout;
    const timeoutMs = options.timeoutMs || REQUEST_TIMEOUT_MS;
    let cycle = null;
    let inFlightPromise = null;

    const inspect = () => cycle ? {
      state:cycle.state, clientId:cycle.clientId, fingerprint:cycle.fingerprint,
      outcome:cycle.outcome ? structuredClone(cycle.outcome) : null
    } : { state:'empty', clientId:null, fingerprint:null, outcome:null };

    const releaseForNewScope = fields => {
      const fingerprint = scopeFingerprint(fields);
      if (!cycle || cycle.fingerprint === fingerprint) return { ok:true, changed:false };
      if (CHANGE_LOCKED.has(cycle.state)) return { ok:false, reason:'PRIOR_REQUEST_UNRESOLVED', clientId:cycle.clientId };
      if (CHANGE_RELEASED.has(cycle.state)) {
        cycle = null;
        return { ok:true, changed:true };
      }
      return { ok:false, reason:'PRIOR_REQUEST_LOCKED', clientId:cycle.clientId };
    };

    const submit = fields => {
      const errors = validateScopeFields(fields);
      if (errors.length) return Promise.resolve({ kind:'client_invalid', errors, clientId:null });
      const fingerprint = scopeFingerprint(fields);
      if (cycle && cycle.fingerprint !== fingerprint) {
        return Promise.resolve({ kind:'payload_changed_locked', clientId:cycle.clientId, error:'PAYLOAD_CHANGED' });
      }
      if (inFlightPromise) return inFlightPromise;
      if (cycle && TERMINAL_NO_RETRY.has(cycle.state)) return Promise.resolve({ ...cycle.outcome, cached:true });
      if (!cycle) {
        const clientId = createClientId(cryptoApi);
        const payload = { ...fields, client_submission_id:clientId };
        cycle = { state:'ready', clientId, fingerprint, body:stableStringify(payload), outcome:null };
      }
      inFlightPromise = (async () => {
        cycle.state = 'submitting';
        let timer = null;
        let controller = null;
        try {
          if (typeof fetchImpl !== 'function') throw new Error('FETCH_UNAVAILABLE');
          if (typeof AbortControllerImpl === 'function') controller = new AbortControllerImpl();
          if (controller && typeof setTimer === 'function') timer = setTimer(() => controller.abort(), timeoutMs);
          const response = await fetchImpl(ENDPOINT, {
            method:'POST', headers:{ 'Content-Type':'application/json' }, body:cycle.body,
            credentials:'same-origin', cache:'no-store', redirect:'error', referrerPolicy:'same-origin',
            ...(controller ? { signal:controller.signal } : {})
          });
          let body = null;
          try { body = await response.json(); } catch { body = null; }
          const outcome = { ...classifyResponse(response, body, cycle.clientId), clientId:cycle.clientId };
          cycle.state = outcome.kind;
          cycle.outcome = outcome;
          return outcome;
        } catch (error) {
          const outcome = { kind:'unknown', error:error?.name === 'AbortError' ? 'REQUEST_TIMEOUT' : 'NETWORK_UNCERTAIN', clientId:cycle.clientId, retryAfter:null };
          cycle.state = 'unknown';
          cycle.outcome = outcome;
          return outcome;
        } finally {
          if (timer !== null && typeof clearTimer === 'function') clearTimer(timer);
          inFlightPromise = null;
        }
      })();
      return inFlightPromise;
    };

    return Object.freeze({ submit, inspect, releaseForNewScope, fingerprint:scopeFingerprint });
  }

  function renderShell(locale) {
    const text = COPY[locale];
    return `<div class="eyebrow">SCOPE HANDOFF · R1</div>
      <h2>${text.title}</h2>
      <p class="brief-explain" data-scope-boundary>${text.boundary}</p>
      <label class="${locale === 'ru' ? 'check' : 'confirm'} scope-handoff-r1-consent"><input type="checkbox" data-scope-consent><span>${text.consent}</span></label>
      <div class="brief-actions"><button type="button" class="button button-primary" data-scope-submit disabled>${text.submit}</button></div>
      <p class="brief-explain" data-scope-manual>${text.manual} <a data-scope-manual-link href="mailto:robert@bitevo.work?subject=BitEvo%20scope%20review">${text.manualLink}</a></p>
      <output class="scope-handoff-r1-id" data-scope-client-id hidden></output>
      <p class="scope-handoff-r1-status" data-scope-status role="status" aria-live="polite" aria-atomic="true"></p>`;
  }

  function mountScopeHandoff(options = {}) {
    const enabled = options.enabled ?? UI_ENABLED;
    if (!enabled) return Object.freeze({ mounted:false, reason:'UI_DISABLED' });
    const doc = options.document || globalThis.document;
    if (!doc) return Object.freeze({ mounted:false, reason:'DOCUMENT_UNAVAILABLE' });
    const root = doc.querySelector('[data-intake-segmentation]');
    if (!root) return Object.freeze({ mounted:false, reason:'ROOT_MISSING' });
    if (root.querySelector('[data-scope-handoff-r1]')) return Object.freeze({ mounted:false, reason:'ALREADY_MOUNTED' });

    const locale = root.getAttribute('data-intake-locale') === 'ru' ? 'ru' : 'en';
    const text = COPY[locale];
    const form = root.querySelector(locale === 'ru' ? '#ruIntake' : '#audit-intake');
    const brief = root.querySelector('[data-segmented-brief]');
    const host = brief?.closest('.brief-panel, .brief');
    if (!form || !brief || !host) return Object.freeze({ mounted:false, reason:'FORM_OR_BRIEF_MISSING' });

    const shell = doc.createElement('section');
    shell.setAttribute('data-scope-handoff-r1', 'enabled');
    shell.setAttribute('data-scope-state', 'local');
    shell.className = 'panel scope-handoff-r1-shell';
    shell.innerHTML = renderShell(locale);
    const gate = host.querySelector('.gate');
    if (gate && typeof host.insertBefore === 'function') host.insertBefore(shell, gate);
    else host.append(shell);

    const consent = shell.querySelector('[data-scope-consent]');
    const submitButton = shell.querySelector('[data-scope-submit]');
    const status = shell.querySelector('[data-scope-status]');
    const clientOutput = shell.querySelector('[data-scope-client-id]');
    if (!consent || !submitButton || !status || !clientOutput) return Object.freeze({ mounted:false, reason:'SHELL_INCOMPLETE' });

    const machine = createSubmissionMachine({
      fetchImpl:options.fetchImpl,
      cryptoApi:options.cryptoApi,
      AbortControllerImpl:options.AbortControllerImpl,
      setTimeoutImpl:options.setTimeoutImpl,
      clearTimeoutImpl:options.clearTimeoutImpl,
      timeoutMs:options.timeoutMs
    });
    const raf = options.requestAnimationFrameImpl || globalThis.requestAnimationFrame || (fn => setTimeout(fn, 0));
    let generatedFingerprint = null;
    let lockedByChangedScope = false;

    const readValue = id => trim(root.querySelector(`#${id}`)?.value);
    const collectValues = () => {
      const values = {};
      for (const [key,id] of Object.entries(baseIds[locale])) values[key] = readValue(id);
      if (root.dataset.intakeDepth === 'primary') {
        for (const [key,id] of Object.entries(primaryIds[locale])) values[key] = readValue(id);
        values.staging_available = readValue('staging');
        values.safe_replay_available = readValue('replay');
      }
      return values;
    };
    const collectFields = () => buildScopeFields({
      locale,
      depth:root.dataset.intakeDepth === 'primary' ? 'primary' : 'entry',
      values:collectValues(),
      secretConfirmation:root.querySelector(locale === 'ru' ? '#secretCheck' : '#secretConfirm')?.checked === true,
      consent:consent.checked === true
    });
    const currentFingerprint = () => scopeFingerprint({ ...collectFields(), secret_confirmation:true, consent_scope_review:true });

    const showClientId = clientId => {
      clientOutput.hidden = !clientId;
      clientOutput.textContent = clientId ? `${text.requestId}: ${clientId}` : '';
    };
    const setUiState = (state, message, { canSubmit = false, label = text.submit, clientId = null } = {}) => {
      shell.setAttribute('data-scope-state', state);
      status.textContent = message;
      submitButton.textContent = label;
      submitButton.disabled = !canSubmit;
      submitButton.setAttribute('aria-disabled', canSubmit ? 'false' : 'true');
      showClientId(clientId);
    };

    const refresh = () => {
      const snapshot = machine.inspect();
      const hasBrief = trim(brief.value).length > 0;
      const exactBrief = hasBrief && generatedFingerprint !== null && generatedFingerprint === currentFingerprint();
      const secretBox = root.querySelector(locale === 'ru' ? '#secretCheck' : '#secretConfirm');
      const boundaryReady = consent.checked === true && secretBox?.checked === true;
      if (lockedByChangedScope) return setUiState('changed-locked', text.changedLocked, { clientId:snapshot.clientId });
      if (snapshot.state === 'submitting') return setUiState('submitting', text.submitting, { clientId:snapshot.clientId });
      if (!hasBrief || generatedFingerprint === null) return setUiState('local', text.local, { clientId:snapshot.clientId });
      if (!exactBrief) return setUiState('stale', text.stale, { clientId:snapshot.clientId });
      if (snapshot.state === 'accepted') return setUiState('accepted', `${text.acceptedPrefix} ${text.requestId}: ${snapshot.clientId}.`, { label:text.accepted, clientId:snapshot.clientId });
      if (snapshot.state === 'conflict') return setUiState('conflict', text.conflict, { clientId:snapshot.clientId });
      if (snapshot.state === 'rejected') return setUiState('rejected', text.rejected, { clientId:snapshot.clientId });
      if (snapshot.state === 'unknown') return setUiState('unknown', text.unknown, { canSubmit:boundaryReady, label:text.retry, clientId:snapshot.clientId });
      if (snapshot.state === 'rate_limited') {
        const retry = snapshot.outcome?.retryAfter ? ` ${text.retryAfter}: ${snapshot.outcome.retryAfter}s.` : '';
        return setUiState('rate-limited', `${text.rateLimited}${retry}`, { canSubmit:boundaryReady, label:text.retry, clientId:snapshot.clientId });
      }
      if (snapshot.state === 'unavailable') return setUiState('unavailable', text.unavailable, { canSubmit:boundaryReady, label:text.retry, clientId:snapshot.clientId });
      if (!boundaryReady) return setUiState('consent', text.consentNeeded, { clientId:snapshot.clientId });
      setUiState('ready', text.ready, { canSubmit:true, clientId:snapshot.clientId });
    };

    const armGeneratedBrief = () => {
      if (!trim(brief.value) || (typeof form.checkValidity === 'function' && !form.checkValidity())) return refresh();
      const fields = { ...collectFields(), secret_confirmation:true, consent_scope_review:true };
      const release = machine.releaseForNewScope(fields);
      generatedFingerprint = scopeFingerprint(fields);
      lockedByChangedScope = !release.ok;
      refresh();
    };

    const markPotentiallyStale = () => {
      if (generatedFingerprint !== null && generatedFingerprint !== currentFingerprint()) {
        const snapshot = machine.inspect();
        lockedByChangedScope = CHANGE_LOCKED.has(snapshot.state) || lockedByChangedScope;
      }
      refresh();
    };

    const handleClick = async () => {
      if (submitButton.disabled) return null;
      const fields = collectFields();
      const errors = validateScopeFields(fields);
      if (errors.length || generatedFingerprint !== scopeFingerprint(fields)) {
        setUiState('invalid', errors.length ? text.invalid : text.stale, { clientId:machine.inspect().clientId });
        return { kind:'client_invalid', errors };
      }
      setUiState('submitting', text.submitting, { clientId:machine.inspect().clientId });
      const outcome = await machine.submit(fields);
      lockedByChangedScope = outcome.kind === 'payload_changed_locked';
      refresh();
      return outcome;
    };

    consent.addEventListener('change', refresh);
    form.addEventListener('submit', armGeneratedBrief);
    form.addEventListener('input', markPotentiallyStale);
    form.addEventListener('change', markPotentiallyStale);
    form.addEventListener('reset', () => raf(() => {
      generatedFingerprint = null;
      lockedByChangedScope = CHANGE_LOCKED.has(machine.inspect().state);
      refresh();
    }));
    root.addEventListener('click', event => {
      if (event.target?.closest?.('[data-intake-mode]')) raf(markPotentiallyStale);
    });
    submitButton.addEventListener('click', handleClick);
    refresh();

    return Object.freeze({ mounted:true, locale, shell, machine, refresh, armGeneratedBrief, handleClick, collectFields });
  }

  const TEST_API = Object.freeze({
    UI_ENABLED, ENDPOINT, SCHEMA_VERSION, RECEIPT_STATUS, DELIVERY_STATUS, HUMAN_REVIEW_STATUS,
    BASE_IDS:baseIds, PRIMARY_IDS:primaryIds, BASE_REQUIRED, PRIMARY_REQUIRED, COPY,
    stableStringify, enumValue, buildScopeFields, validateScopeFields, scopeFingerprint,
    createClientId, validReceipt, classifyResponse, createSubmissionMachine, renderShell, mountScopeHandoff
  });

  if (TEST_MODE) {
    Object.defineProperty(globalThis, '__BITEVO_SCOPE_HANDOFF_R1_TEST_API__', {
      configurable:true, enumerable:false, writable:false, value:TEST_API
    });
  }
  if (UI_ENABLED && typeof document !== 'undefined') mountScopeHandoff();
})();
