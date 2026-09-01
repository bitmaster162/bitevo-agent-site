import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';

const DEFAULT_POLICY_URL = new URL('../docs/SITE_AGENT_POLICY_PACK_R1.json', import.meta.url);

export async function loadPolicy(url = DEFAULT_POLICY_URL) {
  return JSON.parse(await readFile(url, 'utf8'));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function hashEnvelope(envelope) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(envelope))).digest('hex');
}

function isMissing(value, field) {
  if (value === undefined || value === null || value === '') return true;
  if (/(confirmed|consent)$/i.test(field) && value !== true) return true;
  return false;
}

function allText(fields = {}) {
  return Object.values(fields)
    .filter((value) => typeof value === 'string')
    .join('\n')
    .toLowerCase();
}

export function evaluateEnvelope(envelope, policy) {
  const receipt = {
    schema_version: 'SITE_AGENT_ADAPTER_RECEIPT_V1',
    lane: envelope?.lane ?? null,
    intent: envelope?.intent ?? null,
    decision: 'BLOCKED_POLICY',
    release_level: null,
    missing_fields: [],
    sensitive_matches: [],
    blocked_claims: [],
    blocked_effects: [],
    envelope_sha256: hashEnvelope(envelope ?? {}),
    write_allowed: false,
    notes: []
  };

  if (!envelope || envelope.schema_version !== 'SITE_AGENT_ENVELOPE_V1') {
    receipt.notes.push('Unsupported or missing envelope schema.');
    return receipt;
  }

  const lane = policy?.lanes?.[envelope.lane];
  if (!lane) {
    receipt.notes.push('Unknown lane.');
    return receipt;
  }
  receipt.release_level = lane.release_level;

  if (!lane.allowed_intents?.includes(envelope.intent)) {
    receipt.notes.push('Intent is not allowed for this lane.');
    return receipt;
  }

  const required = lane.required_fields_by_intent?.[envelope.intent] ?? lane.required_fields ?? [];
  receipt.missing_fields = required.filter((field) => isMissing(envelope.fields?.[field], field));

  const text = allText(envelope.fields);
  const sensitiveTerms = [...(policy.global?.sensitive_terms ?? []), ...(lane.extra_sensitive_terms ?? [])];
  receipt.sensitive_matches = [...new Set(sensitiveTerms.filter((term) => text.includes(String(term).toLowerCase())))];

  const proposedClaims = envelope.proposed_claims ?? [];
  receipt.blocked_claims = proposedClaims.filter((claim) => lane.blocked_claims?.includes(claim));

  const requestedEffects = envelope.requested_effects ?? [];
  const globallyForbidden = new Set(policy.global?.forbidden_effects ?? []);
  for (const effect of requestedEffects) {
    if (effect === 'human_handoff') {
      const verified = lane.human_handoff?.verified === true;
      const releaseAllows = String(lane.release_level).startsWith('L1');
      if (!verified || !releaseAllows) receipt.blocked_effects.push(effect);
      continue;
    }
    if (globallyForbidden.has(effect) || effect) receipt.blocked_effects.push(effect);
  }

  if (lane.human_handoff?.role_label_required) {
    if (envelope.handoff_role !== lane.human_handoff.role_label_required) {
      receipt.blocked_effects.push('handoff_role_mismatch');
    }
  }

  if (envelope.state === 'CONVERTED' && policy.global?.conversion_requires_evidence && !(envelope.evidence_refs?.length)) {
    receipt.blocked_effects.push('conversion_without_evidence');
  }

  if (receipt.sensitive_matches.length) {
    receipt.decision = 'BLOCKED_SENSITIVE_INPUT';
    receipt.notes.push('Sensitive input must be removed before continuing.');
    return receipt;
  }
  if (receipt.blocked_claims.length || receipt.blocked_effects.length) {
    receipt.decision = 'BLOCKED_POLICY';
    receipt.notes.push('A proposed claim or effect exceeds current lane authority.');
    return receipt;
  }
  if (receipt.missing_fields.length) {
    receipt.decision = 'NEEDS_INFO';
    receipt.notes.push('Required facts are missing.');
    return receipt;
  }

  const canHandoff = lane.human_handoff?.verified === true && String(lane.release_level).startsWith('L1');
  receipt.decision = canHandoff ? 'READY_FOR_HUMAN_HANDOFF' : 'READY_FOR_HUMAN_REVIEW';
  receipt.notes.push('R1 shared adapter is dry-run only; no storage write is authorized.');
  return receipt;
}

export function buildOwnerCopilotOutput(envelope, receipt) {
  const blocked = ['BLOCKED_POLICY', 'BLOCKED_SENSITIVE_INPUT'].includes(receipt.decision);
  const needs = receipt.missing_fields ?? [];
  return {
    schema_version: 'OWNER_COPILOT_OUTPUT_V1',
    lane: receipt.lane,
    intent: receipt.intent,
    classification: receipt.decision,
    missing_information: needs,
    risk_flags: [
      ...receipt.sensitive_matches.map((x) => `sensitive:${x}`),
      ...receipt.blocked_claims.map((x) => `claim:${x}`),
      ...receipt.blocked_effects.map((x) => `effect:${x}`)
    ],
    staff_summary: blocked
      ? 'Request is blocked by the current policy and must not be actioned until the flagged input/claim/effect is corrected.'
      : needs.length
        ? `Request needs ${needs.length} required field(s) before human review.`
        : `Qualified ${receipt.lane}/${receipt.intent} request is ready for human review under the current lane policy.`,
    reply_draft: blocked
      ? 'Please remove the blocked/sensitive information and resend only the practical details needed for this request.'
      : needs.length
        ? `Thanks. Before we can review this properly, please add: ${needs.join(', ')}.`
        : 'Thanks. We have the initial details. A person will review the request and confirm the current options and terms.',
    suggested_next_action: blocked
      ? 'Human reviews the policy flags; no external action.'
      : needs.length
        ? 'Human requests the missing information.'
        : 'Human reviews the brief and confirms current facts/terms before any action.',
    execute_authority: false,
    write_authority: false,
    source_envelope_sha256: receipt.envelope_sha256,
    source_session_id: envelope?.session_id ?? null
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const policy = await loadPolicy();
  const input = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const receipt = evaluateEnvelope(input, policy);
  console.log(JSON.stringify({ receipt, owner_copilot: buildOwnerCopilotOutput(input, receipt) }, null, 2));
}
