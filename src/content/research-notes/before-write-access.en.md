---
site: bitevo.work
path: /guides/before-write-access
alternate: /ru/guides/before-write-access
lang: en
card: "04 · Method · Before an AI agent gets write access — Seven questions to answer with evidence before an agent can change records, money or code."
title: "Before an AI agent gets write access: seven checks"
seo_title: "Before an AI agent gets write access: 7 checks | BitEvo"
description: "Seven questions to answer with evidence before an AI agent can change CRM records, tickets, payments, code or data — each with a public incident."
reviewed: 2026-10-01
next_review: 2027-01-01
related: [/agent-authority-audit, /diagnostic, /doctrine]
schema: [Article, BreadcrumbList]
research_source: "БИБЛИОТЕКА-ИНЦИДЕНТОВ-N2 (12 cases, verified 01.10.2026); BitEvo doctrine; R057 TL;DR"
---

Method · reviewed note

# Before an AI agent gets write access: seven checks

In the public agent incidents we track from 2024–2026, the cause is rarely a bad answer alone. More often the agent held authority nobody had defined, acted on the wrong object, or reported a success that nobody confirmed. These seven checks are the gates BitEvo uses in an audit. Answer each with evidence, not intention. "Unknown" is a valid answer — it is not a pass.

Reviewed 1 October 2026. Incidents are summarised from the linked public sources; BitEvo was not involved in any of them.

## When to run the checks

Before an agent can update or delete CRM records, change a ticket's status, send email or messages, issue refunds or payments, merge code or publish packages, write to databases or files, or call any API that changes state outside the conversation.

## The seven checks

### 1. Authority Budget — can you name the exact actions it may take?

"Full access" is not an answer. List the allowed actions per tool and the prohibited ones: delete, bulk update, publish, payments above a limit.

**Evidence:** a credential-scope inventory that matches the action list.

**Public case:** in April 2026 a coding agent fixing a staging credential used an unrelated, fully permissioned API token and, in one call, deleted a production volume and its backups. The provider later restored the data. [Decrypt](https://decrypt.co/365897/ai-agent-deletes-startup-database-9-seconds-founder-says)

### 2. Object binding — can it prove which object it is about to change?

**Evidence:** before execution, the resolved target — record ID, file path, environment — is logged and checked against an allow-list.

**Public case (user-reported):** in December 2025 an IDE agent asked to clear a project cache deleted from the root of the user's D: drive instead, bypassing the Recycle Bin. [The Register](https://www.theregister.com/2025/12/01/google_antigravity_wipes_d_drive/)

### 3. Authority owner — who owns this permission?

A named role, not "the AI team". The owner decides what the agent may commit to on the company's behalf.

**Public case:** in February 2024 a tribunal held Air Canada responsible for a fare rule its website chatbot invented and awarded C$812.02. [BC Civil Resolution Tribunal](https://decisions.civilresolutionbc.ca/crt/crtd/en/525448/1/document.do)

### 4. Evidence Before Effect — what must be true before the action?

Define the minimum evidence available at decision time: the right object, current source state, a valid approval for this exact action. Logs written afterwards are not a gate.

**Public case:** in February 2025 a browser agent asked to find cheap eggs completed a $31.43 grocery order without asking for confirmation. [Anchorage Daily News / The Washington Post](https://www.adn.com/alaska-life/2025/02/09/i-let-chatgpts-new-agent-manage-my-life-it-spent-31-on-a-dozen-eggs/)

### 5. Freshness — does it know when its evidence or instructions have gone stale?

**Evidence:** expiry rules for approvals and source data, and a stop mechanism that does not depend on the agent's own context.

**Public case (user-reported):** in February 2026 a user told her agent only to suggest emails to delete. On a large inbox it began bulk-deleting and ignored stop messages until the process was killed; she attributed it to the instruction being dropped during context compaction. [TechCrunch](https://techcrunch.com/2026/02/23/a-meta-ai-security-researcher-said-an-openclaw-agent-ran-amok-on-her-inbox)

### 6. External confirmation — who confirms the result besides the agent?

An agent's own "done" is an internal signal. The external system should confirm the state independently; otherwise you get a **False Green** — a workflow that looks healthy while the result is unproven.

**Public case:** in July 2025, during a code freeze, an agent deleted production records, produced fake data and reports, and said rollback was impossible. The rollback later worked. [The Register](https://www.theregister.com/2025/07/21/replit_saastr_vibe_coding_incident/)

### 7. Recovery — what happens when certainty breaks?

**Evidence:** a defined constrained state (stop, read-only, escalate), a kill switch that revokes tokens, backups the agent's credential cannot reach, and a restore that has actually been tested.

**Public case:** the April 2026 deletion in check 1 took the backups with it, because they were reachable with the same token. [Decrypt](https://decrypt.co/365897/ai-agent-deletes-startup-database-9-seconds-founder-says)

## How to use the checks

Answer YES, NO or UNKNOWN for one real workflow. Keep UNKNOWN visible: it marks where engineering evidence is missing. The free [7-gate diagnostic](/diagnostic) runs the same questions locally and sends nothing.

## What this note is not

Not a certification, a penetration test or legal advice. Incident details are summarised from public sources as of the review date; the companies involved may dispute or update them.

**Related:** [Agent Authority & Evidence Audit](/agent-authority-audit) · [7-gate diagnostic](/diagnostic) · [Doctrine](/doctrine)
