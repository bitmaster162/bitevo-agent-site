import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { DIAGNOSTIC_QUESTIONS, buildDiagnostic } from '../mcp/bitevo-authority/src/diagnostic.mjs';
import { HYPOTHESIS_GATES, HYPOTHESIS_ORDER, buildHypothesis } from '../mcp/bitevo-authority/src/hypothesis-builder.mjs';
import {
  BITEVO_PRECHECK_ENDPOINT,
  PRECHECK_MAX_INPUT_CHARS,
  PRECHECK_SECRET_PATTERNS,
  callPreCheck
} from '../mcp/bitevo-authority/src/pre-check.mjs';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks += 1; };

const root = new URL('../', import.meta.url);
const mcpRoot = new URL('mcp/bitevo-authority/', root);
const read = relative => readFile(new URL(relative, root), 'utf8');
const readMcp = relative => readFile(new URL(relative, mcpRoot), 'utf8');

const rootPackage = JSON.parse(await read('package.json'));
const packageJson = JSON.parse(await readMcp('package.json'));
const packageLock = JSON.parse(await readMcp('package-lock.json'));
const serverSource = await readMcp('src/server.mjs');
const cliSource = await readMcp('src/index.mjs');
const preCheckSource = await readMcp('src/pre-check.mjs');
const readme = await readMcp('README.md');
const diagnosticPage = await read('src/pages/diagnostic.astro');
const hypothesisBrowser = await read('public/hypothesis-builder-p27-8.js');
const preCheckCore = await read('src/lib/pre-check-r1/core.js');

equal(packageJson.private, true, 'MCP package remains private until package identity/publish approval');
equal(packageJson.type, 'module', 'MCP package is ESM');
equal(packageJson.version, '0.1.0', 'MCP package version exact');
equal(packageJson.bin, { 'bitevo-authority':'src/index.mjs' }, 'stdio package bin exact');
equal(packageJson.files, ['src','README.md'], 'future package allowlist excludes tests and local artifacts');
equal(packageJson.dependencies?.['@modelcontextprotocol/server'], '2.3.0', 'official MCP server SDK pinned');
equal(packageJson.dependencies?.zod, '4.6.5', 'zod pinned');
equal(packageJson.devDependencies?.['@modelcontextprotocol/client'], '2.3.1', 'official MCP client pinned for smoke tests');
equal(packageLock.packages?.['']?.dependencies?.['@modelcontextprotocol/server'], '2.3.0', 'lockfile server SDK exact');
equal(packageLock.packages?.['']?.dependencies?.zod, '4.6.5', 'lockfile zod exact');
equal(packageLock.packages?.['']?.devDependencies?.['@modelcontextprotocol/client'], '2.3.1', 'lockfile client SDK exact');

const toolNames = [...serverSource.matchAll(/registerTool\(\s*'([^']+)'/g)].map(match => match[1]);
equal(toolNames, ['diagnostic','hypothesis_builder','pre_check'], 'MCP exposes exactly three approved tools');
equal((serverSource.match(/readOnlyHint:true/g) || []).length, 3, 'all three tools advertise readOnlyHint');
equal((serverSource.match(/destructiveHint:false/g) || []).length, 3, 'all three tools advertise destructiveHint false');
equal((serverSource.match(/openWorldHint:false/g) || []).length, 2, 'two deterministic tools are closed-world');
equal((serverSource.match(/openWorldHint:true/g) || []).length, 1, 'only pre_check declares external API interaction');
check(!serverSource.includes('registerResource(') && !serverSource.includes('registerPrompt('), 'no unrequested resources or prompts');
check(!/(registerTool\(\s*['"](?:write|send|book|deploy|delete|payment|refund|message|file_))/i.test(serverSource), 'no action-capable tool names');
check(cliSource.includes("serveStdio(() => createServer())"), 'stdio uses official v2 serveStdio entry');
check(cliSource.includes('console.error') && !cliSource.includes('console.log'), 'stdio protocol stdout is not used for logs');

equal(DIAGNOSTIC_QUESTIONS.length, 7, 'diagnostic module has seven gates');
for (const item of DIAGNOSTIC_QUESTIONS) {
  check(diagnosticPage.includes(item.gate), 'diagnostic gate parity: ' + item.gate);
  check(diagnosticPage.includes(item.q), 'diagnostic question parity: ' + item.id);
  check(diagnosticPage.includes(item.why), 'diagnostic explanation parity: ' + item.id);
}

equal(HYPOTHESIS_ORDER, ['action','object','owner','evidence','freshness','confirm','recovery'], 'hypothesis order exact');
for (const id of HYPOTHESIS_ORDER) {
  for (const locale of ['en','ru']) {
    const row = HYPOTHESIS_GATES[id][locale];
    check(hypothesisBrowser.includes(row.gate), 'hypothesis gate parity: ' + id + '/' + locale);
    check(hypothesisBrowser.includes(row.blocked), 'hypothesis blocked copy parity: ' + id + '/' + locale);
    check(hypothesisBrowser.includes(row.evidence), 'hypothesis evidence copy parity: ' + id + '/' + locale);
  }
}

equal(BITEVO_PRECHECK_ENDPOINT, 'https://bitevo.work/api/pre-check', 'pre_check endpoint canonical');
equal(PRECHECK_MAX_INPUT_CHARS, 8000, 'pre_check input ceiling exact');
equal(PRECHECK_SECRET_PATTERNS.length, 8, 'pre_check local secret patterns count exact');
for (const [name] of PRECHECK_SECRET_PATTERNS) check(preCheckCore.includes("['" + name + "'"), 'secret pattern name parity: ' + name);
check(!preCheckSource.includes('openrouter.ai'), 'MCP source does not call OpenRouter');
check(!preCheckSource.includes('OPENROUTER_API_KEY'), 'MCP source does not read OpenRouter key');
check(!preCheckSource.includes('PRECHECK_R1_OPENROUTER_MODELS'), 'MCP source does not carry provider model config');
check(serverSource.includes('callPreCheck(text, locale)'), 'pre_check delegates to bounded client');
check(preCheckSource.includes('fetchImpl(endpoint'), 'bounded client has one upstream fetch site');
equal((preCheckSource.match(/fetchImpl\(/g) || []).length, 1, 'pre_check has exactly one upstream fetch call site');

const sample = {
  action:'YES', object:'YES', owner:'YES',
  evidence:'UNKNOWN', freshness:'UNKNOWN', confirm:'NO', recovery:'UNKNOWN'
};
const diagnostic = buildDiagnostic(sample, '2026-10-05T00:00:00.000Z');
equal(diagnostic.explicit_yes, 3, 'diagnostic sample YES count');
equal(diagnostic.unresolved_count, 4, 'diagnostic sample unresolved count');
check(diagnostic.interpretation.includes('not converted into a numeric risk score'), 'diagnostic preserves no-score boundary');

const hypothesis = buildHypothesis('en', sample, '2026-10-05T00:00:00.000Z');
equal(hypothesis.rows.length, 4, 'hypothesis sample preserves four open gates');
check(hypothesis.clipboard.includes('Not a finding, not a safety verdict, not testing authorization.'), 'hypothesis boundary preserved');

let fetchCalls = 0;
const secretOutcome = await callPreCheck('Agent tool has sk-proj-ABCDEFGHIJKLMNOP and issue_refund.', 'en', {
  fetchImpl:async () => { fetchCalls += 1; throw new Error('network must not run'); }
});
equal(secretOutcome.status, 'secret_detected', 'secret is terminal pre_check result');
equal(fetchCalls, 0, 'secret rejected before MCP network I/O');

check(readme.includes('exactly three tools') && readme.includes('diagnostic') && readme.includes('hypothesis_builder') && readme.includes('pre_check'), 'README documents three tools');
check(readme.includes('https://bitevo.work/api/pre-check'), 'README documents canonical pre_check endpoint');
check(readme.includes('does **not** publish an npm package or an MCP Registry listing'), 'README states registry publication deferred');
check(readme.includes('No placeholder registry package is advertised here.'), 'README forbids invented registry package');

let serverJsonExists = true;
try {
  await access(new URL('server.json', mcpRoot), fsConstants.F_OK);
} catch {
  serverJsonExists = false;
}
equal(serverJsonExists, false, 'no unpublishable server.json manifest is invented');
equal(packageJson.mcpName, undefined, 'no registry ownership marker invented before package identity');

check(!rootPackage.dependencies?.['@modelcontextprotocol/server'], 'site production dependencies unchanged by MCP package');
check(!rootPackage.dependencies?.zod, 'site production dependencies do not absorb MCP zod');
check(rootPackage.scripts?.['verify:core']?.includes('verify-f1-4-bitevo-authority-mcp-r1.mjs'), 'F1.4 verifier wired into site core gate');

const rootPath = fileURLToPath(root);
execFileSync(process.execPath, ['--check', fileURLToPath(new URL('mcp/bitevo-authority/src/index.mjs', root))], { stdio:'ignore' });
checks += 1;
execFileSync(process.execPath, ['--check', fileURLToPath(new URL('mcp/bitevo-authority/src/server.mjs', root))], { stdio:'ignore' });
checks += 1;
execFileSync(process.execPath, ['mcp/bitevo-authority/test/unit.mjs'], { cwd:rootPath, stdio:'ignore' });
checks += 1;

console.log(
  'F1_4_BITEVO_AUTHORITY_MCP_R1_GATE=PASS checks=' + checks +
  ' tools=3 read_only=3 deterministic_local=2 precheck_api=CANONICAL secret_pre_network=PASS' +
  ' direct_openrouter=0 write_tools=0 registry_publish=DEFERRED package_private=1 stdio_sdk_v2=PINNED'
);
