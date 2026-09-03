(() => {
  const root = document.querySelector('[data-intake-segmentation]');
  if (!root) return;

  const form = root.querySelector('form');
  const buttons = [...root.querySelectorAll('[data-intake-mode]')];
  const primaryOnly = [...root.querySelectorAll('[data-primary-only]')];
  const primaryRequired = [...root.querySelectorAll('[data-primary-required]')];
  const modeState = root.querySelector('[data-intake-mode-state]');
  const brief = root.querySelector('[data-segmented-brief]');
  const submit = form?.querySelector('button[type="submit"]');
  const locale = root.getAttribute('data-intake-locale') === 'ru' ? 'ru' : 'en';
  let mode = 'entry';

  const copy = {
    en: {
      entry: 'ENTRY · reduced first-step fields · Primary evidence/RoE fields deferred until deeper scope review',
      primary: 'PRIMARY · full Authority Ledger + Evidence Contract + Rules of Engagement depth',
      entryButton: 'Generate Entry scope',
      primaryButton: 'Generate Primary scope'
    },
    ru: {
      entry: 'ENTRY · сокращённый первый шаг · Primary evidence/RoE поля отложены до углублённого scope review',
      primary: 'PRIMARY · полный Authority Ledger + Evidence Contract + Rules of Engagement',
      entryButton: 'Сгенерировать Entry scope',
      primaryButton: 'Сгенерировать Primary scope'
    }
  }[locale];

  const apply = next => {
    mode = next === 'primary' ? 'primary' : 'entry';
    root.dataset.intakeDepth = mode;
    for (const button of buttons) {
      const active = button.dataset.intakeMode === mode;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.classList.toggle('button-primary', active);
      button.classList.toggle('button-ghost', !active);
    }
    for (const block of primaryOnly) block.hidden = mode !== 'primary';
    for (const field of primaryRequired) field.required = mode === 'primary';
    if (modeState) modeState.textContent = copy[mode];
    if (submit) submit.childNodes[0].textContent = mode === 'primary' ? `${copy.primaryButton} ` : `${copy.entryButton} `;
  };

  for (const button of buttons) button.addEventListener('click', () => apply(button.dataset.intakeMode));
  apply('entry');

  form?.addEventListener('submit', () => {
    if (!form.checkValidity() || !brief?.value) return;
    const marker = locale === 'ru'
      ? `INTAKE DEPTH: ${mode.toUpperCase()} — ${mode === 'entry' ? 'Primary-only поля намеренно отложены; brief предназначен только для scope review.' : 'полная глубина scope preparation.'}`
      : `INTAKE DEPTH: ${mode.toUpperCase()} — ${mode === 'entry' ? 'Primary-only fields are intentionally deferred; this brief is for scope review only.' : 'full scope-preparation depth.'}`;
    const lines = brief.value.split('\n');
    const existing = lines.findIndex(line => line.startsWith('INTAKE DEPTH:'));
    if (existing >= 0) lines[existing] = marker;
    else lines.splice(2, 0, marker);
    brief.value = lines.join('\n');
  });

  form?.addEventListener('reset', () => requestAnimationFrame(() => apply(mode)));
})();
