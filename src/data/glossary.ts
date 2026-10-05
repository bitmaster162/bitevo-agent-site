export const glossaryTerms = [
  {
    slug: 'authority-budget',
    term: 'Authority Budget',
    en: 'The consequential effects a workflow is currently allowed to create, including the actions, target objects, integrations, autonomous steps and retry or replay paths inside its permission boundary. BitEvo treats expansion of that boundary as something that must be justified by controls and evidence.',
    ru: 'Набор consequential effects, которые workflow сейчас разрешено создавать: действия, target objects, integrations, автономные шаги и retry/replay paths внутри его границы полномочий. В BitEvo расширение этой границы должно быть обосновано controls и evidence.',
    related: '/doctrine'
  },
  {
    slug: 'evidence-before-effect',
    term: 'Evidence Before Effect',
    en: 'The rule that required evidence must be present at decision time before a critical external action proceeds. Relevant evidence can include object identity, current source state, valid approval, version context and the expected confirmation path.',
    ru: 'Правило, по которому обязательные evidence должны существовать в момент решения до выполнения критического внешнего действия. Сюда могут входить identity объекта, актуальное source state, действующее approval, version context и ожидаемый confirmation path.',
    related: '/doctrine'
  },
  {
    slug: 'false-green',
    term: 'False Green',
    en: 'BitEvo terminology for an operational evidence mismatch in which a workflow appears healthy or successful while required freshness, external confirmation, retry outcome or object binding remains unresolved. The term does not mean every such mismatch is a security vulnerability.',
    ru: 'Термин BitEvo для operational evidence mismatch: workflow выглядит healthy или successful, хотя freshness, external confirmation, retry outcome или object binding остаются неразрешёнными. Термин не означает, что каждый такой mismatch является security vulnerability.',
    related: '/doctrine'
  },
  {
    slug: 'object-binding',
    term: 'Object binding',
    en: 'Evidence that the permission, approval and decision context apply to the exact record, recipient, environment or other target object that the workflow is about to change.',
    ru: 'Evidence того, что permission, approval и decision context относятся именно к той записи, получателю, environment или другому target object, который workflow собирается изменить.',
    related: '/diagnostic'
  },
  {
    slug: 'authority-owner',
    term: 'Authority owner',
    en: 'The named role accountable for the permission to perform a consequential action, including the ability to approve, constrain or revoke that permission.',
    ru: 'Названная роль, отвечающая за permission на consequential action, включая возможность одобрить, ограничить или отозвать это permission.',
    related: '/diagnostic'
  },
  {
    slug: 'freshness',
    term: 'Freshness',
    en: 'The validity rule that determines whether decision-bearing evidence is current enough to rely on and what event, age, version drift or state change makes it stale or invalid.',
    ru: 'Validity rule, определяющее, достаточно ли актуальны decision-bearing evidence и какое событие, возраст, version drift или изменение state делает их stale или invalid.',
    related: '/diagnostic'
  },
  {
    slug: 'external-confirmation',
    term: 'External confirmation',
    en: 'Independent read-back, receipt or state observation used to verify that the intended external system reached the expected state. An internal completion flag or tool acknowledgement alone is not that confirmation.',
    ru: 'Независимый read-back, receipt или observation состояния, подтверждающий, что внешняя система достигла ожидаемого state. Внутренний completion flag или acknowledgement инструмента сами по себе таким подтверждением не являются.',
    related: '/diagnostic'
  },
  {
    slug: 'recovery-state',
    term: 'Recovery state',
    en: 'An explicit constrained state entered when required evidence or effect confirmation becomes uncertain. The defined behavior may stop, reconcile, compensate, roll back or escalate rather than silently continue.',
    ru: 'Явное constrained state, в которое workflow переходит, когда обязательные evidence или подтверждение эффекта становятся неопределёнными. Определённое поведение может остановить, reconcile, compensate, roll back или escalate вместо silent continuation.',
    related: '/failure-recovery'
  },
  {
    slug: 'idempotency',
    term: 'Idempotency',
    en: 'A property or control under which repeating the same logical operation does not create an unintended additional external effect. In BitEvo scope, idempotency is examined together with retry, replay and recovery behavior.',
    ru: 'Свойство или control, при котором повтор той же логической операции не создаёт непреднамеренный дополнительный внешний effect. В BitEvo idempotency рассматривается вместе с retry, replay и recovery behavior.',
    related: '/failure-recovery'
  },
  {
    slug: 'confused-deputy',
    term: 'Confused deputy',
    en: 'A failure pattern in which a system uses authority it legitimately has to create an effect for a requester or context that was not entitled to cause that exact effect. In BitEvo scope, the relevant evidence is the binding among requester identity, authority, target object and approval.',
    ru: 'Failure pattern, при котором система использует реально принадлежащее ей authority, чтобы создать effect для requester или context, который не имел права вызвать именно этот effect. В scope BitEvo важна связка requester identity, authority, target object и approval.',
    related: '/agent-authority-audit'
  },
  {
    slug: 'consequential-action',
    term: 'Consequential action',
    en: 'A write, send, update, deploy or other external mutation whose failure matters enough to require an explicit authority and evidence boundary.',
    ru: 'Write, send, update, deploy или другая внешняя mutation, ошибка которой требует явной границы authority и evidence.',
    related: '/agent-authority-audit'
  },
  {
    slug: 'authority-ledger',
    term: 'Authority Ledger',
    en: 'The BitEvo work product that records the consequential action, target object, authority owner, approvals, allowed and prohibited transitions, and retry, replay or recovery rights.',
    ru: 'Рабочий артефакт BitEvo, фиксирующий consequential action, target object, authority owner, approvals, разрешённые и запрещённые transitions, а также retry, replay и recovery rights.',
    related: '/artifacts'
  },
  {
    slug: 'evidence-contract',
    term: 'Evidence Contract',
    en: 'The BitEvo work product that defines what evidence must be present, fresh, attributable and object-bound before a critical effect is allowed, plus the required confirmation and uncertainty behavior.',
    ru: 'Рабочий артефакт BitEvo, определяющий, какие evidence должны быть present, fresh, attributable и object-bound до разрешения critical effect, а также требуемые confirmation и uncertainty behavior.',
    related: '/artifacts'
  },
  {
    slug: 'finding-record',
    term: 'Finding Record',
    en: 'The BitEvo work product that preserves a reproduced trigger, authority context, evidence, external effect, recovery behavior and residual uncertainty so the claim can be inspected and retested.',
    ru: 'Рабочий артефакт BitEvo, сохраняющий reproduced trigger, authority context, evidence, external effect, recovery behavior и residual uncertainty, чтобы finding можно было проверить и retest.',
    related: '/artifacts'
  },
  {
    slug: 'decision-memo',
    term: 'Decision Memo',
    en: 'The BitEvo work product that turns accepted evidence into one bounded owner decision: expand authority, constrain it, repair the chain or retest.',
    ru: 'Рабочий артефакт BitEvo, превращающий accepted evidence в одно bounded owner decision: expand authority, constrain, repair или retest.',
    related: '/artifacts'
  }
] as const;
