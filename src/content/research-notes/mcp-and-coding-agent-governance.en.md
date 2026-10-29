---
site: bitevo.work
path: /guides/mcp-and-coding-agent-governance
alternate: /ru/guides/mcp-and-coding-agent-governance
lang: en
card: "08 · Research · MCP and coding-agent governance — Four trust-boundary failure modes, authorization requirements and ten negative tests."
title: "Governing MCP servers and coding agents: authority before execution"
seo_title: "Governing MCP servers and coding agents: authority before execution | BitEvo"
description: "Governance of MCP and coding agents: project hooks, OAuth audience, tool permissions, consent and evidence-bound negative testing."
reviewed: 2026-10-27
next_review: 2027-01-27
related: [/agent-authority-audit, /security-validation, /guides/before-write-access]
schema: [Article, BreadcrumbList]
research_source: "GUIDE_DRAFT_G3_mcp-and-coding-agent-governance_20261027; primary MCP, Check Point, Cline, Invariant and AWS sources; Part IV excluded"
---

Research · engineering guide with source-bound evidence

# MCP and coding-agent governance: permission boundaries that survive tool use

**Reviewed 2026-10-27 · Next review 2027-01-27.** This guide is an architecture and testing checklist for CTOs, platform owners and AppSec teams. It is not proof of any product's security, certification, legal assessment or authorization to test a third party.

An AI coding assistant may interpret a task correctly yet acquire dangerous authority through its project configuration, tools, publishing credentials or remote MCP token. A conversational approval is not the same as a server-side enforcement decision. The practical objective is to make the **subject, action, object, approval and resulting effect** verifiable independently from model output.

## 1. Four trust boundaries

**Project configuration and pre-trust execution.** [Check Point Research, February 25, 2026](https://research.checkpoint.com/2026/rce-and-api-token-exfiltration-through-claude-code-project-files-cve-2025-59536/) documented attacks against Claude Code project-level hooks, MCP consent and an overridden `ANTHROPIC_BASE_URL`, including **CVE-2025-59536** and **CVE-2026-21852**. The researchers state that Anthropic patched the disclosed issues before publication. The lesson is to reject an untrusted checkout's attempt to expand execution or redirect authenticated traffic **before** the user accepts the project.

**CI triage and release authority.** In [Cline's own post-mortem](https://cline.bot/blog/post-mortem-unauthorized-cline-cli-npm), a compromised npm token was used to publish unauthorized **cline@2.3.0 on February 17, 2026**. The added postinstall installed OpenClaw. Cline explicitly reports that **no malicious code was delivered** and its IDE extensions were not affected. This is evidence for isolating issue-reading bots, build jobs and publish credentials; it is **not** evidence that affected customers suffered an exfiltration breach.

**Untrusted tool output crossing into privileged tools.** [Invariant Labs' May 26, 2025 demonstration](https://invariantlabs.ai/blog/mcp-github-vulnerability) showed an injected GitHub Issue redirecting an agent with broad GitHub-MCP rights toward private-repository information. This was a public research demonstration, not a verified incident in BitEvo customer infrastructure. The defensive unit is the tool-to-tool authority boundary, not a ban on reading untrusted issues.

**OAuth gateway and downstream token boundaries.** The [MCP 2026-07-28 Authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) and its [Security Considerations](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization#security-considerations) address protected-resource metadata, token audience, explicit consent, token passthrough and confused-deputy risks. **Authorization is optional for MCP implementations as a whole**; when HTTP authorization is implemented, follow the applicable MCP profile and its normative requirements. Do not generalize those norms to every MCP transport.

## 2. What the protocol actually requires

For an MCP HTTP service using OAuth authorization, examine protected-resource metadata under **RFC 9728** and **resource indicators** under [RFC 8707](https://www.rfc-editor.org/info/rfc8707). MCP clients must request tokens for the intended resource and MCP servers must validate the token's audience. An inbound MCP access token must **not** be passed through unchanged to a downstream API; that API needs a token issued for its own audience. Inspect the [2026-07-28 release notes](https://blog.modelcontextprotocol.io/posts/2026-07-28/) for authorization-server `iss` handling and mix-up protections, and test the installed SDK's exact implementation rather than assuming uniform support.

Configuration options depend on the client and version. [Claude Code's Settings Reference](https://code.claude.com/docs/en/settings-reference) defines managed settings, hooks, sandbox and MCP controls. **A key that merely appears in a JSON file is not evidence of enforcement**: confirm version support, effective precedence, and blocked behavior in a controlled negative test.

## 3. Ten controls to test

These are **ten BitEvo review questions**, not ten official protocol requirements.

1. **Managed policy precedence:** can a repo-local settings file broaden permissions granted by the organization?
2. **Project hooks:** do untrusted hooks execute before the user explicitly trusts a checkout?
3. **MCP server admission:** can an unapproved `.mcp.json` silently attach a privileged server?
4. **Permission bypass:** is an unsafe skip-approval mode denied on managed developer hosts?
5. **Skills and instructions:** can a downloaded skill or nested instruction file request shell actions beyond the user's task?
6. **Sandbox failure:** does the agent stop when containment is unavailable, rather than silently proceeding unconfined?
7. **Filesystem credentials:** does the actual runtime deny access to cloud/SSH secrets it does not require?
8. **Network egress:** can project configuration change the API endpoint or send bearer tokens to an unapproved host?
9. **Token audience:** does an MCP gateway reject wrong-audience tokens and refuse upstream token passthrough?
10. **Effect and recovery:** is each consequential tool call tied to object ID, bounded approval, receipt, independent readback and a no-blind-retry path?

For each test, keep the proposed change in a **synthetic workspace or isolated staging environment**. Capture policy input, expected DENY/HOLD, the actual transport and side effect, and the independent verifier result. Avoid connecting any real production account, publish token, customer data or private control-plane.

## 4. A bounded evidence report

A useful conclusion is a matrix of **expected / observed / not established**. Examples: a local repo configuration requested broader shell access but the managed policy rejected it; a gateway returned an authorization error but the downstream system was not read independently; a nominally successful publish event lacks a signed release-provenance receipt. A negative test passed under one configuration does **not** establish all versions or future providers as safe.

Source context: [OWASP Top 10 for Agentic Applications 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) and the [AWS Amazon Q Developer extension bulletin](https://aws.amazon.com/security/security-bulletins/AWS-2025-015/) provide adjacent patterns. AWS specifically says an injected snippet in its affected extension **did not execute** because of a syntax error; do not turn that into an established customer compromise.

Related: [Agent authority audit](/agent-authority-audit), [Control validation](/control-validation), [Before write access](/guides/before-write-access).
