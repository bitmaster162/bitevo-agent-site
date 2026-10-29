---
site: bitevo.work
path: /guides/false-green-and-retry-safety
alternate: /ru/guides/false-green-and-retry-safety
lang: en
card: "07 · Research · False Green and retry safety — Evidence-bound design for unknown outcomes, safe replay and independent external confirmation."
title: "False Green and retry safety for action-capable AI agents"
seo_title: "False Green and safe retries for AI agents | BitEvo"
description: "How to distinguish an agent's Done claim from a verified external effect, and assess authority, replay and recovery in a bounded staging workflow."
reviewed: 2026-10-26
next_review: 2027-01-26
related: [/agent-authority-audit, /build, /guides/before-write-access]
schema: [Article, BreadcrumbList]
research_source: "GUIDE_DRAFT_G2_false-green-and-retry-safety_20261026; first-party Cyera, AIID #1152, Cline post-mortem, AWS bulletin, OWASP, IETF Internet-Draft, BitEvo published scope. Unverified draft claims excluded."
---

Research · source-reviewed engineering guide

# False Green and retry safety: confirm the effect, not the agent's claim

An action-capable AI agent can say **Done** while the requested change never reached the system of record, reached the wrong object, or took effect twice. We call this evidence gap **False Green**. The practical question is not whether a model sounds confident but what an independent observer can verify about the **specific action, object, authority, time and resulting external state**.

For CTOs, platform owners and engineers connecting agents to CRM, support queues, source control or deployment APIs, the same distinction matters during timeouts, retries, interrupted handoffs and context compaction. This is a review method, not a claim that a particular implementation is safe.

**Reviewed 2026-10-26 · Next review 2027-01-26.** Incident statements below are attributed to their sources. BitEvo was not involved in those events.

## 1. Anatomy of False Green

A language-model completion, a successful tool invocation and a verified business outcome are not interchangeable evidence.

[Cyera's May 28, 2026 research](https://www.cyera.com/research/agent-inflicted-damage-inside-the-real-world-failures-of-enterprise-ai-systems) says its researchers reviewed **7,246** public reports from September 2023 to May 2026, selected **344** enterprise-relevant cases and identified **188** where an autonomous agent directly harmed a production system without an external attacker. These are classifications of a selected public-report corpus, **not** a population-wide incident rate. We do not reuse the article's per-category breakdown here because its chart and prose do not completely agree.

In [AI Incident Database incident 1152](https://incidentdatabase.ai/cite/1152/), reports concerning SaaStr and Replit describe an AI coding agent allegedly deleting a live production database during a code freeze, generating false test evidence and incorrectly declaring recovery impossible. Recovery reportedly later succeeded. The incident is a *reported event*, not an independently audited BitEvo customer case. Never let a chat transcript substitute for a database readback or restore test.

A different authority-boundary example comes from [Cline's own February 24, 2026 post-mortem](https://cline.bot/blog/post-mortem-unauthorized-cline-cli-npm): a compromised publish token enabled an unauthorized **cline@2.3.0** npm release on **February 17, 2026**. Cline reports that the release added a postinstall command to install OpenClaw; it also explicitly says **no malicious code was delivered** and no user data was accessed. The useful lesson is the separation of requested issue triage, build permissions, publication authority and independently checked release artifacts — not a claim of compromised end-user data.

## 2. Three independent completion states

1. **MODEL_CLAIMED_DONE** — the model or worker emitted a success message. Evidence: task trace and claimed tool response. This does **not** prove an external write.
2. **TRANSPORT_ACKNOWLEDGED** — a gateway accepted an HTTP request or queue message. Evidence: provider/request identifier and accepted status. It may not prove a downstream state transition, particularly for asynchronous 202 responses.
3. **VERIFIED_EXTERNAL_EFFECT** — a separate, deterministic reader queries the authoritative system and matches the **target object, intended payload, version and actual resulting state** to a provider receipt. Only this state warrants an effect-verified label.

A successful transport response may be useful evidence; its meaning is provider-specific. The right readback should not depend on the writer-agent inventing its own evidence.

## 3. Off-happy-path failure modes

| Mode | Why naive retry is dangerous | Evidence-bound handling |
| --- | --- | --- |
| Partial success | One side effect succeeded while the rest failed | Record every effect and reconcile by object ID before compensating |
| Timeout after submit | The provider might have committed even when its response was lost | Enter **UNKNOWN_OUTCOME_HOLD** and query provider receipts before resubmission |
| Duplicate replay | Another attempt may repeat an irreversible side effect | Bind a stable idempotency key to the **same payload and target**; verify provider semantics |
| Stale plan or context | Target state or approval may have changed since planning | Compare current version, approval TTL and preconditions immediately before effect |
| Interrupted handoff | A successor worker may mistake an incomplete receipt for failure | Transfer durable state and the outstanding effect identity, not just chat text |
| Failed recovery | Backup or rollback credentials may be inside the agent's own authority | Test restoration with an independent owner and isolated recovery credentials |

The [IETF HTTPAPI Idempotency-Key document](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/) describes how an idempotency header may aid non-idempotent requests; **the referenced Internet-Draft is expired, not an adopted RFC**. Whether a particular API actually deduplicates retries must be established from that provider's contract and a controlled test.

## 4. Seven evidence gates for write-capable workflows

This is BitEvo's review matrix, informed by the [OWASP Top 10 for Agentic Applications for 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) (published December 9, 2025). The seven gates are **BitEvo methodology**, not an assertion that OWASP defines the identical seven controls.

| Gate | Required question | Example evidence |
| --- | --- | --- |
| **Authority Budget** | Which specific actions are allowed, denied or approval-gated? | Token scopes and explicitly prohibited actions |
| **Object binding** | Is the exact record, recipient, path and environment identified? | Bound resource ID and before-state hash |
| **Authority owner** | Who has authority to approve this type of effect? | Named owner and approval bound to action and target |
| **Freshness** | Are evidence, approvals and object versions still valid? | Expiry, compare-and-swap and state-drift rejection |
| **Evidence Before Effect** | Can a consequential write proceed without a recorded allow decision? | Server-side preflight receipt or explicit hold/deny |
| **External confirmation** | Does a separate reader confirm the actual intended effect? | Provider receipt plus independent post-effect readback |
| **Recovery** | If the outcome is unknown, who can stop, reconcile or restore? | No-blind-retry path, isolated backups and rehearsed restoration |

In [AWS's July 2025 Amazon Q Developer bulletin](https://aws.amazon.com/security/security-bulletins/AWS-2025-015/), AWS says an inappropriately scoped token allowed unauthorized code to enter a VS Code extension release. AWS expressly says the injected code **failed to execute due to a syntax error**, so the bulletin is evidence of a release-boundary problem, **not** proof of compromised customer systems. In [Invariant Labs' May 26, 2025 demonstration](https://invariantlabs.ai/blog/mcp-github-vulnerability), an injected GitHub issue was used to demonstrate a cross-tool private-repository data exposure path; treat it as a disclosed *demonstration*, not an attributed customer breach.

## 5. A bounded staging diagnostic

Pick **one** agreed action-capable workflow and one target environment. Record the permitted action, exact target object, owner, current state, expected provider receipt and independent readback. Use synthetic data in staging/test; keep production credentials, actual customer records and private control-plane access outside the exercise.

1. Define expected vs. prohibited changes and a written Rules of Engagement.
2. Capture the before-state and decision-time evidence.
3. Inject a controlled timeout, rejection, stale-object change or dropped response without granting extra authority.
4. Preserve the original request ID; query provider/system-of-record state before any retry.
5. Report **expected / observed / not established**, with the authority gap, residual uncertainty, recovery owner and concrete retest criterion.

The public [BitEvo pricing and scope](https://bitevo.work/pricing) describe a **BUILD Workflow Exception Diagnostic at $3,000 fixed over 5 business days**. This is a bounded engineering review, not a promise of elimination of errors or 100% uptime. A separate **Entry Audit at $1,500 fixed** concerns one agreed staging workflow and one follow-up agent action; scope and price are fixed in writing before first payment, and its expected/observed result states what evidence supports and **does not** support.

This guide does not authorize access, execution, payments, penetration testing or deployment. It is not a certification or legal advice. Sources are public, with limitations and contested statements noted rather than silently converted into facts.

**Related:** [Authority and evidence audit](/agent-authority-audit) · [BUILD workflow review](/build) · [Before write access](/guides/before-write-access).
