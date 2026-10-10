(() => {
  'use strict';

  const MAX_INPUT = 8000;
  const TEST_MODE = globalThis.__BITEVO_PRECHECK_R1_TEST__ === true;
  const SECRET_PATTERNS = [
    /-----BEGIN/i,
    /\bsk-(?:proj-)?[A-Za-z0-9_-]{8,}\b/,
    /\bghp_[A-Za-z0-9]{16,}\b/,
    /\bgithub_pat_[A-Za-z0-9_]{16,}\b/,
    /\bxox[a-z]-[A-Za-z0-9-]{12,}\b/i,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
    /\b[A-Fa-f0-9]{32,}\b/
  ];

  function detectSecret(text) {
    return SECRET_PATTERNS.some(pattern => {
      pattern.lastIndex = 0;
      return pattern.test(String(text || ''));
    });
  }

  function compactText(value, max) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return normalized.length <= max ? normalized : normalized.slice(0, Math.max(0, max - 1)) + '…';
  }

  function buildScopeSummary(result) {
    if (!result || result.status !== 'ok' || !Array.isArray(result.actions) ||
        !Array.isArray(result.hypotheses) || !Array.isArray(result.unknowns) || !result.next_step) return null;
    const summary = {
      status:'ok',
      actions:result.actions.slice(0, 4).map(action => [compactText(action.name, 52), action.effect]),
      gates:result.hypotheses.map(item => item.gate),
      unknown_count:result.unknowns.length,
      next:result.next_step.offer
    };
    let encoded = JSON.stringify(summary);
    while (encoded.length > 600 && summary.actions.length > 1) {
      summary.actions.pop();
      encoded = JSON.stringify(summary);
    }
    return encoded.length <= 600 ? encoded : null;
  }

  function textNode(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    return node;
  }

  function renderActions(host, actions) {
    host.textContent = '';
    for (const action of actions) {
      const card = document.createElement('article');
      card.className = 'precheck-card';
      const head = document.createElement('div');
      head.className = 'precheck-card-head';
      head.append(
        textNode('strong', '', action.name),
        textNode('span', 'precheck-effect', action.effect)
      );
      const grid = document.createElement('dl');
      grid.className = 'precheck-dl';
      for (const [label, value] of [
        ['Object', action.object],
        ['Owner', action.owner],
        ['Evidence before', action.evidence_before],
        ['Evidence after', action.evidence_after]
      ]) {
        grid.append(textNode('dt', '', label), textNode('dd', '', value));
      }
      card.append(head, grid);
      host.appendChild(card);
    }
  }

  function renderHypotheses(host, rows) {
    host.textContent = '';
    rows.forEach((row, index) => {
      const card = document.createElement('article');
      card.className = 'precheck-card';
      card.append(
        textNode('span', 'precheck-index', String(index + 1).padStart(2, '0')),
        textNode('strong', '', row.gate),
        textNode('p', '', row.text)
      );
      host.appendChild(card);
    });
  }

  function renderUnknowns(host, rows) {
    host.textContent = '';
    if (!rows.length) {
      host.appendChild(textNode('li', '', 'No explicit unknowns returned.'));
      return;
    }
    for (const row of rows) host.appendChild(textNode('li', '', row));
  }

  function mount(root) {
    const form = root.querySelector('[data-precheck-form]');
    const input = root.querySelector('[data-precheck-input]');
    const count = root.querySelector('[data-precheck-count]');
    const status = root.querySelector('[data-precheck-status]');
    const resultRoot = root.querySelector('[data-precheck-result]');
    const actionsHost = root.querySelector('[data-precheck-actions]');
    const hypothesesHost = root.querySelector('[data-precheck-hypotheses]');
    const unknownsHost = root.querySelector('[data-precheck-unknowns]');
    const nextName = root.querySelector('[data-precheck-next-name]');
    const nextWhy = root.querySelector('[data-precheck-next-why]');
    const copy = root.querySelector('[data-precheck-copy]');
    const send = root.querySelector('[data-precheck-send]');
    const run = root.querySelector('[data-precheck-run]');
    const noJsFallback = form?.querySelector('[data-js-local-fallback]');
    if (!form || !input || !count || !status || !resultRoot || !actionsHost || !hypothesesHost ||
        !unknownsHost || !nextName || !nextWhy || !copy || !send || !run || !noJsFallback ||
        form.getAttribute('method') !== 'post' || form.hasAttribute('action') ||
        !run.hasAttribute('data-js-local-submit')) return;

    let currentResult = null;
    let busy = false;

    const setStatus = text => { status.textContent = text; };
    const updateCount = () => { count.textContent = `${input.value.length.toLocaleString('en-US')} / ${MAX_INPUT.toLocaleString('en-US')}`; };
    input.addEventListener('input', updateCount);
    updateCount();

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy) return;
      const text = input.value.trim();
      currentResult = null;
      resultRoot.hidden = true;
      if (!text) return setStatus('Paste a tool list, manifest or agent description first.');
      if (text.length > MAX_INPUT) return setStatus('Input is over the 8,000-character limit.');
      if (detectSecret(text)) return setStatus('Potential credential detected. Nothing was sent.');

      busy = true;
      run.disabled = true;
      run.setAttribute('aria-busy', 'true');
      setStatus('Mapping authority…');
      try {
        const response = await fetch('/api/pre-check', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body:JSON.stringify({ text, locale:'en' })
        });
        let body = null;
        try { body = await response.json(); } catch {}
        if (response.status === 429) {
          const retry = Number(body?.retry_after_seconds);
          return setStatus(`Rate limit reached. Retry after ${Number.isFinite(retry) ? retry : 1} seconds.`);
        }
        if (!response.ok) {
          if (response.status === 503) return setStatus('Pre-Check runtime is not active in this environment. No model request was made.');
          return setStatus('Pre-Check could not produce a result. Nothing was submitted.');
        }
        if (body?.status === 'secret_detected') return setStatus('Potential credential detected. No model request was made.');
        if (body?.status === 'out_of_scope') return setStatus('This input does not describe an agent or its tools closely enough for this Pre-Check.');
        if (body?.status !== 'ok') return setStatus('Pre-Check returned an unsupported response.');

        currentResult = body;
        renderActions(actionsHost, body.actions || []);
        renderHypotheses(hypothesesHost, body.hypotheses || []);
        renderUnknowns(unknownsHost, body.unknowns || []);
        nextName.textContent = body.next_step?.offer || 'Not enough information';
        nextWhy.textContent = body.next_step?.reason || '';
        resultRoot.hidden = false;
        setStatus('Automated draft ready. It is not an audit finding or safety verdict.');
        resultRoot.scrollIntoView({ behavior:'smooth', block:'start' });
      } catch {
        setStatus('Pre-Check is unavailable. Nothing was submitted.');
      } finally {
        busy = false;
        run.disabled = false;
        run.removeAttribute('aria-busy');
      }
    });

    copy.addEventListener('click', async () => {
      if (!currentResult) return;
      await navigator.clipboard.writeText(JSON.stringify(currentResult, null, 2));
      setStatus('Result copied locally.');
    });

    send.addEventListener('click', () => {
      if (!currentResult) return;
      const summary = buildScopeSummary(currentResult);
      if (!summary) return setStatus('This result cannot be placed in the bounded scope form. Copy it instead.');
      const field = document.querySelector('[data-scope-handoff-short][data-scope-offer="scope_review"] [data-scope-short-field="scope_request"]');
      if (!field) return setStatus('Scope Handoff is not active in this environment. Copy the result instead.');
      field.value = summary;
      field.dispatchEvent(new Event('input', { bubbles:true }));
      const section = field.closest('[data-scope-short-section]');
      if (section) {
        section.hidden = false;
        section.scrollIntoView({ behavior:'smooth', block:'start' });
      }
      if (field.focus) field.focus({ preventScroll:true });
      setStatus('A compact JSON summary of this result was placed in Scope Handoff. The original text was not copied. Review it and explicitly consent before submitting.');
    });

    noJsFallback.hidden = true;
    run.disabled = false;
  }

  const TEST_API = Object.freeze({ detectSecret, buildScopeSummary, MAX_INPUT });
  if (TEST_MODE) {
    Object.defineProperty(globalThis, '__BITEVO_PRECHECK_R1_TEST_API__', {
      configurable:true,
      enumerable:false,
      writable:false,
      value:TEST_API
    });
  }

  if (!TEST_MODE && typeof document !== 'undefined') {
    for (const root of document.querySelectorAll('[data-precheck-root]')) mount(root);
  }
})();
