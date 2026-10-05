export const DIAGNOSTIC_SCHEMA = 'bitevo.diagnostic.r1';

export const DIAGNOSTIC_QUESTIONS = Object.freeze([
  Object.freeze({ id:'action', gate:'Authority Budget', q:'Can you name the exact external action this workflow is allowed to perform?', why:'If the consequential action is vague, the authority boundary cannot be tested.' }),
  Object.freeze({ id:'object', gate:'Object binding', q:'Can the workflow prove which exact object the action applies to before execution?', why:'Correct permission on the wrong record, account or document is still the wrong effect.' }),
  Object.freeze({ id:'owner', gate:'Authority owner', q:'Is there a named role that owns the permission to perform this action?', why:'Authority without an owner becomes difficult to approve, constrain or revoke.' }),
  Object.freeze({ id:'evidence', gate:'Evidence Before Effect', q:'Is the minimum pre-action evidence explicitly defined?', why:'A workflow cannot fail closed on missing evidence if the evidence requirement is implicit.' }),
  Object.freeze({ id:'freshness', gate:'Freshness', q:'Does the workflow know when required evidence has become stale or invalid?', why:'A healthy-looking service can still be operating on truth that stopped advancing.' }),
  Object.freeze({ id:'confirm', gate:'External confirmation', q:'Is the intended external effect independently confirmed after the action?', why:'Internal completion or a tool acknowledgement is not proof that the outside system reached the expected state.' }),
  Object.freeze({ id:'recovery', gate:'Recovery', q:'When evidence or confirmation becomes uncertain, does the workflow enter a defined constrained/recovery state?', why:'Retrying or continuing through ambiguity can turn one uncertain action into repeated effects.' })
]);

export const DIAGNOSTIC_ANSWERS = Object.freeze(['YES','NO','UNKNOWN']);
const ANSWERS = new Set(DIAGNOSTIC_ANSWERS);

export function validateDiagnosticAnswers(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== DIAGNOSTIC_QUESTIONS.length) return false;
  return DIAGNOSTIC_QUESTIONS.every(item => ANSWERS.has(value[item.id]));
}

export function buildDiagnostic(answers, nowValue = new Date().toISOString()) {
  if (!validateDiagnosticAnswers(answers)) {
    throw new TypeError('All seven diagnostic gates require YES, NO or UNKNOWN.');
  }

  const results = DIAGNOSTIC_QUESTIONS.map(item => Object.freeze({
    ...item,
    answer:answers[item.id]
  }));
  const unresolved = results.filter(item => item.answer !== 'YES');
  const yes = results.filter(item => item.answer === 'YES');

  const headline = unresolved.length === 0
    ? 'All seven decision gates are explicitly answered.'
    : `${unresolved.length} decision gate${unresolved.length === 1 ? '' : 's'} remain unresolved.`;

  const interpretation = unresolved.length === 0
    ? 'That is not a safety pass or testing authorization. It means the description layer has no unresolved gates and can be used to prepare written scope and Rules of Engagement before evidence-based testing.'
    : 'NO and UNKNOWN are not converted into a numeric risk score. They become the concrete questions an owner should resolve before expanding authority.';

  const brief = [
    '=== BITEVO AUTHORITY & EVIDENCE DIAGNOSTIC ===',
    `Generated: ${nowValue}`,
    'No trust score. No certification. No testing authorization. Written Rules of Engagement required before test execution.',
    '',
    ...results.map(item => `${item.answer} — ${item.gate}: ${item.q}`),
    '',
    `Explicit YES gates: ${yes.length}/7`,
    `Unresolved NO/UNKNOWN gates: ${unresolved.length}/7`,
    ...unresolved.map(item => `- ${item.gate} [${item.answer}]: ${item.why}`)
  ].join('\n');

  return Object.freeze({
    schema:DIAGNOSTIC_SCHEMA,
    status:'ok',
    generated_at:nowValue,
    explicit_yes:yes.length,
    unresolved_count:unresolved.length,
    results:Object.freeze(results),
    unresolved:Object.freeze(unresolved),
    headline,
    interpretation,
    boundary:'This diagnostic does not establish that a workflow is safe or unsafe and does not authorize testing.',
    brief
  });
}
