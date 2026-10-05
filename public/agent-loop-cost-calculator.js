(() => {
  'use strict';
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 });
  const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

  document.querySelectorAll('[data-loop-cost-calculator]').forEach(root => {
    const form = root.querySelector('[data-calc-form]');
    const output = root.querySelector('[data-calc-output]');
    const empty = root.querySelector('[data-calc-empty]');
    const ru = root.dataset.locale === 'ru';

    const read = name => Number(form.elements.namedItem(name)?.value);
    const set = (sel, value) => { const el = root.querySelector(sel); if (el) el.textContent = value; };

    form?.addEventListener('submit', event => {
      event.preventDefault();
      const cost = read('cost');
      const rate = read('rate');
      const parallel = read('parallel');
      const detection = read('detection');
      const budget = read('budget');
      if (![cost, rate, parallel, detection, budget].every(v => Number.isFinite(v) && v > 0)) return;

      const burnPerMinute = cost * rate * parallel;
      const attemptsBeforeDetection = rate * parallel * detection;
      const spendBeforeDetection = cost * attemptsBeforeDetection;
      const minutesToBudget = budget / burnPerMinute;
      const attemptsAtBudget = Math.max(1, Math.floor(budget / cost));

      set('[data-burn]', money.format(burnPerMinute));
      set('[data-attempts]', number.format(attemptsBeforeDetection));
      set('[data-spend]', money.format(spendBeforeDetection));
      set('[data-budget-time]', number.format(minutesToBudget) + (ru ? ' мин' : ' min'));
      set('[data-budget-attempts]', number.format(attemptsAtBudget));
      set('[data-limit-spend]', '≤ ' + money.format(budget));
      set('[data-limit-attempts]', '≤ ' + number.format(attemptsAtBudget));
      set('[data-limit-runtime]', '≤ ' + number.format(minutesToBudget) + (ru ? ' мин при введённой скорости' : ' min at the entered rate'));

      const delta = spendBeforeDetection - budget;
      const verdict = delta > 0
        ? (ru
          ? 'При введённых допущениях окно до обнаружения превышает ваш бюджет на ' + money.format(delta) + '. Hard stop должен сработать раньше.'
          : 'Under the entered assumptions, the detection window exceeds your budget by ' + money.format(delta) + '. The hard stop must trigger earlier.')
        : (ru
          ? 'При введённых допущениях расход до обнаружения ниже вашего бюджета на ' + money.format(Math.abs(delta)) + '. Это не safety pass.'
          : 'Under the entered assumptions, spend before detection is below your budget by ' + money.format(Math.abs(delta)) + '. This is not a safety pass.');
      set('[data-verdict]', verdict);

      empty.hidden = true;
      output.hidden = false;
    });

    form?.addEventListener('reset', () => {
      requestAnimationFrame(() => {
        output.hidden = true;
        empty.hidden = false;
      });
    });
  });
})();
