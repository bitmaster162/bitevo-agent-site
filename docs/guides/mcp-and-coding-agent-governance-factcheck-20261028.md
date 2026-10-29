# Guide #4 — Source-bound fact-check register (2026-10-28)

Original [Google Doc](https://docs.google.com/document/d/17KWSbmUKQ9yodGsyKu2N6KurmcZOgMyTUn8-rXpVBI0/edit): Parts I–III reviewed; Part IV UNVERIFIED excluded.

| Claim | Primary source | Verdict |
| --- | --- | --- |
| Project hooks, MCP consent and ANTHROPIC_BASE_URL exploits, CVE-2025-59536, CVE-2026-21852 | [Check Point Research, 25 Feb 2026](https://research.checkpoint.com/2026/rce-and-api-token-exfiltration-through-claude-code-project-files-cve-2025-59536/) | RETAIN with "patched before disclosure"; no assertion of current unpatched default |
| Claude Code managed settings, hooks, sandbox and MCP config | [Anthropic Settings Reference](https://code.claude.com/docs/en/settings-reference) | RETAIN as documented config, not a proof of enforcement; negative-test on installed version |
| Unauthorized npm publish cline@2.3.0, Feb 17 2026 | [Cline original postmortem](https://cline.bot/blog/post-mortem-unauthorized-cline-cli-npm) | RETAIN; Cline states no malicious code delivered, no impacted IDE extensions |
| GitHub MCP issue injection | [Invariant Labs, May 26 2025](https://invariantlabs.ai/blog/mcp-github-vulnerability) | RETAIN as researcher demonstration only, not customer breach |
| AWS unauthorized extension code | [AWS Security Bulletin AWS-2025-015](https://aws.amazon.com/security/security-bulletins/AWS-2025-015/) | RETAIN limited: AWS explicitly says injected code did not execute |
| MCP authorization universally mandatory for HTTP | [MCP 2026-07-28 Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) | CORRECTED: authorization optional overall, normative only if implementing HTTP OAuth profile |
| RFC 8707 audience/resource, token passthrough forbidden, token validation | [MCP security considerations](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations) and [RFC8707](https://www.rfc-editor.org/info/rfc8707) | RETAIN scoped to applicable MCP authorization flows |
| Authorization server iss mix-up protection | [MCP specification release July 28 2026](https://blog.modelcontextprotocol.io/posts/2026-07-28/) | RETAIN as revision-specific, SDK support must be tested |
| 10 negative controls | Draft methodological framework | RETAIN as proposed BitEvo engineering review, not certification |
| AWS AgentCore pricing, AWS Kiro causal outage, unverified financial/customer cases | No conclusive primary independent verification | OMIT |
| Source Part IV | Explicitly marked unverified | EXCLUDED entirely |

No invented engagement claims or guarantees. Dates on both articles: Reviewed 2026-10-27 / Next review 2027-01-27. Staging-only synthetic tests proposed; no production access, keys or mutations.
