---
site: bitevo.work
path: /ru/guides/mcp-server-authority-review
alternate: /guides/mcp-server-authority-review
lang: ru
card: "05 · Исследование · Обзор полномочий MCP-серверов — Проверка 20 open-source MCP-серверов через семь ворот полномочий BitEvo."
title: "Обзор полномочий 20 open-source MCP-серверов"
seo_title: "Полномочия 20 open-source MCP-серверов | BitEvo"
description: "Проверка полномочий в 20 open-source MCP-серверах: scope, привязка объекта, подтверждение, свежесть доказательств и восстановление."
reviewed: 2026-10-06
next_review: 2027-01-06
related: [/ru/agent-authority-audit, /ru/diagnostic, /ru/guides/before-write-access]
schema: [Article, BreadcrumbList]
research_source: "20 первичных/repository источников перепроверены 2026-10-06; BitEvo N21 R1"
---

Исследование · проверенная заметка

# Обзор полномочий 20 open-source MCP-серверов

Этот desk review отвечает на один ограниченный вопрос: **что ограничивает полномочия агента до того, как MCP tool достигнет целевой системы?** Рассмотрены 20 open-source реализаций по первичным или repository-источникам, перепроверенным 6 октября 2026 года. Это не penetration test, не сертификация, не endorsement и не утверждение, что какой-либо сервер «безопасен» или «небезопасен».

Отсутствие контроля в процитированном источнике означает **«не подтверждено рассмотренным источником»**, а не «контроля не существует». Tool annotations считаются metadata, пока enforcement не подтверждён отдельно.

## Как читать обзор

Для каждой реализации отдельно указаны поверхность полномочий, подтверждённые controls, существенное предостережение и то, чего рассмотренный MCP-слой не доказывает. Для всей выборки используются семь ворот BitEvo: Authority Budget, Object binding, Authority owner, Evidence Before Effect, Freshness, External confirmation и Recovery.

## 20 серверов

### 1. GitHub MCP Server
**Поверхность полномочий:** Репозитории, issues, PR, Actions и связанные поверхности GitHub.
**Подтверждённые controls:** Строгий read-only; фильтрация toolset/tool; права PAT/OAuth/App остаются внешней границей.
**Существенное предостережение:** Lockdown описан как верхний фильтр контента, а не как граница авторизации.
**Не подтверждено здесь:** Freshness и MCP-контракт отката не подтверждены рассмотренными источниками.
**Источник:** [GitHub MCP Server](https://github.com/github/github-mcp-server/blob/main/docs/server-configuration.md)

### 2. GitLab MCP Server
**Поверхность полномочий:** Проекты, репозитории, merge requests, work items, CI и связанные поверхности GitLab.
**Подтверждённые controls:** OAuth 2.0 dynamic registration; выбор toolsets/tools; продуктовые права остаются внешними; merge требует наблюдавшийся SHA головы MR.
**Существенное предостережение:** Общий read-only режим в рассмотренной документации не подтверждён.
**Не подтверждено здесь:** Общий контракт freshness/rollback не подтверждён.
**Источник:** [GitLab MCP Server](https://docs.gitlab.com/user/model_context_protocol/mcp_server/)

### 3. Microsoft Playwright MCP
**Поверхность полномочий:** Навигация браузера, клики, формы, файлы и browser tooling.
**Подтверждённые controls:** Доступ к файловой системе по умолчанию ограничен workspace roots; file:// по умолчанию блокируется; есть host/origin controls и выбор capabilities.
**Существенное предостережение:** Проект прямо говорит, что эти controls не являются security boundary; redirect может обходить origin assumptions.
**Не подтверждено здесь:** Общий read-only режим и rollback contract не подтверждены.
**Источник:** [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp/blob/main/README.md)

### 4. Cloudflare MCP
**Поверхность полномочий:** API Cloudflare: Workers, KV, R2, D1, DNS, Access и другое.
**Подтверждённые controls:** OAuth/API-token permissions могут ограничивать внешнего principal; поверхность endpoints/tools можно сужать.
**Существенное предостережение:** Потенциальная authority широкая; универсальный MCP read-only switch не подтверждён.
**Не подтверждено здесь:** Freshness и Recovery зависят от внешних систем и политики.
**Источник:** [Cloudflare MCP](https://github.com/cloudflare/mcp/blob/main/README.md)

### 5. Sentry MCP
**Поверхность полномочий:** Инспекция issues/events, Seer, triage и управление проектами/командами.
**Подтверждённые controls:** Skill groups сужают возможности; read scopes покрывают инспекцию, write scopes нужны для управляющих действий.
**Существенное предостережение:** Разделение возможностей сильное, но confirmation эффекта не универсален.
**Не подтверждено здесь:** Общий Recovery contract не подтверждён.
**Источник:** [Sentry MCP](https://github.com/getsentry/sentry-mcp/blob/main/packages/mcp-core/README.md)

### 6. Grafana MCP
**Поверхность полномочий:** Dashboards, folders, incidents, alerting, datasources и queries.
**Подтверждённые controls:** --disable-write; отключение категорий; granular RBAC actions и resource scopes.
**Существенное предостережение:** Raw SQL может менять данные, если его явно вернуть и credentials datasource это допускают.
**Не подтверждено здесь:** MCP-гарантии Freshness и rollback не подтверждены.
**Источник:** [Grafana MCP](https://github.com/grafana/mcp-grafana/blob/main/README.md)

### 7. Neon MCP
**Поверхность полномочий:** Projects, branches, endpoints, schema, queries, auth и storage.
**Подтверждённые controls:** OAuth read/write; параметры grant readonly/projectId/category; project-scoped mode убирает account-level tools.
**Существенное предостережение:** Category metadata сама по себе не является read/write boundary.
**Не подтверждено здесь:** Freshness и Recovery не установлены MCP-слоем.
**Источник:** [Neon MCP](https://github.com/neondatabase/mcp-server-neon)

### 8. Supabase MCP
**Поверхность полномочий:** Database, account, debugging, functions, storage и branching.
**Подтверждённые controls:** read_only=true; project_ref; feature groups; read-only database user для SQL; mutating tools отключаются в текущем read-only режиме.
**Существенное предостережение:** Без project_ref authority может охватывать все проекты организации.
**Не подтверждено здесь:** Recovery зависит от платформы, а не гарантируется MCP.
**Источник:** [Supabase MCP](https://github.com/supabase/mcp)

### 9. MongoDB MCP Server
**Поверхность полномочий:** MongoDB data и Atlas administration.
**Подтверждённые controls:** --readOnly; disabledTools; connection scoping; настраиваемые confirmation-required tools.
**Существенное предостережение:** Если client не поддерживает elicitation, документация говорит, что confirmation-required tools выполняются без подтверждения.
**Не подтверждено здесь:** Confirmation нельзя считать fail-closed без доказанной client capability или удаления write authority.
**Источник:** [MongoDB MCP Server](https://github.com/mongodb-js/mongodb-mcp-server)

### 10. Redis MCP Server
**Поверхность полномочий:** Redis keys, data structures, streams, pub/sub и связанные операции.
**Подтверждённые controls:** Redis ACL — жёсткая граница; официальная документация показывает read-only ACL pattern.
**Существенное предостережение:** Универсальный server-native MCP read-only gate не подтверждён.
**Не подтверждено здесь:** Freshness, confirmation и rollback не установлены рассмотренным MCP-слоем.
**Источник:** [Redis MCP Server](https://github.com/redis/mcp-redis/blob/main/README.md)

### 11. Kubernetes MCP Server
**Поверхность полномочий:** Kubernetes/OpenShift resources, Helm, configuration и optional multi-cluster.
**Подтверждённые controls:** read_only; disable_destructive; toolsets; enabled/disabled tools; denied_resources; confirmation rules; optional pre-execution validation.
**Существенное предостережение:** confirmation_fallback по умолчанию allow при отсутствии elicitation; validation по умолчанию выключен.
**Не подтверждено здесь:** Fail-closed confirmation требует явного deny fallback и ограниченного RBAC/resource scope.
**Источник:** [Kubernetes MCP Server](https://github.com/containers/kubernetes-mcp-server/blob/main/docs/configuration.md)

### 12. Terraform MCP Server
**Поверхность полномочий:** Terraform Registry и HCP Terraform/TFE organizations, workspaces, variables и runs.
**Подтверждённые controls:** Per-user token passthrough для RBAC; organization allowlist; tool/toolset selection; Terraform operations по умолчанию отключены до явного enablement.
**Существенное предостережение:** Права внешнего token остаются определяющими.
**Не подтверждено здесь:** Durable approval receipt и rollback contract не подтверждены.
**Источник:** [Terraform MCP Server](https://github.com/hashicorp/terraform-mcp-server/blob/main/README.md)

### 13. Azure MCP Server 2.0
**Поверхность полномочий:** Azure services через namespaces и commands.
**Подтверждённые controls:** --read-only; namespace/tool filtering; metadata ReadOnly/Destructive/Idempotent/Secret; Azure identity/RBAC остаётся внешней границей.
**Существенное предостережение:** Старый Azure/azure-mcp архивирован; актуальный код находится в microsoft/mcp.
**Не подтверждено здесь:** Azure RBAC остаётся authority owner; Recovery зависит от конкретного сервиса.
**Источник:** [Azure MCP Server 2.0](https://github.com/microsoft/mcp/blob/main/servers/Azure.Mcp.Server/README.md)

### 14. ClickHouse MCP Server
**Поверхность полномочий:** SQL queries против ClickHouse/chDB.
**Подтверждённые controls:** Read-only по умолчанию; writes требуют явного enablement; destructive operations требуют дополнительного флага; рекомендуется least-privilege DB user.
**Существенное предостережение:** Проект прямо называет destructive MCP guard best-effort защитой от ошибок, а не security boundary.
**Не подтверждено здесь:** Фактические authority и Recovery зависят от ClickHouse grants и platform controls.
**Источник:** [ClickHouse MCP Server](https://github.com/ClickHouse/mcp-clickhouse/blob/main/README.md)

### 15. Postgres MCP Pro
**Поверхность полномочий:** PostgreSQL SQL, inspection и performance tooling.
**Подтверждённые controls:** Restricted mode использует read-only transactions и execution limits; SQL парсится для блокировки обхода через transaction-control.
**Существенное предостережение:** Документация предупреждает, что unsafe stored-procedure languages могут обходить protections.
**Не подтверждено здесь:** Отдельный human-confirmation и rollback contract не подтверждены.
**Источник:** [Postgres MCP Pro](https://github.com/crystaldba/postgres-mcp/blob/main/README.md)

### 16. Notion MCP Server (self-hosted)
**Поверхность полномочий:** Notion pages, databases/data sources и workspace reads/writes.
**Подтверждённые controls:** Integration capabilities могут быть read-only; page/database надо share для integration; HTTP transport использует bearer auth.
**Существенное предостережение:** Репозиторий больше активно не поддерживается в пользу hosted Notion MCP.
**Не подтверждено здесь:** Отдельный high-impact confirmation и MCP rollback layer не подтверждены.
**Источник:** [Notion MCP Server (self-hosted)](https://github.com/makenotion/notion-mcp-server)

### 17. MCP Filesystem reference server
**Поверхность полномочий:** Локальные filesystem read/write/create/move/delete.
**Подтверждённые controls:** Allowed directories/MCP Roots; path validation; destructive annotations; edit_file поддерживает dry-run diff preview.
**Существенное предостережение:** Reference repository маркирует эти реализации как образовательные, а не production-ready.
**Не подтверждено здесь:** Универсальный read-only и human-confirmation gate не подтверждены.
**Источник:** [MCP Filesystem reference server](https://github.com/modelcontextprotocol/servers/blob/main/src/filesystem/README.md)

### 18. MCP Git reference server
**Поверхность полномочий:** Git status/diff/log плюс add, commit, branch и checkout.
**Подтверждённые controls:** --repository привязывает работу к repo path; tools принимают repo_path; Git history даёт target-level recovery primitives.
**Существенное предостережение:** Это early-development reference code с прямыми mutation tools.
**Не подтверждено здесь:** Reference status и advisories не позволяют считать его production security baseline.
**Источник:** [MCP Git reference server](https://github.com/modelcontextprotocol/servers/blob/main/src/git/README.md)

### 19. MCP Memory reference server
**Поверхность полномочий:** Локальные persistent knowledge-graph entities, relations и observations.
**Подтверждённые controls:** Storage path настраивается; annotations отмечают destructive delete operations; state локальный.
**Существенное предостережение:** Authentication, read-only mode, отдельное approval и Freshness на MCP-слое не подтверждены.
**Не подтверждено здесь:** Bounded rollback contract не подтверждён.
**Источник:** [MCP Memory reference server](https://github.com/modelcontextprotocol/servers/blob/main/src/memory/README.md)

### 20. AWS API MCP Server (awslabs)
**Поверхность полномочий:** Широкий набор AWS APIs через AWS API/CLI bridge.
**Подтверждённые controls:** READ_OPERATIONS_ONLY; REQUIRE_MUTATION_CONSENT; IAM остаётся primary security control; risky subprocess-style operations denylisted.
**Существенное предостережение:** Проект перешёл в end-of-development 2026-07-15; read-only classification всё равно может раскрывать sensitive data или локальные файлы.
**Не подтверждено здесь:** Recovery зависит от сервиса; migration status надо перепроверять перед использованием.
**Источник:** [AWS API MCP Server (awslabs)](https://github.com/awslabs/mcp/blob/main/src/aws-api-mcp-server/README.md)

## Синтез по семи воротам

1. **Authority Budget:** самый сильный паттерн — убрать capability до того, как модель сможет её вызвать: read-only, tool filtering, category filtering и внешние least-privilege permissions.
2. **Object binding:** сильнее всего выглядят grants, заранее связанные с project, repository, organization, namespace, resource, allowed root или точной revision.
3. **Authority owner:** зрелые реализации обычно оставляют окончательное право внешнему principal — IAM, OAuth scopes, RBAC, ACL или database grants. MCP flags являются defense in depth, если не задают более жёсткий потолок.
4. **Evidence Before Effect:** dry-run, revision guards и pre-execution validation встречаются, но durable expected-versus-observed evidence receipt редок.
5. **Freshness:** это одно из наименее явно реализованных ворот. Успешная authentication не доказывает, что approval или наблюдение target state ещё актуальны.
6. **External confirmation:** confirmation имеет смысл только при fail-closed пути без подтверждения. Документация MongoDB и Kubernetes показывает, почему важны elicitation capability клиента и fallback behavior.
7. **Recovery:** восстановление обычно является свойством целевой платформы, а не гарантией MCP server. History, backups и rollout controls надо проверять на конкретном workflow.

## Чего этот обзор не устанавливает

Это не доказательство клиента, не ranking, не trust score, не security certification, не penetration test, не testing authorization и не юридическая консультация. Отсутствие документированного контроля не трактуется как отсутствие контроля в реализации. Статус проектов и defaults, зависящие от времени, перед operational use надо повторно сверять с первичным источником.

## Реестр источников
1. [GitHub MCP Server](https://github.com/github/github-mcp-server/blob/main/docs/server-configuration.md)
2. [GitLab MCP Server](https://docs.gitlab.com/user/model_context_protocol/mcp_server/)
3. [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp/blob/main/README.md)
4. [Cloudflare MCP](https://github.com/cloudflare/mcp/blob/main/README.md)
5. [Sentry MCP](https://github.com/getsentry/sentry-mcp/blob/main/packages/mcp-core/README.md)
6. [Grafana MCP](https://github.com/grafana/mcp-grafana/blob/main/README.md)
7. [Neon MCP](https://github.com/neondatabase/mcp-server-neon)
8. [Supabase MCP](https://github.com/supabase/mcp)
9. [MongoDB MCP Server](https://github.com/mongodb-js/mongodb-mcp-server)
10. [Redis MCP Server](https://github.com/redis/mcp-redis/blob/main/README.md)
11. [Kubernetes MCP Server](https://github.com/containers/kubernetes-mcp-server/blob/main/docs/configuration.md)
12. [Terraform MCP Server](https://github.com/hashicorp/terraform-mcp-server/blob/main/README.md)
13. [Azure MCP Server 2.0](https://github.com/microsoft/mcp/blob/main/servers/Azure.Mcp.Server/README.md)
14. [ClickHouse MCP Server](https://github.com/ClickHouse/mcp-clickhouse/blob/main/README.md)
15. [Postgres MCP Pro](https://github.com/crystaldba/postgres-mcp/blob/main/README.md)
16. [Notion MCP Server (self-hosted)](https://github.com/makenotion/notion-mcp-server)
17. [MCP Filesystem reference server](https://github.com/modelcontextprotocol/servers/blob/main/src/filesystem/README.md)
18. [MCP Git reference server](https://github.com/modelcontextprotocol/servers/blob/main/src/git/README.md)
19. [MCP Memory reference server](https://github.com/modelcontextprotocol/servers/blob/main/src/memory/README.md)
20. [AWS API MCP Server (awslabs)](https://github.com/awslabs/mcp/blob/main/src/aws-api-mcp-server/README.md)

Контекст статуса/security reference servers: [Model Context Protocol reference servers security](https://github.com/modelcontextprotocol/servers/security)
