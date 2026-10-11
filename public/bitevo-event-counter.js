(() => {
  'use strict';

  // Fail closed until an independently approved page-level activation.
  // Do not infer activation from URL, cookies, storage or query parameters.
  const bootstrap = document.currentScript;
  if (bootstrap?.getAttribute('data-bitevo-events') !== 'enabled') return;

  const endpoint = '/api/event';
  const validEvents = new Set(['triage_click', 'mailto_click', 'scope_generated', 'pilot_click']);

  function pagePath() {
    const path = globalThis.location?.pathname || '/';
    return path.replace(/\/+$/, '') || '/';
  }

  function locale() {
    const lang = (document.documentElement?.lang || '').toLowerCase();
    return lang === 'ru' || lang.startsWith('ru-') ? 'ru' : 'en';
  }

  function send(event) {
    if (!validEvents.has(event)) return;
    const page = pagePath();
    if (page.length > 180 || !/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/.test(page)) return;
    const body = JSON.stringify({ event, page, locale: locale() });
    try {
      void globalThis.fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        keepalive: true,
        body
      }).catch(() => undefined);
    } catch {
      // Analytics must never interrupt navigation or local scope generation.
    }
  }

  // The existing, network-free Cal.com tracker owns the actual triage click.
  globalThis.addEventListener('triage_click', () => send('triage_click'));

  document.addEventListener('click', event => {
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href') || '';
    if (/^mailto:/i.test(href)) send('mailto_click');
    const isPilotMailto = pagePath() === '/phuket-ai-workflow'
      && href === 'mailto:robert@bitevo.work?subject=Phuket%20AI%20Workflow%20Setup';
    const isPilotPageLink = href === '/phuket-ai-workflow';
    if (isPilotMailto || isPilotPageLink) send('pilot_click');
  }, { capture: true });

  // Observe *completed* local generation without reading or transmitting its
  // form fields, generated brief, contact details, or browser storage.
  document.addEventListener('submit', event => {
    const form = event.target;
    const ids = form?.id === 'audit-intake'
      ? ['brief', 'briefState']
      : form?.id === 'ruIntake'
        ? ['briefText', 'state']
        : null;
    if (!ids || (typeof form.checkValidity === 'function' && !form.checkValidity())) return;
    const brief = document.getElementById(ids[0]);
    const status = document.getElementById(ids[1]);
    const before = brief?.value || '';
    globalThis.requestAnimationFrame?.(() => {
      if (status?.textContent?.trim() === 'Ready to review'
        && typeof brief?.value === 'string'
        && brief.value.length > 0
        && brief.value !== before) {
        send('scope_generated');
      }
    });
  }, { capture: true });
})();
