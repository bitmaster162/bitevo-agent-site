# bitevo-authority MCP server

Read-only BitEvo MCP server for authority/evidence scoping.

This source exposes exactly three tools:

- `diagnostic` — the seven BitEvo gates, with `YES / NO / UNKNOWN` answers.
- `hypothesis_builder` — the same deterministic NO/UNKNOWN hypothesis rows used by bitevo.work.
- `pre_check` — the canonical BitEvo Authority Pre-Check endpoint.

It does not expose write, booking, payment, deployment, messaging, file-mutation, credential-management or test-execution tools.

## Boundary

`diagnostic` and `hypothesis_builder` are local deterministic computations. They do not make network requests.

`pre_check` sends the provided non-secret text only to:

`https://bitevo.work/api/pre-check`

The MCP server does not call OpenRouter directly and does not contain an OpenRouter API key or model list. The website API owns its runtime state and rate limits. If the website Pre-Check runtime is disabled, this tool returns that unavailable state instead of bypassing it.

The MCP source rejects the same supported credential patterns locally before any `pre_check` network call.

Outputs are for scoping. They are not audit findings, safety verdicts, certifications or testing authorization.

## Install for local development

From this directory:

```bash
npm ci
npm test
```

Run over stdio:

```bash
npm start
```

The stdio protocol owns stdout. Server diagnostics go to stderr.

## Host configuration example

After cloning this repository, point an MCP host at the local server entrypoint.

```json
{
  "mcpServers": {
    "bitevo-authority": {
      "command": "node",
      "args": [
        "C:/path/to/bitevo-agent-site/mcp/bitevo-authority/src/index.mjs"
      ]
    }
  }
}
```

Use an absolute path appropriate to the machine running the MCP host.

## Tool examples

### diagnostic

```json
{
  "action": "YES",
  "object": "YES",
  "owner": "YES",
  "evidence": "UNKNOWN",
  "freshness": "UNKNOWN",
  "confirm": "NO",
  "recovery": "UNKNOWN"
}
```

The output preserves all seven answers and identifies NO/UNKNOWN decision gates. It does not calculate a trust or safety score.

### hypothesis_builder

```json
{
  "action": "YES",
  "object": "YES",
  "owner": "YES",
  "evidence": "UNKNOWN",
  "freshness": "UNKNOWN",
  "confirm": "NO",
  "recovery": "UNKNOWN",
  "locale": "en"
}
```

The output is an editable scoping draft derived from the open gates. `locale` may be `en` or `ru`.

### pre_check

```json
{
  "text": "Support agent with tool issue_refund for the current staging ticket.",
  "locale": "en"
}
```

Maximum input is 8,000 characters. Supported secret patterns are rejected locally before network I/O.

The canonical website endpoint currently controls whether Pre-Check is active. This package does not override that control.

## Registry publication

This repository round does **not** publish an npm package or an MCP Registry listing.

Registry publication is a separate operation because the official registry requires a real package identifier and ownership marker that match the chosen server namespace. Those package/namespace ownership facts must be confirmed before a registry manifest is published.

No placeholder registry package is advertised here.
