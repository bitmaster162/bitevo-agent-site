(() => {
  'use strict';

  const MAX_SCOPE_REQUEST = 600;
  const TEST_MODE = globalThis.__BITEVO_P27_8_TEST__ === true;
  const ORDER = ['action', 'object', 'owner', 'evidence', 'freshness', 'confirm', 'recovery'];

  const COPY = Object.freeze({
    en: Object.freeze({
      frame: 'When the workflow performs [action] on [object] under authority owned by [role], it must be blocked or constrained in the cases below, and leave the evidence listed.',
      footer: 'Draft for scoping only. Not a finding, not a safety verdict, not testing authorization. Written Rules of Engagement are required before test execution.',
      copied: 'Hypothesis copied locally. No request was sent.',
      prefilled: 'Hypothesis excerpt was placed in the existing Scope Handoff request. Review it and explicitly consent before submitting.',
      triagePrefilled: 'Triage request was placed in the existing Scope Handoff form. No booking was created. Review it and explicitly consent before submitting.',
      intakeUnavailable: 'Scope Handoff is not active in this environment. Copy the hypothesis instead.',
      openGates: 'Open gates'
    }),
    ru: Object.freeze({
      frame: 'Когда workflow выполняет [действие] над [объектом] по полномочию, которым владеет [роль], в случаях ниже оно должно блокироваться или ограничиваться и оставлять указанный след.',
      footer: 'Черновик только для подготовки объёма работ. Не находка, не вердикт о безопасности и не разрешение на тестирование. До тестов нужны письменные Rules of Engagement.',
      copied: 'Гипотеза скопирована локально. Ничего не отправлено.',
      prefilled: 'Фрагмент гипотезы помещён в существующий Scope Handoff. Проверьте его и отдельно подтвердите consent перед отправкой.',
      triagePrefilled: 'Запрос на triage помещён в существующий Scope Handoff. Запись не создана. Проверьте текст и отдельно подтвердите consent перед отправкой.',
      intakeUnavailable: 'Scope Handoff не активен в этой среде. Вместо отправки скопируйте гипотезу.',
      openGates: 'Открытые ворота'
    })
  });

  const GATES = Object.freeze({
    action: Object.freeze({
      en: Object.freeze({ gate: 'Authority Budget', blocked: 'Any external action other than [action].', evidence: 'Record of the attempted action and the rule that allowed or refused it.' }),
      ru: Object.freeze({ gate: 'Authority Budget', blocked: 'Любое внешнее действие, кроме [действие].', evidence: 'Запись о попытке действия и о правиле, которое его разрешило или отклонило.' })
    }),
    object: Object.freeze({
      en: Object.freeze({ gate: 'Object binding', blocked: '[action] on any object other than [object ID] — correct permission on the wrong record is still the wrong effect.', evidence: 'Object identifier checked before execution, and the identifier actually changed.' }),
      ru: Object.freeze({ gate: 'Привязка к объекту', blocked: '[действие] над любым объектом, кроме [ID объекта]: верное разрешение на чужой записи — всё равно неверный эффект.', evidence: 'ID объекта, проверенный до выполнения, и ID, который реально изменился.' })
    }),
    owner: Object.freeze({
      en: Object.freeze({ gate: 'Authority owner', blocked: 'Execution when [role] has not granted this permission.', evidence: 'Grant or approval record that links [role] to [action].' }),
      ru: Object.freeze({ gate: 'Владелец полномочия', blocked: 'Выполнение, если [роль] не выдала это разрешение.', evidence: 'Запись о выдаче или одобрении, связывающая [роль] и [действие].' })
    }),
    evidence: Object.freeze({
      en: Object.freeze({ gate: 'Evidence Before Effect', blocked: 'Execution when [minimum pre-action evidence] is missing — fail closed.', evidence: 'The pre-action evidence set, captured before the effect.' }),
      ru: Object.freeze({ gate: 'Evidence Before Effect', blocked: 'Выполнение без [минимальный набор доказательств до действия] — отказ по умолчанию.', evidence: 'Набор доказательств, снятый до эффекта.' })
    }),
    freshness: Object.freeze({
      en: Object.freeze({ gate: 'Freshness', blocked: 'Execution on evidence older than [freshness limit] or marked invalid.', evidence: 'Timestamp or version of each evidence item at decision time.' }),
      ru: Object.freeze({ gate: 'Свежесть', blocked: 'Выполнение на доказательствах старше [срок] или помеченных недействительными.', evidence: 'Время или версия каждого доказательства на момент решения.' })
    }),
    confirm: Object.freeze({
      en: Object.freeze({ gate: 'External confirmation', blocked: 'Reporting [action] as done before [external system] confirms it.', evidence: 'External confirmation, separate from the tool acknowledgement.' }),
      ru: Object.freeze({ gate: 'Внешнее подтверждение', blocked: 'Отметка «сделано» до того, как [внешняя система] подтвердит [действие].', evidence: 'Внешнее подтверждение, отдельное от ответа инструмента.' })
    }),
    recovery: Object.freeze({
      en: Object.freeze({ gate: 'Recovery', blocked: 'Retrying or continuing when evidence or confirmation is uncertain — the workflow enters [constrained / recovery state] instead.', evidence: 'The state change, and who released the workflow from it.' }),
      ru: Object.freeze({ gate: 'Восстановление', blocked: 'Повтор или продолжение при неясных доказательствах или подтверждении — вместо этого переход в [ограниченный режим / режим восстановления].', evidence: 'Смена состояния и кто вывел workflow из него.' })
    })
  });

  const localeOf = value => value === 'ru' ? 'ru' : 'en';
  const answerOf = value => value === 'NO' || value === 'UNKNOWN' || value === 'YES' ? value : null;

  function buildHypothesis(localeValue, answersValue, nowValue = new Date().toISOString()) {
    const locale = localeOf(localeValue);
    const answers = answersValue || {};
    const rows = ORDER.map(id => {
      const answer = answerOf(answers[id]);
      if (answer !== 'NO' && answer !== 'UNKNOWN') return null;
      const copy = GATES[id][locale];
      return Object.freeze({ id:id, answer:answer, gate:copy.gate, blocked:copy.blocked, evidence:copy.evidence });
    }).filter(Boolean);

    if (!rows.length) return Object.freeze({ visible:false, locale:locale, rows:Object.freeze([]), clipboard:'' });

    const text = COPY[locale];
    const clipboard = [
      '=== BITEVO · ENTRY AUDIT HYPOTHESIS (DRAFT) ===',
      'Generated: ' + nowValue,
      text.frame,
      ...rows.map(row => '- ' + row.gate + ' [' + row.answer + ']: ' + row.blocked + ' ' + (locale === 'ru' ? 'Доказательства' : 'Evidence') + ': ' + row.evidence),
      text.footer
    ].join('\n');

    return Object.freeze({ visible:true, locale:locale, rows:Object.freeze(rows), clipboard:clipboard });
  }

  function collectAnswers(form) {
    const answers = {};
    for (const id of ORDER) {
      const picked = form && form.querySelector ? form.querySelector('input[name="' + id + '"]:checked') : null;
      answers[id] = picked ? picked.value : null;
    }
    return answers;
  }

  function compactOpenGates(state) {
    return state.rows.map(row => row.gate + ' [' + row.answer + ']').join('; ');
  }

  function clampScopeRequest(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= MAX_SCOPE_REQUEST) return text;
    const suffix = ' … [local draft truncated to P27.1 short-intake limit]';
    return text.slice(0, Math.max(0, MAX_SCOPE_REQUEST - suffix.length)) + suffix;
  }

  function buildScopePrefill(state, draftValue) {
    const text = COPY[state.locale];
    const intro = state.locale === 'ru'
      ? 'Гипотеза Entry Audit. ' + text.openGates + ': ' + compactOpenGates(state) + '. Фрагмент локального черновика: '
      : 'Entry Audit hypothesis. ' + text.openGates + ': ' + compactOpenGates(state) + '. Local draft excerpt: ';
    return clampScopeRequest(intro + (draftValue || state.clipboard));
  }

  function buildTriagePrefill(state) {
    const text = COPY[state.locale];
    return clampScopeRequest(state.locale === 'ru'
      ? 'Запрос на triage через Scope Handoff fallback; запись не создана. ' + text.openGates + ': ' + compactOpenGates(state) + '. Нужен ручной review следующего шага по этим воротам.'
      : 'Triage request via Scope Handoff fallback; no booking has been created. ' + text.openGates + ': ' + compactOpenGates(state) + '. Human review is requested for the next scoping step.');
  }

  function findScopeRequest(doc) {
    return doc && doc.querySelector ? doc.querySelector('[data-scope-handoff-short][data-scope-offer="diagnostic"] [data-scope-short-field="scope_request"]') : null;
  }

  function prefillScopeRequest(doc, value) {
    const field = findScopeRequest(doc);
    if (!field) return false;
    field.value = clampScopeRequest(value);
    field.dispatchEvent(new Event('input', { bubbles:true }));
    const section = field.closest('[data-scope-short-section]') || field.closest('[data-scope-handoff-short]');
    if (section && section.scrollIntoView) section.scrollIntoView({ behavior:'smooth', block:'start' });
    if (field.focus) field.focus({ preventScroll:true });
    return true;
  }

  function renderRows(root, state) {
    const rowsHost = root.querySelector('[data-hypothesis-rows]');
    if (!rowsHost) return;
    rowsHost.textContent = '';
    for (const row of state.rows) {
      const article = document.createElement('article');
      article.setAttribute('data-hypothesis-row', row.id);

      const gate = document.createElement('div');
      gate.className = 'hypothesis-gate';
      const tag = document.createElement('span');
      tag.textContent = '[' + row.answer + ']';
      const strong = document.createElement('strong');
      strong.textContent = row.gate;
      gate.append(tag, strong);

      const blocked = document.createElement('p');
      blocked.className = 'hypothesis-blocked';
      blocked.textContent = row.blocked;

      const evidence = document.createElement('p');
      evidence.className = 'hypothesis-evidence';
      evidence.textContent = row.evidence;

      article.append(gate, blocked, evidence);
      rowsHost.appendChild(article);
    }
  }

  function updateBuilder(root, state) {
    if (!state.visible) {
      root.hidden = true;
      root.removeAttribute('data-hypothesis-ready');
      return;
    }
    renderRows(root, state);
    const draft = root.querySelector('[data-hypothesis-draft]');
    if (draft) draft.value = state.clipboard;
    root.hidden = false;
    root.setAttribute('data-hypothesis-ready', 'true');
  }

  function mountBuilder(root) {
    const locale = localeOf(root.getAttribute('data-hypothesis-locale'));
    const form = document.getElementById(locale === 'ru' ? 'ruDiagnostic' : 'diagnostic');
    const draft = root.querySelector('[data-hypothesis-draft]');
    const copyButton = root.querySelector('[data-hypothesis-copy]');
    const sendButton = root.querySelector('[data-hypothesis-send]');
    const triageButton = root.querySelector('[data-hypothesis-triage]');
    const status = root.querySelector('[data-hypothesis-status]');
    if (!form || !draft || !copyButton || !sendButton || !triageButton || !status) return;

    let current = Object.freeze({ visible:false, locale:locale, rows:Object.freeze([]), clipboard:'' });

    form.addEventListener('submit', () => {
      const answers = collectAnswers(form);
      if (ORDER.some(id => !answerOf(answers[id]))) return;
      current = buildHypothesis(locale, answers);
      updateBuilder(root, current);
    });

    form.addEventListener('reset', () => {
      current = Object.freeze({ visible:false, locale:locale, rows:Object.freeze([]), clipboard:'' });
      root.hidden = true;
      root.removeAttribute('data-hypothesis-ready');
      status.textContent = '';
      draft.value = '';
    });

    copyButton.addEventListener('click', async () => {
      if (!current.visible) return;
      await navigator.clipboard.writeText(draft.value || current.clipboard);
      status.textContent = COPY[locale].copied;
    });

    sendButton.addEventListener('click', () => {
      if (!current.visible) return;
      const ok = prefillScopeRequest(document, buildScopePrefill(current, draft.value));
      status.textContent = ok ? COPY[locale].prefilled : COPY[locale].intakeUnavailable;
    });

    triageButton.addEventListener('click', () => {
      if (!current.visible) return;
      const ok = prefillScopeRequest(document, buildTriagePrefill(current));
      status.textContent = ok ? COPY[locale].triagePrefilled : COPY[locale].intakeUnavailable;
    });
  }

  const TEST_API = Object.freeze({
    ORDER:ORDER, GATES:GATES, COPY:COPY, MAX_SCOPE_REQUEST:MAX_SCOPE_REQUEST,
    buildHypothesis:buildHypothesis, compactOpenGates:compactOpenGates, clampScopeRequest:clampScopeRequest,
    buildScopePrefill:buildScopePrefill, buildTriagePrefill:buildTriagePrefill
  });

  if (TEST_MODE) {
    Object.defineProperty(globalThis, '__BITEVO_HYPOTHESIS_P27_8_TEST_API__', {
      configurable:true, enumerable:false, writable:false, value:TEST_API
    });
  }

  if (!TEST_MODE && typeof document !== 'undefined') {
    for (const root of document.querySelectorAll('[data-hypothesis-builder]')) mountBuilder(root);
  }
})();
