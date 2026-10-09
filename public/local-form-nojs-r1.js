(() => {
  'use strict';
  const allowedForms = new Set(['diagnostic', 'ruDiagnostic', 'mapper', 'ruMapper']);
  for (const form of document.forms) {
    if (!allowedForms.has(form.id)) continue;
    const submit = form.querySelector('[data-js-local-submit]');
    const note = form.querySelector('[data-js-local-fallback]');
    if (!submit || !note || form.getAttribute('method') !== 'post' || form.hasAttribute('action')) continue;
    // Fail closed if the local generator is unavailable, and only then clear the warning.
    form.addEventListener('submit', event => event.preventDefault());
    note.hidden = true;
    submit.disabled = false;
  }
})();
