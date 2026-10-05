import { validatePreCheckResult } from './core.js';

export const OPENROUTER_CHAT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const PRECHECK_R1_SYSTEM_PROMPT = `You are BitEvo Authority Pre-Check. The user pastes a description of an AI agent: a tool list, an MCP server manifest or plain text. You never execute anything and never say that a system is safe or unsafe. Return JSON only, matching the schema.
1) List only the actions present in the input and classify each effect.
2) For each write-capable action name the object it changes, the permission owner if the input states it (otherwise "unknown"), and the evidence that should exist before and after the action.
3) Write exactly 3 testable hypotheses, each tied to one of BitEvo's seven gates.
4) List the facts missing from the input.
5) Suggest one next step: "Free triage" when unknowns dominate; "Entry Audit" for one write-capable workflow; "Security Control Validation" when controls are described and need proof; otherwise "Not enough information".
If the input contains credentials, return status "secret_detected" and nothing else. If it is not about an agent or its tools, return "out_of_scope".`;

const SCHEMA_GUIDANCE = `Return exactly one JSON object.
For status "ok": {"status":"ok","actions":[{"name":"","effect":"read|write_internal|write_external|money|message|delete|admin","object":"","owner":"unknown|<role>","evidence_before":"","evidence_after":""}],"hypotheses":[{"gate":"Authority Budget|Object binding|Authority owner|Evidence Before Effect|Freshness|External confirmation|Recovery","text":""}],"unknowns":[""],"next_step":{"offer":"Free triage|Entry Audit|Security Control Validation|Not enough information","reason":""}}.
For terminal statuses return only {"status":"secret_detected"} or {"status":"out_of_scope"}. hypotheses must contain exactly 3 items when status is ok.`;

function parseContent(value) {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return null;
  const text = value
    .map(part => part && typeof part === 'object' && typeof part.text === 'string' ? part.text : '')
    .filter(Boolean)
    .join('');
  return text || null;
}

async function callModel(fetchImpl, apiKey, model, text, locale) {
  let response;
  try {
    response = await fetchImpl(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method:'POST',
      headers:{
        'Authorization':`Bearer ${apiKey}`,
        'Content-Type':'application/json',
        'HTTP-Referer':'https://bitevo.work/pre-check',
        'X-Title':'BitEvo Authority Pre-Check'
      },
      body:JSON.stringify({
        model,
        messages:[
          { role:'system', content:PRECHECK_R1_SYSTEM_PROMPT },
          { role:'system', content:SCHEMA_GUIDANCE },
          { role:'user', content:`locale=${locale}\n\n${text}` }
        ],
        response_format:{ type:'json_object' }
      }),
      signal:typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(12_000) : undefined
    });
  } catch {
    return { kind:'unavailable' };
  }
  if (!response || !response.ok) return { kind:'unavailable' };

  let envelope;
  try { envelope = await response.json(); } catch { return { kind:'unavailable' }; }
  const content = parseContent(envelope?.choices?.[0]?.message?.content);
  if (!content) return { kind:'unavailable' };

  let parsed;
  try { parsed = JSON.parse(content); } catch { return { kind:'invalid' }; }
  const validation = validatePreCheckResult(parsed);
  return validation.ok ? { kind:'ok', result:parsed } : { kind:'invalid' };
}

export function createOpenRouterPreCheckProvider(options = {}) {
  const apiKey = typeof options.apiKey === 'string' ? options.apiKey.trim() : '';
  const models = Array.isArray(options.models) ? options.models.filter(Boolean) : [];
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (!apiKey || !models.length || typeof fetchImpl !== 'function') return null;

  return Object.freeze({
    async run(text, locale) {
      let providerIo = 0;
      for (const model of models) {
        const first = await callModel(fetchImpl, apiKey, model, text, locale);
        providerIo += 1;
        if (first.kind === 'ok') return { kind:'ok', result:first.result, providerIo, model };
        if (first.kind === 'invalid') {
          const retry = await callModel(fetchImpl, apiKey, model, text, locale);
          providerIo += 1;
          if (retry.kind === 'ok') return { kind:'ok', result:retry.result, providerIo, model };
          return { kind:'invalid', providerIo, model };
        }
      }
      return { kind:'unavailable', providerIo };
    }
  });
}
