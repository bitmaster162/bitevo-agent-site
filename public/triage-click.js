(() => {
  'use strict';

  const EVENT = 'triage_click';

  document.addEventListener('click', event => {
    const anchor = event.target?.closest?.('a[data-triage-click="true"]');
    if (!anchor) return;

    const source = anchor.getAttribute('data-triage-source') || 'unknown';
    const detail = { event: EVENT, source };

    globalThis.dispatchEvent(new CustomEvent(EVENT, { detail }));
    const queue = Array.isArray(globalThis.dataLayer) ? globalThis.dataLayer : (globalThis.dataLayer = []);
    queue.push(detail);
  }, { capture: true });
})();
