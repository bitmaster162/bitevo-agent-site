---
site: bitevo.work
path: /guides/mcp-server-authority-review
alternate: /ru/guides/mcp-server-authority-review
lang: en
card: "05 · Research · MCP server authority review — Source-backed review of 20 open-source MCP servers through BitEvo's seven authority gates."
title: "Authority review of 20 open-source MCP servers"
seo_title: "20 open-source MCP servers: authority controls | BitEvo"
description: "Source-backed review of authority controls in 20 open-source MCP servers: scope, object binding, confirmation, freshness and recovery."
reviewed: 2026-10-06
next_review: 2027-01-06
related: [/agent-authority-audit, /diagnostic, /guides/before-write-access]
schema: [Article, BreadcrumbList]
research_source: "20 first-party/repository sources rechecked 2026-10-06; BitEvo N21 R1"
---

Research · reviewed note

# Authority review of 20 open-source MCP servers

This desk review asks one bounded question: **what limits an agent's authority before an MCP tool reaches the target system?** It covers 20 open-source implementations using first-party or repository documentation rechecked on 6 October 2026. It is not a penetration test, certification, endorsement, or claim that any server is secure or insecure.

Absence from a cited source means **not evidenced in the reviewed source**, not “does not exist.” Tool annotations are treated as metadata unless enforcement is separately documented.

## How to read the review

Each entry separates the authority surface, controls evidenced by the source, a material caution, and what the reviewed MCP layer does not establish. The same seven BitEvo gates are used across the sample: Authority Budget, Object binding, Authority owner, Evidence Before Effect, Freshness, External confirmation, and Recovery.

## The 20 servers

### 1. GitHub MCP Server
**Authority surface:** Repositories, issues, PRs, Actions and related GitHub surfaces.
**Controls evidenced:** Strict read-only mode; toolset/tool filtering; PAT/OAuth/App permissions remain upstream.
**Material caution:** Lockdown is documented as an upper content filter, not an authorization boundary.
**Not evidenced here:** Freshness and an MCP-level rollback contract were not evidenced.
**Source:** [GitHub MCP Server](https://github.com/github/github-mcp-server/blob/main/docs/server-configuration.md)

### 2. GitLab MCP Server
**Authority surface:** Projects, repositories, merge requests, work items, CI and related GitLab surfaces.
**Controls evidenced:** OAuth 2.0 dynamic registration; selectable toolsets/tools; GitLab permissions remain upstream; merge requires the observed MR head SHA.
**Material caution:** No general read-only mode was evidenced in the reviewed documentation.
**Not evidenced here:** A general freshness/rollback contract was not evidenced.
**Source:** [GitLab MCP Server](https://docs.gitlab.com/user/model_context_protocol/mcp_server/)

### 3. Microsoft Playwright MCP
**Authority surface:** Browser navigation, clicks, forms, files and browser tooling.
**Controls evidenced:** Filesystem access is restricted to workspace roots by default; file:// is blocked by default; host/origin controls and capability selection exist.
**Material caution:** The project explicitly says these controls are not a security boundary; redirects can bypass origin assumptions.
**Not evidenced here:** No general read-only mode or rollback contract was evidenced.
**Source:** [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp/blob/main/README.md)

### 4. Cloudflare MCP
**Authority surface:** Cloudflare API surfaces including Workers, KV, R2, D1, DNS and Access.
**Controls evidenced:** OAuth/API-token permissions can bound the external principal; endpoint/tool surface can be narrowed.
**Material caution:** Potential authority is broad; no universal MCP-level read-only switch was evidenced.
**Not evidenced here:** Freshness and recovery remain dependent on external systems and policy.
**Source:** [Cloudflare MCP](https://github.com/cloudflare/mcp/blob/main/README.md)

### 5. Sentry MCP
**Authority surface:** Issue/event inspection, Seer, triage and project/team management.
**Controls evidenced:** Skill groups narrow capabilities; read scopes cover inspection while write scopes are required for management actions.
**Material caution:** Capability separation is strong, but effect confirmation is not universal.
**Not evidenced here:** A general recovery contract was not evidenced.
**Source:** [Sentry MCP](https://github.com/getsentry/sentry-mcp/blob/main/packages/mcp-core/README.md)

### 6. Grafana MCP
**Authority surface:** Dashboards, folders, incidents, alerting, datasources and queries.
**Controls evidenced:** --disable-write; category disable flags; granular RBAC actions and resource scopes.
**Material caution:** Raw SQL can still mutate when explicitly re-enabled and datasource credentials permit it.
**Not evidenced here:** MCP-level freshness and rollback guarantees were not evidenced.
**Source:** [Grafana MCP](https://github.com/grafana/mcp-grafana/blob/main/README.md)

### 7. Neon MCP
**Authority surface:** Projects, branches, endpoints, schema, queries, auth and storage.
**Controls evidenced:** OAuth read/write; fixed grant parameters such as readonly, projectId and category; project-scoped mode removes account-level tools.
**Material caution:** Category metadata alone is not a standalone read/write boundary.
**Not evidenced here:** Freshness and recovery were not established by the MCP layer.
**Source:** [Neon MCP](https://github.com/neondatabase/mcp-server-neon)

### 8. Supabase MCP
**Authority surface:** Database, account, debugging, functions, storage and branching.
**Controls evidenced:** read_only=true; project_ref; feature groups; read-only database user for SQL; mutating tools disabled in current read-only mode.
**Material caution:** Without project_ref, authority can span all projects in the organization.
**Not evidenced here:** Recovery is platform-dependent rather than guaranteed by MCP.
**Source:** [Supabase MCP](https://github.com/supabase/mcp)

### 9. MongoDB MCP Server
**Authority surface:** MongoDB data and Atlas administration.
**Controls evidenced:** --readOnly; disabledTools; connection scoping; configurable confirmation-required tools.
**Material caution:** If the client lacks elicitation, documentation says confirmation-required tools execute without confirmation.
**Not evidenced here:** Treat confirmation as unproven unless client capability is verified or write authority is removed.
**Source:** [MongoDB MCP Server](https://github.com/mongodb-js/mongodb-mcp-server)

### 10. Redis MCP Server
**Authority surface:** Redis keys, data structures, streams, pub/sub and related operations.
**Controls evidenced:** Redis ACL is the hard boundary; official guidance shows read-only ACL patterns.
**Material caution:** No universal server-native MCP read-only gate was evidenced.
**Not evidenced here:** Freshness, confirmation and rollback are not established by the reviewed MCP layer.
**Source:** [Redis MCP Server](https://github.com/redis/mcp-redis/blob/main/README.md)

### 11. Kubernetes MCP Server
**Authority surface:** Kubernetes/OpenShift resources, Helm, configuration and optional multi-cluster operation.
**Controls evidenced:** read_only; disable_destructive; toolsets; enabled/disabled tools; denied_resources; confirmation rules; optional pre-execution validation.
**Material caution:** confirmation_fallback defaults to allow if the client lacks elicitation; validation is off by default.
**Not evidenced here:** Fail-closed confirmation requires explicit deny fallback plus bounded RBAC/resource scope.
**Source:** [Kubernetes MCP Server](https://github.com/containers/kubernetes-mcp-server/blob/main/docs/configuration.md)

### 12. Terraform MCP Server
**Authority surface:** Terraform Registry and HCP Terraform/TFE organizations, workspaces, variables and runs.
**Controls evidenced:** Per-user token passthrough for RBAC; organization allowlist; tool/toolset selection; Terraform operations disabled by default unless explicitly enabled.
**Material caution:** Upstream token rights remain decisive.
**Not evidenced here:** A durable approval receipt or rollback contract was not evidenced.
**Source:** [Terraform MCP Server](https://github.com/hashicorp/terraform-mcp-server/blob/main/README.md)

### 13. Azure MCP Server 2.0
**Authority surface:** Azure services exposed through namespaces and commands.
**Controls evidenced:** --read-only; namespace/tool filtering; command metadata for read-only/destructive/idempotent/secret semantics; Azure identity/RBAC upstream.
**Material caution:** The old Azure/azure-mcp repository is archived; current code is in microsoft/mcp.
**Not evidenced here:** Azure RBAC remains the external authority owner; recovery is service-specific.
**Source:** [Azure MCP Server 2.0](https://github.com/microsoft/mcp/blob/main/servers/Azure.Mcp.Server/README.md)

### 14. ClickHouse MCP Server
**Authority surface:** SQL queries against ClickHouse/chDB.
**Controls evidenced:** Read-only by default; writes require explicit enablement; destructive operations require an additional flag; least-privilege DB user is recommended.
**Material caution:** The project says its destructive MCP guard is a best-effort accident guard, not the security boundary.
**Not evidenced here:** Actual authority and recovery depend on ClickHouse grants and platform controls.
**Source:** [ClickHouse MCP Server](https://github.com/ClickHouse/mcp-clickhouse/blob/main/README.md)

### 15. Postgres MCP Pro
**Authority surface:** PostgreSQL SQL, inspection and performance tooling.
**Controls evidenced:** Restricted mode uses read-only transactions and execution limits; SQL is parsed to reject transaction-control bypass attempts.
**Material caution:** Unsafe stored-procedure languages can circumvent protections according to project documentation.
**Not evidenced here:** No separate human-confirmation or rollback contract was evidenced.
**Source:** [Postgres MCP Pro](https://github.com/crystaldba/postgres-mcp/blob/main/README.md)

### 16. Notion MCP Server (self-hosted)
**Authority surface:** Notion pages, databases/data sources and workspace reads/writes.
**Controls evidenced:** Notion integration capabilities can be read-only; page/database access must be shared to the integration; HTTP transport uses bearer auth by default.
**Material caution:** The repository is no longer actively maintained in favor of hosted Notion MCP.
**Not evidenced here:** No separate high-impact confirmation or MCP rollback layer was evidenced.
**Source:** [Notion MCP Server (self-hosted)](https://github.com/makenotion/notion-mcp-server)

### 17. MCP Filesystem reference server
**Authority surface:** Local filesystem read/write/create/move/delete operations.
**Controls evidenced:** Allowed directories/MCP Roots; path validation; destructive annotations; edit_file supports dry-run diff preview.
**Material caution:** The reference repository labels these implementations as educational rather than production-ready.
**Not evidenced here:** No universal read-only or human-confirmation gate was evidenced.
**Source:** [MCP Filesystem reference server](https://github.com/modelcontextprotocol/servers/blob/main/src/filesystem/README.md)

### 18. MCP Git reference server
**Authority surface:** Git status/diff/log plus add, commit, branch and checkout.
**Controls evidenced:** --repository binds operation to a repository path; tools take repo_path; Git history provides target-level recovery primitives.
**Material caution:** This is early-development reference code and includes direct mutation tools.
**Not evidenced here:** Reference-code status and advisories mean it should not be treated as a production security baseline.
**Source:** [MCP Git reference server](https://github.com/modelcontextprotocol/servers/blob/main/src/git/README.md)

### 19. MCP Memory reference server
**Authority surface:** Local persistent knowledge-graph entities, relations and observations.
**Controls evidenced:** Storage path is configurable; annotations identify destructive delete operations; state is local.
**Material caution:** No authentication, read-only mode, separate approval or freshness control was evidenced at the MCP layer.
**Not evidenced here:** No bounded rollback contract was evidenced.
**Source:** [MCP Memory reference server](https://github.com/modelcontextprotocol/servers/blob/main/src/memory/README.md)

### 20. AWS API MCP Server (awslabs)
**Authority surface:** Broad AWS APIs through an AWS API/CLI bridge.
**Controls evidenced:** READ_OPERATIONS_ONLY; REQUIRE_MUTATION_CONSENT; IAM remains the primary security control; risky subprocess-style operations are denylisted.
**Material caution:** Project entered end-of-development on 2026-07-15 with a migration path; read-only API classification can still expose sensitive data or local files.
**Not evidenced here:** Recovery remains service-specific; migration status is time-sensitive and must be rechecked before use.
**Source:** [AWS API MCP Server (awslabs)](https://github.com/awslabs/mcp/blob/main/src/aws-api-mcp-server/README.md)

## Seven-gate synthesis

1. **Authority Budget:** the strongest pattern is removing capabilities before the model can call them: read-only modes, tool filtering, category filtering, and upstream least-privilege permissions.
2. **Object binding:** the strongest controls bind a grant to a project, repository, organization, namespace, resource, allowed root, or exact revision before execution.
3. **Authority owner:** mature implementations usually defer ultimate permission to a real external principal such as IAM, OAuth scopes, RBAC, ACLs or database grants. MCP flags are defense in depth unless they enforce a stricter ceiling.
4. **Evidence Before Effect:** dry-run, revision guards and pre-execution validation exist in some implementations, but a durable expected-versus-observed evidence receipt is uncommon.
5. **Freshness:** this is one of the least consistently explicit gates. Successful authentication does not prove that an approval or target-state observation is still current.
6. **External confirmation:** confirmation is meaningful only when the no-confirmation path is fail-closed. MongoDB and Kubernetes documentation show why client elicitation capability and fallback behavior matter.
7. **Recovery:** recovery is usually a property of the target platform, not a guarantee of the MCP server. History, backups or rollout controls must be tested on the actual workflow.

## What this review does not establish

This review is not customer proof, a ranking, a trust score, a security certification, a penetration test, testing authorization, or legal advice. It does not infer that a missing documented control is absent from the implementation. Time-sensitive project status and configuration defaults should be rechecked against the linked primary source before operational use.

## Source register
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

Reference-server status/security context: [Model Context Protocol reference servers security](https://github.com/modelcontextprotocol/servers/security)
