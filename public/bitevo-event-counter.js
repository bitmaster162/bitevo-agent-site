(() => {
  'use strict';

  // A reviewed coverage row never grants activation authority.
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

  if (bootstrap.getAttribute('data-bitevo-event-schema') !== 'bitevo.event-coverage/v1') return;
  let coverage;
  try { coverage = JSON.parse(bootstrap.getAttribute('data-bitevo-event-coverage') || 'null'); }
  catch { return; }
  if (!coverage || Array.isArray(coverage) || typeof coverage !== 'object'
    || Object.keys(coverage).sort().join(',') !== 'events,locale,path'
    || coverage.path !== pagePath() || coverage.locale !== locale()
    || !Array.isArray(coverage.events) || coverage.events.length === 0
    || coverage.events.length > validEvents.size
    || coverage.events.some(event => !validEvents.has(event))
    || new Set(coverage.events).size !== coverage.events.length) return;
  const pageEvents = new Set(coverage.events);

  function send(event) {
    if (!validEvents.has(event) || !pageEvents.has(event)) return;
    const page = pagePath();
    if (page !== coverage.path || locale() !== coverage.locale
      || page.length > 180 || !/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/.test(page)) return;
    const body = JSON.stringify({ event, page, locale: locale() });
    try {
      void globalThis.fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'omit', cache: 'no-store', keepalive: true, body
      }).catch(() => undefined);
    } catch {
      // Best effort counting must not interrupt navigation or local generation.
    }
  }

  // Keep the existing network-free triage tracker as the click owner.
  globalThis.addEventListener('triage_click', () => send('triage_click'));
  document.addEventListener('click', event => {
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href') || '';
    const businessMailto = /^mailto:robert@bitevo\.work(?:\?|$)/i.test(href);
    if (businessMailto) send('mailto_click');
    const here = pagePath();
    const onPilot = here === '/phuket-ai-workflow' || here === '/ru/phuket-ai-workflow';
    const isPilotMailto = onPilot
      && href === 'mailto:robert@bitevo.work?subject=Phuket%20AI%20Workflow%20Setup';
    let isPilotPageLink = false;
    // Locale switches and self-links on the pilot are not new pilot interest.
    if (!onPilot) {
      try {
        const target = new URL(href, 'https://bitevo.work' + here);
        const path = target.pathname.replace(/\/+$/, '') || '/';
        isPilotPageLink = target.origin === 'https://bitevo.work'
          && !target.username && !target.password && !target.search && !target.hash
          && (path === '/phuket-ai-workflow' || path === '/ru/phuket-ai-workflow');
      } catch { /* Non-URL links do not count as pilot navigation. */ }
    }
    if (isPilotMailto || isPilotPageLink) send('pilot_click');
  }, { capture: true });

  document.addEventListener('submit', event => {
    if (!pageEvents.has('scope_generated')) return;
    const form = event.target;
    const ids = pagePath() === '/audit-intake' && form?.id === 'audit-intake'
      ? ['brief', 'briefState']
      : pagePath() === '/ru/audit-intake' && form?.id === 'ruIntake'
        ? ['briefText', 'state'] : null;
    if (!ids || typeof form.checkValidity !== 'function' || !form.checkValidity()) return;
    const brief = document.getElementById(ids[0]);
    const status = document.getElementById(ids[1]);
    const before = brief?.value || '';
    globalThis.requestAnimationFrame?.(() => {
      if (status?.textContent?.trim() === 'Ready to review'
        && typeof brief?.value === 'string' && brief.value.length > 0 && brief.value !== before) {
        send('scope_generated');
      }
    });
  }, { capture: true });
})();
