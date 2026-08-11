import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const workspacePath = resolve(here, '../src/pages/workspace.astro');
const source = readFileSync(workspacePath, 'utf8');
const failures = [];
let requiredChecks = 0;
let structuralChecks = 0;
let forbiddenChecks = 0;

const requireText = (label, needle) => {
  requiredChecks += 1;
  if (!source.includes(needle)) failures.push(`workspace: missing ${label}: ${JSON.stringify(needle)}`);
};

const forbidText = (label, needle) => {
  forbiddenChecks += 1;
  if (source.includes(needle)) failures.push(`workspace: forbidden legacy contract ${label}: ${JSON.stringify(needle)}`);
};

const requireSlice = (label, startNeedle, endNeedle, predicate, failureText) => {
  structuralChecks += 1;
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  if (start < 0 || end < 0 || end <= start) {
    failures.push(`workspace: cannot resolve ${label} source block`);
    return;
  }
  const block = source.slice(start, end);
  if (!predicate(block)) failures.push(`workspace: ${failureText}`);
};

requireText('comparison class RETEST_CANDIDATE', "'RETEST_CANDIDATE'");
requireText('comparison class SCOPE_DRIFT', "'SCOPE_DRIFT'");
requireText('comparison class CROSS_WORKFLOW', "'CROSS_WORKFLOW'");
requireText('same action-class identity fact', 'sameActionClass');
requireText('same workflow identity fact', 'sameWorkflow');
requireText('critical action drift fact', 'criticalActionDrift');
requireText('target binding drift fact', 'targetBindingDrift');
requireText('strict RETEST default', "c.comparisonClass === 'RETEST_CANDIDATE' ? 'RETEST'");
requireText('EXPAND identity veto', "selectedDecision === 'EXPAND' && c.comparisonClass !== 'RETEST_CANDIDATE'");
requireText('RETEST identity veto', "selectedDecision === 'RETEST' && c.comparisonClass !== 'RETEST_CANDIDATE'");
requireText('EXPAND unresolved-gate veto', "selectedDecision === 'EXPAND' && c.afterUnresolved.length > 0");
requireText('RETEST unresolved-gate veto', "selectedDecision === 'RETEST' && c.afterUnresolved.length > 0");
requireText('decision memo schema v2', "schema: 'bitevo.decision-memo.local.v2'");
requireText('memo comparison class', 'comparison_class: c.comparisonClass');
requireText('memo workflow identity', 'same_workflow_identity: c.sameWorkflow');
requireText('memo critical-action drift', 'critical_action_drift: c.criticalActionDrift');
requireText('memo target-binding drift', 'target_binding_drift: c.targetBindingDrift');
requireText('memo conflict reasons', 'conflict_reasons: conflictReasons');
requireText('explicit handoff clear helper', 'const clearIncomingHandoff = () =>');
requireText('explicit Clear incoming control', 'id="clearIncoming"');

requireSlice(
  'initial handoff load',
  'const sessionIncoming =',
  "importJson?.addEventListener('change'",
  block => !block.includes('sessionStorage.removeItem'),
  'incoming handoff is consumed during initial page load instead of Save/Clear'
);
requireSlice(
  'explicit clear action',
  "clearIncoming?.addEventListener('click'",
  "saveIncoming?.addEventListener('click'",
  block => block.includes('clearIncomingHandoff();'),
  'Clear incoming action does not consume pending session handoff'
);
requireSlice(
  'save checkpoint action',
  "saveIncoming?.addEventListener('click'",
  'const makeOption =',
  block => block.includes('clearIncomingHandoff();') && block.indexOf('storeMaps(') < block.indexOf('clearIncomingHandoff();'),
  'Save checkpoint must persist first, then consume pending session handoff'
);
requireSlice(
  'comparison classifier',
  'const classifyComparison =',
  'const compareMaps =',
  block => block.includes('sameActionClass') && block.includes('sameWorkflow') && block.includes('criticalActionDrift') && block.includes('targetBindingDrift'),
  'comparison classifier does not bind action class + workflow identity + critical action/target drift'
);

forbidText('action-class-only comparability', "const comparable = text(c.before.action_class) === text(c.after.action_class);");
forbidText('unconditional zero-gate RETEST default', "decision.value = c.afterUnresolved.length ? 'CONSTRAIN' : 'RETEST';");

if (failures.length) {
  console.error('WORKSPACE_CONTRACT_GATE=FAIL');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log(`WORKSPACE_CONTRACT_GATE=PASS required_checks=${requiredChecks} structural_checks=${structuralChecks} forbidden_checks=${forbiddenChecks} failures=0`);
