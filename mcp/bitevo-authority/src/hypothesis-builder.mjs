export const HYPOTHESIS_SCHEMA = 'bitevo.hypothesis-builder.r1';
export const HYPOTHESIS_ORDER = Object.freeze(['action','object','owner','evidence','freshness','confirm','recovery']);

const COPY = Object.freeze({
  en:Object.freeze({
    frame:'When the workflow performs [action] on [object] under authority owned by [role], it must be blocked or constrained in the cases below, and leave the evidence listed.',
    footer:'Draft for scoping only. Not a finding, not a safety verdict, not testing authorization. Written Rules of Engagement are required before test execution.'
  }),
  ru:Object.freeze({
    frame:'Когда workflow выполняет [действие] над [объектом] по полномочию, которым владеет [роль], в случаях ниже оно должно блокироваться или ограничиваться и оставлять указанный след.',
    footer:'Черновик только для подготовки объёма работ. Не находка, не вердикт о безопасности и не разрешение на тестирование. До тестов нужны письменные Rules of Engagement.'
  })
});

export const HYPOTHESIS_GATES = Object.freeze({
  action:Object.freeze({
    en:Object.freeze({ gate:'Authority Budget', blocked:'Any external action other than [action].', evidence:'Record of the attempted action and the rule that allowed or refused it.' }),
    ru:Object.freeze({ gate:'Authority Budget', blocked:'Любое внешнее действие, кроме [действие].', evidence:'Запись о попытке действия и о правиле, которое его разрешило или отклонило.' })
  }),
  object:Object.freeze({
    en:Object.freeze({ gate:'Object binding', blocked:'[action] on any object other than [object ID] — correct permission on the wrong record is still the wrong effect.', evidence:'Object identifier checked before execution, and the identifier actually changed.' }),
    ru:Object.freeze({ gate:'Привязка к объекту', blocked:'[действие] над любым объектом, кроме [ID объекта]: верное разрешение на чужой записи — всё равно неверный эффект.', evidence:'ID объекта, проверенный до выполнения, и ID, который реально изменился.' })
  }),
  owner:Object.freeze({
    en:Object.freeze({ gate:'Authority owner', blocked:'Execution when [role] has not granted this permission.', evidence:'Grant or approval record that links [role] to [action].' }),
    ru:Object.freeze({ gate:'Владелец полномочия', blocked:'Выполнение, если [роль] не выдала это разрешение.', evidence:'Запись о выдаче или одобрении, связывающая [роль] и [действие].' })
  }),
  evidence:Object.freeze({
    en:Object.freeze({ gate:'Evidence Before Effect', blocked:'Execution when [minimum pre-action evidence] is missing — fail closed.', evidence:'The pre-action evidence set, captured before the effect.' }),
    ru:Object.freeze({ gate:'Evidence Before Effect', blocked:'Выполнение без [минимальный набор доказательств до действия] — отказ по умолчанию.', evidence:'Набор доказательств, снятый до эффекта.' })
  }),
  freshness:Object.freeze({
    en:Object.freeze({ gate:'Freshness', blocked:'Execution on evidence older than [freshness limit] or marked invalid.', evidence:'Timestamp or version of each evidence item at decision time.' }),
    ru:Object.freeze({ gate:'Свежесть', blocked:'Выполнение на доказательствах старше [срок] или помеченных недействительными.', evidence:'Время или версия каждого доказательства на момент решения.' })
  }),
  confirm:Object.freeze({
    en:Object.freeze({ gate:'External confirmation', blocked:'Reporting [action] as done before [external system] confirms it.', evidence:'External confirmation, separate from the tool acknowledgement.' }),
    ru:Object.freeze({ gate:'Внешнее подтверждение', blocked:'Отметка «сделано» до того, как [внешняя система] подтвердит [действие].', evidence:'Внешнее подтверждение, отдельное от ответа инструмента.' })
  }),
  recovery:Object.freeze({
    en:Object.freeze({ gate:'Recovery', blocked:'Retrying or continuing when evidence or confirmation is uncertain — the workflow enters [constrained / recovery state] instead.', evidence:'The state change, and who released the workflow from it.' }),
    ru:Object.freeze({ gate:'Восстановление', blocked:'Повтор или продолжение при неясных доказательствах или подтверждении — вместо этого переход в [ограниченный режим / режим восстановления].', evidence:'Смена состояния и кто вывел workflow из него.' })
  })
});

const VALID = new Set(['YES','NO','UNKNOWN']);

export function buildHypothesis(localeValue, answersValue, nowValue = new Date().toISOString()) {
  const locale = localeValue === 'ru' ? 'ru' : 'en';
  const answers = answersValue || {};
  if (!HYPOTHESIS_ORDER.every(id => VALID.has(answers[id]))) {
    throw new TypeError('All seven gates require YES, NO or UNKNOWN.');
  }

  const rows = HYPOTHESIS_ORDER.map(id => {
    const answer = answers[id];
    if (answer !== 'NO' && answer !== 'UNKNOWN') return null;
    const copy = HYPOTHESIS_GATES[id][locale];
    return Object.freeze({ id, answer, gate:copy.gate, blocked:copy.blocked, evidence:copy.evidence });
  }).filter(Boolean);

  if (!rows.length) {
    return Object.freeze({
      schema:HYPOTHESIS_SCHEMA,
      status:'no_open_gates',
      visible:false,
      locale,
      rows:Object.freeze([]),
      clipboard:''
    });
  }

  const text = COPY[locale];
  const clipboard = [
    '=== BITEVO · ENTRY AUDIT HYPOTHESIS (DRAFT) ===',
    `Generated: ${nowValue}`,
    text.frame,
    ...rows.map(row => '- ' + row.gate + ' [' + row.answer + ']: ' + row.blocked + ' ' + (locale === 'ru' ? 'Доказательства' : 'Evidence') + ': ' + row.evidence),
    text.footer
  ].join('\n');

  return Object.freeze({
    schema:HYPOTHESIS_SCHEMA,
    status:'ok',
    visible:true,
    locale,
    rows:Object.freeze(rows),
    clipboard
  });
}
