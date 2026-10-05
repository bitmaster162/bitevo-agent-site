import assert from 'node:assert/strict';

import { buildDiagnostic, DIAGNOSTIC_QUESTIONS } from '../src/diagnostic.mjs';
import { buildHypothesis, HYPOTHESIS_ORDER } from '../src/hypothesis-builder.mjs';
import { BITEVO_PRECHECK_ENDPOINT, callPreCheck, detectPreCheckSecret } from '../src/pre-check.mjs';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks += 1; };

const sampleAnswers = {
  action:'YES',
  object:'YES',
  owner:'YES',
  evidence:'UNKNOWN',
  freshness:'UNKNOWN',
  confirm:'NO',
  recovery:'UNKNOWN'
};

equal(DIAGNOSTIC_QUESTIONS.length, 7, 'diagnostic has seven gates');
equal(HYPOTHESIS_ORDER, ['action','object','owner','evidence','freshness','confirm','recovery'], 'hypothesis gate order exact');

const diagnostic = buildDiagnostic(sampleAnswers, '2026-10-05T00:00:00.000Z');
equal(diagnostic.explicit_yes, 3, 'sample explicit YES count');
equal(diagnostic.unresolved_count, 4, 'sample unresolved count');
equal(diagnostic.unresolved.map(item => [item.gate,item.answer]), [
  ['Evidence Before Effect','UNKNOWN'],
  ['Freshness','UNKNOWN'],
  ['External confirmation','NO'],
  ['Recovery','UNKNOWN']
], 'sample unresolved gates exact');
check(!diagnostic.brief.match(/trust score:\s*\d/i), 'diagnostic emits no numeric trust score');
check(diagnostic.boundary.includes('does not authorize testing'), 'diagnostic authorization boundary retained');

const allYes = Object.fromEntries(HYPOTHESIS_ORDER.map(id => [id,'YES']));
const cleanDiagnostic = buildDiagnostic(allYes, '2026-10-05T00:00:00.000Z');
equal(cleanDiagnostic.unresolved_count, 0, 'all-YES diagnostic has zero unresolved');
check(cleanDiagnostic.interpretation.includes('not a safety pass'), 'all-YES is not a safety verdict');

const hypothesis = buildHypothesis('en', sampleAnswers, '2026-10-05T00:00:00.000Z');
equal(hypothesis.status, 'ok', 'sample hypothesis status');
equal(hypothesis.rows.length, 4, 'hypothesis builder preserves all NO/UNKNOWN rows');
equal(hypothesis.rows.map(row => row.gate), [
  'Evidence Before Effect','Freshness','External confirmation','Recovery'
], 'hypothesis gates exact');
check(hypothesis.clipboard.includes('Not a finding, not a safety verdict, not testing authorization.'), 'hypothesis boundary retained');

const noOpen = buildHypothesis('en', allYes, '2026-10-05T00:00:00.000Z');
equal(noOpen.status, 'no_open_gates', 'all-YES hypothesis has no open gates');
equal(noOpen.rows.length, 0, 'all-YES hypothesis emits zero rows');

equal(BITEVO_PRECHECK_ENDPOINT, 'https://bitevo.work/api/pre-check', 'pre_check uses canonical API endpoint');

for (const secret of [
  'sk-proj-ABCDEFGHIJKLMNOP',
  'ghp_ABCDEFGHIJKLMNOPQRSTUVWX',
  'github_pat_ABCDEFGHIJKLMNOPQRSTUVWX',
  'xoxb-123456789012-abcdefghijkl',
  'AKIAABCDEFGHIJKLMNOP',
  '-----BEGIN PRIVATE KEY-----',
  'eyJabcdefghijk.eyJabcdefghijk.eyJabcdefghijk',
  '0123456789abcdef0123456789abcdef'
]) {
  check(Boolean(detectPreCheckSecret(secret)), 'secret pattern detected locally');
}

let calls = 0;
const secretOutcome = await callPreCheck('Agent tool with sk-proj-ABCDEFGHIJKLMNOP', 'en', {
  fetchImpl:async () => { calls += 1; throw new Error('must not run'); }
});
equal(secretOutcome.status, 'secret_detected', 'secret pre_check terminal status');
equal(secretOutcome.upstream_calls, 0, 'secret rejected before network');
equal(calls, 0, 'secret causes zero fetch calls');

const rateOutcome = await callPreCheck('Support agent with tool issue_refund for staging.', 'en', {
  fetchImpl:async (url, init) => {
    calls += 1;
    equal(url, BITEVO_PRECHECK_ENDPOINT, 'rate-limit mock receives canonical endpoint');
    equal(init.method, 'POST', 'pre_check uses POST');
    return new Response(JSON.stringify({ error:'RATE_LIMITED', retry_after_seconds:120 }), {
      status:429,
      headers:{ 'Content-Type':'application/json' }
    });
  }
});
equal(rateOutcome.status, 'rate_limited', '429 maps to rate_limited');
equal(rateOutcome.retry_after_seconds, 120, 'retry_after_seconds preserved');

const disabledOutcome = await callPreCheck('Support agent with tool issue_refund for staging.', 'en', {
  fetchImpl:async () => new Response(JSON.stringify({ error:'PRECHECK_DISABLED' }), {
    status:503,
    headers:{ 'Content-Type':'application/json' }
  })
});
equal(disabledOutcome.status, 'unavailable', '503 maps to unavailable');
equal(disabledOutcome.error, 'PRECHECK_DISABLED', 'upstream disabled marker preserved');

const validResult = {
  status:'ok',
  actions:[{
    name:'issue_refund',
    effect:'money',
    object:'unknown',
    owner:'unknown',
    evidence_before:'Approval evidence before effect.',
    evidence_after:'External confirmation after effect.'
  }],
  hypotheses:[
    { gate:'Authority Budget', text:'Test the bounded action authority and preserve the rule result.' },
    { gate:'Object binding', text:'Test the target object binding and preserve the identifiers.' },
    { gate:'External confirmation', text:'Test independent confirmation and preserve the external state.' }
  ],
  unknowns:['Exact object identifier'],
  next_step:{ offer:'Free triage', reason:'Material authority facts remain unknown.' }
};
const okOutcome = await callPreCheck('Support agent with tool issue_refund for staging.', 'en', {
  fetchImpl:async () => new Response(JSON.stringify(validResult), {
    status:200,
    headers:{ 'Content-Type':'application/json' }
  })
});
equal(okOutcome.status, 'ok', 'valid API result accepted');
equal(okOutcome.result, validResult, 'valid API result preserved');

console.log('BITEVO_AUTHORITY_MCP_UNIT=PASS checks=' + checks + ' tools=3 network_tools=1 write_tools=0 secret_pre_network=PASS');
