---
site: bitevo.work
path: /guides/agent-approval-audit-trail
alternate: /ru/guides/agent-approval-audit-trail
lang: en
card: "09 · Engineering · AI agent approval and audit trails — Policy enforcement and evidence beyond a green status."
title: "AI agent approvals and audit trails: verify the effect"
seo_title: "AI Agent Approvals and Audit Trails | BitEvo"
description: "Scope MCP permissions, bind human approvals to exact tool calls, log decisions and confirm external effects with independent evidence."
reviewed: 2026-11-19
next_review: 2027-02-19
related: [/guides/before-write-access, /guides/mcp-and-coding-agent-governance, /agent-authority-audit]
schema: [Article, BreadcrumbList]
research_source: "03_RESEARCH_MODELS R702/R703 informed the topic; factual guidance cross-checked with OWASP, MCP authorization and NIST AI RMF official sources. Editorial draft."
---

Research · practical engineering guide · editorial draft, not published

# AI agent approvals and audit trails: from tool permission to a verified effect

**Reviewed 2026-11-19 · Next review 2027-02-19.** For operators, engineering leads and security reviewers. This is a methodology, not evidence that a particular deployment is safe, not a certification and not permission to test a third party.

The operational question is not whether an AI agent says it completed a task. It is whether the **right identity performed the exact authorised action on the right object**, and whether a separate observer can prove what actually changed. The [OWASP AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html) recommends least-privilege tools, authorization middleware outside model context, approval for high-impact actions and audit trails. This guide turns those principles into a bounded testing procedure. It supplements, rather than duplicates, our [MCP and coding-agent governance guide](/guides/mcp-and-coding-agent-governance).

## 1. Map the authority chain before connecting a tool

Draw the entire execution path: **human or service identity → agent → tool or MCP server → downstream API → target object → receipt**. For every link record who authenticates, which resource can be read or written, which component enforces scope, and what happens if the check fails. A natural-language tool description such as "read only" does not itself enforce read-only access.

MCP's [Authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) defines a profile for HTTP-based transports. Authorization is optional across MCP implementations generally; local STDIO configurations are different. For HTTP OAuth flows, the [MCP security considerations](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/authorization/security-considerations.mdx) require the server to validate token audience and forbid forwarding the client's inbound MCP token unchanged to upstream APIs. Test the actual token audience and downstream credentials rather than assuming that a connected tool inherits safe permissions.

| Capability requested by the agent | Suggested starting boundary | Evidence to collect |
|---|---|---|
| Read approved public material | Allow narrowly scoped reads | Exact resource and response identity |
| Create a local draft | Allow only in a controlled workspace | Draft artifact or diff; no external write |
| Send an email or change a customer record | Hold for action-specific human approval | Recipient or object, canonical payload, approver, target receipt |
| Publish, merge or alter production settings | Separate review and release authority | Approved diff, CI result, release decision, independent target readback |
| Delete data, change credentials or transfer funds | Deny pending a separately authorised process | Documented owner, test of enforcement, reconciliation plan |

These are **proposed design defaults**, not official risk thresholds or guarantees. Adjust permissions for the data, deployment and consequences involved. The voluntary [NIST AI RMF Playbook](https://airc.nist.gov/airmf-resources/playbook/) organises suggestions under Govern, Map, Measure and Manage, and explicitly does not prescribe a mandatory universal checklist.

## 2. Human approval must bind to the precise request

A confirmation dialog is a user interface, not proof of an enforced permission. OWASP recommends checking that approval belongs to the current actor and **exact** tool call, and consuming the grant atomically so it cannot be reused during concurrent requests. If the target or arguments change, approval must be reconsidered. [OWASP guidance](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html)

1. **Preview:** present the execution identity, tool, target object, meaningful arguments, destination, expected side effect and reversibility.
2. **Decide:** a designated owner approves or denies the canonical request, not a general statement such as "let the agent handle it". Record an approval identifier, scope, expiry and policy version outside agent-editable context.
3. **Recheck:** immediately before calling the tool, the executor verifies the current identity, argument integrity, resource scope and unused approval. A missing, expired or modified grant produces HOLD or DENY.
4. **Attempt:** associate execution with a unique attempt or idempotency key when supported by the destination. Record transport errors and uncertainty without assuming that an exception means no side effect occurred.
5. **Read back:** independently inspect the destination with appropriately scoped read permissions. Mark confirmed effects separately from accepted requests.

If the person approved sending a message to recipient A, a changed recipient B, modified attachment or second send requires a new decision. Likewise, a merged pull request cannot be made "unmerged" by a follow-up commit; a repair is not a reliable rollback.

## 3. Build an audit trail that explains what happened

Emit structured events from an executor or gateway that the model cannot silently rewrite. A useful sequence is **REQUESTED → POLICY_CHECKED → APPROVED or DENIED → ATTEMPTED → RECEIPT → READBACK**. These are recommended event names, not MCP protocol obligations. OWASP advises recording tool calls, decisions and outcomes without storing secrets or sensitive plaintext in logs. [OWASP guidance](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html)

For each consequential call, preserve:
- Correlation ID, attempt ID and the human or service identity executing the action.
- Tool/MCP server, effective permissions and policy revision, **never the token value**.
- Canonical target identifier and privacy-preserving argument digest or approved representation.
- Authorization result, approver reference where applicable and approval lifetime.
- Attempt time, transport result, destination receipt and error category.
- Independent verification method, observed target state and remaining unknowns.
- Log access, retention and integrity provisions appropriate to the organisation.

Do not equate a tool message saying "success" with proof that a customer record changed or an email was delivered. If the evidence is missing, state **NOT ESTABLISHED**. Logging infrastructure, models and policies may each fail independently; compare against the destination system where possible.

## 4. Run negative tests before granting consequential access

Use a synthetic account, dummy records and an isolated workspace, never unapproved customer or production data. The [OWASP DevSecOps guidance for agent and MCP security](https://owasp.github.io/DevSecOpsGuideline/2-Process/2-2-Develop/2-2-5-AI-Agent-and-MCP-Security/) also recommends narrowly authorised tools, exact-action approval and audit evidence.

1. Request a write without approval: expect DENY and inspect the destination for absence of a change.
2. Approve a synthetic object, then substitute another object or changed parameters: expect HOLD or DENY.
3. Reuse an already consumed approval, including concurrent calls: expect no second authorised effect.
4. Present a valid token with the wrong MCP audience: expect rejection before downstream execution.
5. Simulate a timeout after a write attempt: reconcile target state before considering any retry.

Each record must distinguish **expected**, **observed** and **unobserved** behaviour. PASS applies only to the exact configuration and test that was run. FAIL requires evidence of the divergence. UNKNOWN means evidence was insufficient; it is not an implied PASS. Version, policy, fixtures, request, receipt and verifier output should be retained for reproducibility.

## 5. Keep retries and release decisions honest

A permission accepted, an API request accepted and an independently confirmed effect are different claims. A timeout after a side effect may leave the outcome uncertain. Blind retrying can duplicate effects unless the destination supports appropriate idempotency or reconciliation. A compensating action can reduce damage but is a new action with its own authority and risk.

A decision memo should state **the exact tested boundary, observed outcomes, missing readbacks, untested bypass paths, remaining risk and approving owner**. Green CI, a completed model answer and a consent button do not demonstrate a safe production workflow. If authority or evidence is insufficient, retain the HOLD, correct the control, and retest without silently broadening the grant.

## Sources

- **[S1](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html)** OWASP, *AI Agent Security Cheat Sheet* — permissions, scoped approval, audit events and negative tests.
- **[S2](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)** Model Context Protocol, *Authorization* — scope and transport qualification.
- **[S3](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/authorization/security-considerations.mdx)** MCP, *Authorization Security Considerations* — token audience and downstream token separation.
- **[S4](https://airc.nist.gov/airmf-resources/playbook/)** NIST, *AI RMF Playbook* — voluntary, adaptable risk management.
- **[S5](https://owasp.github.io/DevSecOpsGuideline/2-Process/2-2-Develop/2-2-5-AI-Agent-and-MCP-Security/)** OWASP, *AI Agent and MCP Security* — practical tool/approval/logging guidance.

**Publication status: DRAFT.** No invented incidents, customer case studies, performance guarantees or assertions about BitEvo live infrastructure.