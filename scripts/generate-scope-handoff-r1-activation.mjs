import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  renderScopeHandoffActivationBootstrap,
  toPublicScopeHandoffActivation
} from '../src/lib/scope-handoff-r1/activation.js';

const outputPath = resolve(process.argv[2] || 'public/scope-handoff-r1-activation.js');
const record = toPublicScopeHandoffActivation(process.env);
const source = renderScopeHandoffActivationBootstrap(record);

mkdirSync(dirname(outputPath), { recursive:true });
writeFileSync(outputPath, source, 'utf8');

console.log([
  'SCOPE_HANDOFF_R1_ACTIVATION_GENERATED',
  `project_bound=${record.project_bound}`,
  `preview_bound=${record.preview_bound}`,
  `runtime=${record.runtime_enabled ? 'ENABLED' : 'DISABLED'}`,
  `ui=${record.ui_enabled ? 'ENABLED' : 'DISABLED'}`,
  `output=${outputPath}`
].join(' '));
