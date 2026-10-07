---
site: bitevo.work
path: /ru/guides/bitget-authority-after-orchestration-compromise
alternate: /guides/bitget-authority-after-orchestration-compromise
lang: ru
card: "06 · Инцидент · Полномочия после компрометации оркестрации Bitget — Что подтверждённые источники показывают о детектировании, effect authority и внешнем подтверждении."
title: "Bitget: полномочия после компрометации оркестрации"
seo_title: "Инцидент Bitget: полномочия после компрометации | BitEvo"
description: "Разбор Bitget по первичным источникам: почему обнаружение и блокировка заявок на вывод сами по себе не доказывают отзыв downstream-полномочий."
reviewed: 2026-10-07
next_review: 2027-01-07
related: [/ru/agent-authority-audit, /ru/diagnostic, /ru/guides/before-write-access]
schema: [Article, BreadcrumbList]
research_source: "Официальные обновления Bitget по 2026-10-04; отчёт Mandiant от 2026-09-28; отчёт SlowMist по 2026-09-29; документация XRPL; evidence pack BitEvo MatrixOut по XRP"
---

Исследование · проверенная заметка об инциденте

# Bitget: полномочия после компрометации оркестрации

Эта заметка отвечает на один ограниченный вопрос: **какие доказательства показывают, что после компрометации wallet-orchestration действительно отозвано полномочие, способное производить внешний эффект?**

Это не анализ рынка, не атрибуция атакующего, не оценка платёжеспособности, не penetration test и не реконструкция недокументированной внутренней архитектуры Bitget. Выводы компании атрибутируются Bitget. Выводы Mandiant и SlowMist атрибутируются их отчётам. XRP Ledger используется только в пределах того, что способен установить публичный реестр.

## Detection был не одним событием

Первое уведомление Bitget и status report Mandiant от 28 сентября относят обнаружение несанкционированных outbound transfers примерно к **18:31 UTC 24 сентября 2026 года**. Более поздняя официальная временная шкала Bitget отдельно ставит событие **19:05 UTC**, когда reconciliation system выявил существенное расхождение, а risk-control system автоматически заблокировал withdrawal requests по платформе.

Эти два события нельзя молча склеивать в один timestamp. Они описывают разные наблюдения и controls: обнаружение unauthorized effects в 18:31, затем reconciliation discrepancy и блокировку withdrawal requests в 19:05.

Более поздняя временная шкала Bitget ставит highest-level emergency response на 19:14, начало containment measures на 19:40 и отключение wallet withdrawal services, включая signing services, на 21:44.

**Источники:** [первое уведомление Bitget](https://www.bitget.com/support/articles/12560603896024), [более поздняя временная шкала Bitget](https://www.bitget.com/academy/bitget-security-incident-what-happened-timeline-impact-response), [status report Mandiant](https://img.bgstatic.com/multiLang/events/MFR26-1029_Status_Update_Bitget_0930.pdf).

## Что устанавливают forensic reports

Progress report SlowMist сообщает, что самая ранняя malicious activity в доступных логах датируется **31 августа** на узле стороннего security **Product A**. В отчёте описаны zero-day vulnerability в одном из сервисов, запуск hidden script под процессом этого сервиса, команда чтения environment variable с database password и прямое подключение к базе. Аналогичная hidden-script activity была обнаружена ещё на двух узлах 23 и 25 сентября.

SlowMist сообщает, что ранним утром 25 сентября UTC+8 атакующий получил доступ к management platform **Product B** под identity внутреннего сотрудника, пытался внедрять system commands через task parameters, использовал web execution endpoint и затем размещал malicious program files. SlowMist также сообщает о восстановленном удалённом highly customized withdrawal tool, адаптированном к withdrawal logic wallet-системы. По отчёту, tool подделывал risk-control parameters, формировал withdrawal requests и вызывал withdrawal process.

Status report Mandiant от 28 сентября сообщает о несанкционированном privileged access к third-party security appliances A и B, web shell на appliance B, установлении command-and-control, lateral movement на production wallet job server Bitget и развёртывании malicious packages. Mandiant подчёркивает, что расследование продолжается и выводы предварительные.

Это выводы forensic reports. Они не устанавливают публичное имя продукта или вендора, CVE, участие внутреннего сообщника или компрометацию private keys. Bitget отдельно заявляет, что private-key compromise был исключён.

**Источники:** [SlowMist progress report](https://github.com/slowmist/Knowledge-Base/blob/master/open-report-V2/incident-response/SlowMist%20Investigation%20Progress%20Report%20-%20Bitget_en-us.pdf), [Mandiant status report](https://img.bgstatic.com/multiLang/events/MFR26-1029_Status_Update_Bitget_0930.pdf), [incident page Bitget](https://www.bitget.com/campaigns/bitget-security-incident-2026).

## Что может установить XRP evidence

Сохранённые данные BitEvo MatrixOut по XRP фиксируют перевод **91,420,942.755708 XRP в 19:16:20 UTC** на адрес атакующего и ещё **9,306,865.8 XRP в 21:19:21 UTC**. Также зафиксированы неуспешная attacker-directed попытка в 20:28:20 и внутренний перевод Bitget в 20:40:02.

Относительно более позднего события Bitget 19:05 — reconciliation/block — перевод в 19:16:20 произошёл **через 11m20s**, а перевод в 21:19:21 — **через 2h14m21s**. Последний произошёл **за 24m39s до** заявленного Bitget отключения wallet withdrawal и signing services в 21:44.

В проверенных XRP-транзакциях также наблюдались те же on-chain `SigningPubKey` для соответствующих Bitget accounts и тот же construction pattern `LastLedgerSequence - ledger_index = +998`, что и в изученных обычных операциях.

Эти наблюдения полезны как evidence о transaction construction и времени внешнего эффекта. Они **не** являются криптографическими timestamps подписания. Они не устанавливают внутреннего инициатора, не доказывают компрометацию private keys, не доказывают и не опровергают off-chain MPC/TSS и не доказывают отказ именованного "kill switch".

**Источники:** evidence pack BitEvo MatrixOut; [общие поля транзакций XRPL](https://xrpl.org/docs/references/protocol/transactions/common-fields); [finality XRPL](https://xrpl.org/docs/concepts/transactions/finality-of-results).

## Урок о полномочиях

Защищаемый вывод — не «сломался kill switch». Публичные доказательства не устанавливают наличие такого механизма и его scope.

Более точный вывод: **состояние контроля имеет смысл только тогда, когда он привязан к объекту и действию, которые всё ещё способны производить внешний эффект.**

Публичная временная шкала Bitget говорит, что withdrawal requests были автоматически заблокированы в 19:05. Forensic reports описывают компрометацию, дошедшую до wallet-related backend execution. Публичный реестр фиксирует attacker-directed XRP effects после 19:05. Эти утверждения совместимы, потому что customer-facing request block и downstream wallet execution path не обязаны быть одной authority surface.

### Evidence Before Effect

После компрометации control plane или orchestration внутреннее состояние "blocked" доказывает состояние одного контроля. Оно само по себе не доказывает прекращение внешнего эффекта. Проверять нужно effect surface.

### External Confirmation

Если эффект попадает в независимо наблюдаемую систему, её нужно использовать для подтверждения того, продолжаются ли эффекты. Validated result XRPL может установить успех или отказ транзакции. Он не устанавливает человеческое намерение или точное время подписания.

### Object / action binding

Stop decision должен точно определять объект, класс действия, authority owner и downstream executors, чьё полномочие отзывается. Формулировка «выводы остановлены» слабее evidence, доказывающего, какие execution paths больше не могут submit, authorize, sign или release эффект.

### Recovery after compromise

Recovery — это не сработавший alert и не установленный block. Recovery требует evidence, что скомпрометированный effect path утратил полномочие, а затем fresh validation до восстановления authority.

## Чего эти доказательства не устанавливают

Заметка не устанавливает участие инсайдера, личность атакующего, платёжеспособность, failure private keys, failure MPC/TSS или failure kill switch. Она не достраивает недокументированный internal authority graph Bitget. Ledger inclusion time и поля транзакций не раскрывают точное время подписания или внутреннего инициатора.

Узкий вывод относится к дизайну controls: после компрометации orchestration нужно доказать отзыв полномочия на уровне effect path, а не считать upstream block или incident-response state достаточным доказательством.