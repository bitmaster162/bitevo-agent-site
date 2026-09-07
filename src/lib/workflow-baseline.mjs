const round = value => Math.round((value + Number.EPSILON) * 1000) / 1000;

const finiteNonNegative = (value, label) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label} must be a finite non-negative number`);
  }
  return n;
};

export function calculateWorkflowBaseline(input = {}) {
  const cases = finiteNonNegative(input.cases_per_period, 'cases_per_period');
  const firstMinutes = finiteNonNegative(input.first_pass_minutes_per_case, 'first_pass_minutes_per_case');
  const repeatRate = finiteNonNegative(input.repeat_touch_rate, 'repeat_touch_rate');
  const repeatMinutes = finiteNonNegative(input.repeat_touch_minutes, 'repeat_touch_minutes');
  if (repeatRate > 1) throw new Error('repeat_touch_rate must be between 0 and 1');

  const laborRaw = input.loaded_labor_cost_per_hour;
  const labor = laborRaw === '' || laborRaw === null || laborRaw === undefined
    ? null
    : finiteNonNegative(laborRaw, 'loaded_labor_cost_per_hour');

  const firstPassHours = cases * firstMinutes / 60;
  const repeatTouchHours = cases * repeatRate * repeatMinutes / 60;
  const totalHours = firstPassHours + repeatTouchHours;
  return {
    first_pass_hours_per_period: round(firstPassHours),
    repeat_touch_hours_per_period: round(repeatTouchHours),
    total_exception_hours_per_period: round(totalHours),
    labor_cost_per_period: labor === null ? null : round(totalHours * labor)
  };
}
