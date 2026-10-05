(() => {
  const filters = document.querySelector('[data-incident-filters]');
  const library = document.querySelector('[data-incident-library]');
  if (!filters || !library) return;

  const cards = [...library.querySelectorAll('[data-incident-card]')];
  const gateButtons = [...filters.querySelectorAll('[data-gate-filter]')];
  const asiButtons = [...filters.querySelectorAll('[data-asi-filter]')];
  const reset = filters.querySelector('[data-filter-reset]');
  const status = filters.querySelector('[data-filter-status]');
  let gate = '';
  let asi = '';

  const updatePressed = (buttons, value, attribute) => {
    for (const button of buttons) {
      button.setAttribute('aria-pressed', button.getAttribute(attribute) === value ? 'true' : 'false');
    }
  };

  const update = () => {
    let visible = 0;
    for (const card of cards) {
      const gates = (card.getAttribute('data-gates') || '').split('|');
      const risks = (card.getAttribute('data-asi') || '').split('|');
      const show = (!gate || gates.includes(gate)) && (!asi || risks.includes(asi));
      card.closest('[data-incident-section]').hidden = !show;
      if (show) visible += 1;
    }
    updatePressed(gateButtons, gate, 'data-gate-filter');
    updatePressed(asiButtons, asi, 'data-asi-filter');
    reset?.setAttribute('aria-pressed', !gate && !asi ? 'true' : 'false');
    if (status) status.textContent = !gate && !asi
      ? 'Showing all 12 cases.'
      : `Showing ${visible} of ${cards.length} cases.`;
  };

  for (const button of gateButtons) {
    button.addEventListener('click', () => {
      const value = button.getAttribute('data-gate-filter') || '';
      gate = gate === value ? '' : value;
      update();
    });
  }

  for (const button of asiButtons) {
    button.addEventListener('click', () => {
      const value = button.getAttribute('data-asi-filter') || '';
      asi = asi === value ? '' : value;
      update();
    });
  }

  reset?.addEventListener('click', () => {
    gate = '';
    asi = '';
    update();
  });
})();
