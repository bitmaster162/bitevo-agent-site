import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(here, '..');
const serverScript = resolve(serverRoot, 'src', 'index.mjs');

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

async function connect(options) {
  const client = new Client(
    { name:'bitevo-authority-smoke', version:'1.0.0' },
    options
  );
  const transport = new StdioClientTransport({
    command:process.execPath,
    args:[serverScript],
    cwd:serverRoot
  });
  await client.connect(transport);
  return client;
}

async function exercise(client, expectedEra = null) {
  const listed = await client.listTools();
  equal(listed.tools.map(tool => tool.name).sort(), ['diagnostic','hypothesis_builder','pre_check'], 'tool list exact');

  for (const tool of listed.tools) {
    equal(tool.annotations?.readOnlyHint, true, tool.name + ' readOnlyHint true');
    equal(tool.annotations?.destructiveHint, false, tool.name + ' destructiveHint false');
  }
  const diagnosticDef = listed.tools.find(tool => tool.name === 'diagnostic');
  const hypothesisDef = listed.tools.find(tool => tool.name === 'hypothesis_builder');
  const preCheckDef = listed.tools.find(tool => tool.name === 'pre_check');
  equal(diagnosticDef?.annotations?.openWorldHint, false, 'diagnostic closed-world');
  equal(hypothesisDef?.annotations?.openWorldHint, false, 'hypothesis_builder closed-world');
  equal(preCheckDef?.annotations?.openWorldHint, true, 'pre_check declares fixed external API interaction');

  const diagnostic = await client.callTool({ name:'diagnostic', arguments:sampleAnswers });
  equal(diagnostic.isError, undefined, 'diagnostic call succeeds');
  equal(diagnostic.structuredContent?.explicit_yes, 3, 'diagnostic structured YES count');
  equal(diagnostic.structuredContent?.unresolved_count, 4, 'diagnostic structured unresolved count');

  const hypothesis = await client.callTool({
    name:'hypothesis_builder',
    arguments:{ ...sampleAnswers, locale:'en' }
  });
  equal(hypothesis.isError, undefined, 'hypothesis call succeeds');
  equal(hypothesis.structuredContent?.rows?.length, 4, 'hypothesis structured rows');
  check(hypothesis.structuredContent?.clipboard?.includes('not testing authorization'), 'hypothesis retains authorization boundary');

  const secret = await client.callTool({
    name:'pre_check',
    arguments:{ text:'Agent tool has sk-proj-ABCDEFGHIJKLMNOP and issue_refund.', locale:'en' }
  });
  equal(secret.isError, undefined, 'secret_detected is a terminal result, not protocol failure');
  equal(secret.structuredContent?.status, 'secret_detected', 'pre_check secret detected');
  equal(secret.structuredContent?.upstream_calls, 0, 'pre_check secret makes zero upstream calls');

  const invalid = await client.callTool({
    name:'diagnostic',
    arguments:{ ...sampleAnswers, action:'MAYBE' }
  });
  equal(invalid.isError, true, 'SDK rejects invalid enum before handler');

  if (expectedEra) equal(client.getProtocolEra(), expectedEra, 'protocol era exact');
}

const legacy = await connect(undefined);
try {
  await exercise(legacy, 'legacy');
} finally {
  await legacy.close();
}

const modern = await connect({ versionNegotiation:{ mode:'auto' } });
try {
  await exercise(modern, 'modern');
} finally {
  await modern.close();
}

console.log('BITEVO_AUTHORITY_MCP_STDIO=PASS checks=' + checks + ' eras=legacy+modern tools=3 read_only=3');
