import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';

const DEFAULT_POLICY_URL = new URL('../docs/SITE_AGENT_POLICY_PACK_R1.json', import.meta.url);
const DEFAULT_SCHEMA_URL = new URL('../docs/SITE_AGENT_L2_READINESS_SCHEMA_R1.json', import.meta.url);

export async function loadPolicy(url = DEFAULT_POLICY_URL) {
  return JSON.parse(await readFile(url, 'utf8'));
}

export async function loadReadinessSchema(url = DEFAULT_SCHEMA_URL) {
  return JSON.parse(await readFile(url, 'utf8'));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value ?? {}))).digest('hex');
}

function matchesType(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

export function validateReadinessSchema(value, schema, path = '$') {
  if (!schema) return [`${path}:schema_unavailable`];
  const errors = [];
  const types = schema.type === undefined ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.length && !types.some((type) => matchesType(value, type))) return [`${path}:type`];
  if (Object.hasOwn(schema, 'const') && value !== schema.const) errors.push(`${path}:const`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}:enum`);
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}:minLength`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path}:maxLength`);
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => errors.push(...validateReadinessSchema(item, schema.items, `${path}[${index}]`)));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties ?? {};
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(value, required)) errors.push(`${path}.${required}:required`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (Object.hasOwn(properties, key)) errors.push(...validateReadinessSchema(child, properties[key], `${path}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${path}.${key}:additionalProperty`);
    }
  }
  return errors;
}

function present(value) {
  return typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined;
}

export function evaluateL2Readiness(config, policy, schema) {
  const receipt = {
    schema_version: 'SITE_AGENT_L2_READINESS_RECEIPT_V1',
    lane: config?.lane ?? null,
    decision: 'BLOCKED_SCHEMA',
    release_level: null,
    schema_errors: [],
    missing_controls: [],
    controls_complete: false,
    policy_l2_enabled: false,
    config_sha256: hash(config),
    write_allowed: false,
    execute_authority: false,
    notes: []
  };

  receipt.schema_errors = validateReadinessSchema(config, schema);
  if (receipt.schema_errors.length) {
    receipt.notes.push('L2 readiness config failed schema validation.');
    return receipt;
  }

  const lane = policy?.lanes?.[config.lane];
  if (!lane) {
    receipt.schema_errors.push('$.lane:policy_unknown_lane');
    receipt.notes.push('Lane is not present in the current policy pack.');
    return receipt;
  }
  receipt.release_level = lane.release_level;

  const handoffKinds = new Set(['human_handoff', 'public_contact', 'whatsapp', 'telegram', 'phone', 'email']);
  for (const lanePolicy of Object.values(policy?.lanes ?? {})) {
    const type = lanePolicy?.human_handoff?.type;
    if (type) handoffKinds.add(String(type).toLowerCase());
  }
  const destinationKind = String(config.destination.kind ?? '').toLowerCase();
  const destinationIsStorage = !handoffKinds.has(destinationKind);

  const checks = [
    ['destination', config.destination.approved === true && present(config.destination.kind) && present(config.destination.destination_ref) && destinationIsStorage],
    ['controller', config.controller.approved === true && present(config.controller.controller_ref)],
    ['retention', config.retention.approved === true && present(config.retention.retention_rule)],
    ['access', config.access.approved === true && config.access.roles.length > 0 && config.access.roles.every(present)],
    ['privacy', config.privacy.approved === true && present(config.privacy.privacy_ref)],
    ['deletion_correction', config.deletion_correction.approved === true && present(config.deletion_correction.method_ref)],
    ['idempotency', config.idempotency.approved === true && present(config.idempotency.strategy)],
    ['policy_binding', config.policy_binding.approved === true && config.policy_binding.policy_version === policy.schema_version],
    ['synthetic_test', config.synthetic_test.passed === true && present(config.synthetic_test.receipt_sha256)]
  ];
  receipt.missing_controls = checks.filter(([, ok]) => !ok).map(([name]) => name);
  if (receipt.missing_controls.length) {
    receipt.decision = 'NEEDS_L2_CONTROLS';
    if (!destinationIsStorage && present(config.destination.kind)) {
      receipt.notes.push('Human handoff/contact routes are not valid L2 storage destinations.');
    }
    receipt.notes.push('L2 remains disabled until every control is explicitly approved and evidenced.');
    return receipt;
  }

  receipt.controls_complete = true;
  receipt.policy_l2_enabled = String(lane.release_level).startsWith('L2');
  if (!receipt.policy_l2_enabled) {
    receipt.decision = 'READY_FOR_L2_POLICY_GATE';
    receipt.notes.push('Controls are complete, but the lane policy has not granted L2 release authority.');
    return receipt;
  }

  receipt.decision = 'READY_FOR_L2_DRY_RUN';
  receipt.notes.push('Configuration is ready for a synthetic/copied-data L2 dry run only; this evaluator never grants write authority.');
  return receipt;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [configPath] = process.argv.slice(2);
  const policy = await loadPolicy();
  const schema = await loadReadinessSchema();
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  console.log(JSON.stringify(evaluateL2Readiness(config, policy, schema), null, 2));
}
