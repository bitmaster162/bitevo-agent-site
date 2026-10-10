import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import {
  PRECHECK_R1_GATES,
  PRECHECK_R1_MAX_INPUT_CHARS,
  buildFallbackPreCheck,
  buildScopeResultSummary,
  detectPreCheckSecret,
  handlePreCheckRequest,
  validatePreCheckResult
} from '../src/lib/pre-check-r1/core.js';
import { parsePreCheckRuntimeConfig } from '../src/lib/pre-check-r1/config.js';
import {
  PRECHECK_R1_IP_HOUR_MAX,
  PRECHECK_R1_IP_HOUR_SECONDS,
  PRECHECK_R1_RATE_LIMIT_PREFIX,
  createPreCheckRateLimiter
} from '../src/lib/pre-check-r1/rate-limit.js';
import {
  OPENROUTER_CHAT_COMPLETIONS_URL,
  PRECHECK_R1_SYSTEM_PROMPT,
  createOpenRouterPreCheckProvider
} from '../src/lib/pre-check-r1/openrouter.js';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks += 1; };

class MemoryCasStore {
  constructor() { this.rows = new Map(); this.version = 0; }
  async read(pathname) {
    const row = this.rows.get(pathname);
    return row ? structuredClone(row) : null;
  }
  async createIfAbsent(pathname, value) {
    if (this.rows.has(pathname)) return { created:false };
    this.version += 1;
    this.rows.set(pathname, { value:structuredClone(value), etag:'e' + this.version });
    return { created:true };
  }
  async replaceIfMatch(pathname, value, etag) {
    const row = this.rows.get(pathname);
    if (!row || row.etag !== etag) return { replaced:false };
    this.version += 1;
    this.rows.set(pathname, { value:structuredClone(value), etag:'e' + this.version });
    return { replaced:true };
  }
}

let mutationCounter = 0;
const mutationIdFactory = () => {
  mutationCounter += 1;
  return 'rl_' + mutationCounter.toString(16).padStart(32, '0');
};
const now = () => Date.parse('2026-10-05T10:00:00.000Z');
const request = text => new Request('https://bitevo.work/api/pre-check', {
  method:'POST',
  headers:{ 'Content-Type':'application/json', Origin:'https://bitevo.work' },
  body:JSON.stringify({ text, locale:'en' })
});
const bodyOf = async response => ({ status:response.status, body:await response.json() });

equal(PRECHECK_R1_MAX_INPUT_CHARS, 8000, 'input ceiling exact');
equal(PRECHECK_R1_IP_HOUR_MAX, 5, 'per-IP hourly ceiling exact');
equal(PRECHECK_R1_IP_HOUR_SECONDS, 3600, 'per-IP window is one hour');
equal(PRECHECK_R1_GATES.length, 7, 'seven canonical gates');

const disabled = parsePreCheckRuntimeConfig({});
check(disabled.enabled === false && disabled.ok === true, 'runtime disabled by default');
const incomplete = parsePreCheckRuntimeConfig({ PRECHECK_R1_ENABLED:'true' });
check(incomplete.enabled === true && incomplete.ok === false && incomplete.errors.includes('DAILY_LIMIT_REQUIRED'), 'enabled runtime requires owner daily limit');
const fallbackOnly = parsePreCheckRuntimeConfig({
  PRECHECK_R1_ENABLED:'true',
  PRECHECK_R1_DAILY_LIMIT:'100',
  PRECHECK_R1_RATE_LIMIT_KEY_SECRET:'x'.repeat(32)
});
check(fallbackOnly.ok && !fallbackOnly.providerConfigured, 'provider can remain unconfigured while deterministic fallback exists');
const freeProvider = parsePreCheckRuntimeConfig({
  PRECHECK_R1_ENABLED:'true',
  PRECHECK_R1_DAILY_LIMIT:'100',
  PRECHECK_R1_RATE_LIMIT_KEY_SECRET:'x'.repeat(32),
  OPENROUTER_API_KEY:'test-only-key-not-a-real-secret',
  PRECHECK_R1_OPENROUTER_MODELS:'openrouter/free,example/model:free'
});
check(freeProvider.ok && freeProvider.providerConfigured && freeProvider.models.length === 2, 'configured free model routes accepted');
const paidProvider = parsePreCheckRuntimeConfig({
  PRECHECK_R1_ENABLED:'true',
  PRECHECK_R1_DAILY_LIMIT:'100',
  PRECHECK_R1_RATE_LIMIT_KEY_SECRET:'x'.repeat(32),
  OPENROUTER_API_KEY:'test-only-key-not-a-real-secret',
  PRECHECK_R1_OPENROUTER_MODELS:'vendor/paid-model'
});
check(paidProvider.models.length === 0 && !paidProvider.providerConfigured, 'paid model slug not activated');

for (const sample of [
  'sk-proj-ABCDEFGHIJKLMNOP',
  'ghp_ABCDEFGHIJKLMNOPQRSTUVWX',
  'github_pat_ABCDEFGHIJKLMNOPQRSTUVWX',
  'xoxb-123456789012-abcdefghijkl',
  'AKIAABCDEFGHIJKLMNOP',
  '-----BEGIN PRIVATE KEY-----',
  'eyJabcdefghijk.eyJabcdefghijk.eyJabcdefghijk',
  '0123456789abcdef0123456789abcdef'
]) check(Boolean(detectPreCheckSecret(sample)), 'secret pattern rejected');

const support = buildFallbackPreCheck('Support agent with tool issue_refund for the current staging ticket.', 'en');
check(support.status === 'ok' && support.actions.some(item => item.name === 'issue_refund' && item.effect === 'money'), 'support fallback maps issue_refund');
equal(support.hypotheses.length, 3, 'support fallback emits exactly three hypotheses');
check(validatePreCheckResult(support).ok, 'support fallback validates');

const mcp = buildFallbackPreCheck('MCP server exposes file_write to write a local file for the workflow.', 'en');
check(mcp.status === 'ok' && mcp.actions.some(item => item.name === 'file_write' && item.effect === 'write_internal'), 'MCP fallback maps file_write');
equal(mcp.hypotheses.length, 3, 'MCP fallback emits exactly three hypotheses');
equal(buildFallbackPreCheck('A recipe for vegetable soup with no software automation.', 'en'), { status:'out_of_scope' }, 'unrelated text out of scope');

const secretLimiter = { calls:0, async consume(){ this.calls += 1; return { decision:'ALLOW', providerIo:0 }; } };
const secretProvider = { calls:0, async run(){ this.calls += 1; throw new Error('must not run'); } };
const secretResponse = await bodyOf(await handlePreCheckRequest(
  request('Agent tool includes sk-proj-ABCDEFGHIJKLMNOP and issue_refund.'),
  { enabled:true, limiter:secretLimiter, provider:secretProvider }
));
equal(secretResponse.status, 200, 'secret response terminal');
equal(secretResponse.body, { status:'secret_detected' }, 'secret response has no extra fields');
equal(secretLimiter.calls, 0, 'secret rejected before rate-limit provider I/O');
equal(secretProvider.calls, 0, 'secret rejected before OpenRouter');

const rateStore = new MemoryCasStore();
const limiterOptions = {
  store:rateStore,
  ip:'203.0.113.7',
  keySecret:'k'.repeat(32),
  dailyLimit:100,
  now,
  mutationIdFactory
};
for (let i = 0; i < 5; i += 1) {
  const response = await bodyOf(await handlePreCheckRequest(
    request('Support agent with tool issue_refund for staging.'),
    { enabled:true, limiter:createPreCheckRateLimiter(limiterOptions), provider:null }
  ));
  equal(response.status, 200, 'request inside hourly ceiling accepted');
}
const sixth = await bodyOf(await handlePreCheckRequest(
  request('Support agent with tool issue_refund for staging.'),
  { enabled:true, limiter:createPreCheckRateLimiter(limiterOptions), provider:null }
));
equal(sixth.status, 429, 'sixth request in one hour denied');
equal(sixth.body.error, 'RATE_LIMITED', 'hourly denial explicit');
check([...rateStore.rows.keys()].every(pathname => pathname.startsWith(PRECHECK_R1_RATE_LIMIT_PREFIX)), 'dedicated pre-check rate paths only');
check([...rateStore.rows.keys()].every(pathname => !pathname.includes('203.0.113.7')), 'raw IP never stored');

let invalidCalls = 0;
const invalidProvider = createOpenRouterPreCheckProvider({
  apiKey:'test-key',
  models:['example/model:free'],
  fetchImpl:async () => {
    invalidCalls += 1;
    return { ok:true, async json(){ return { choices:[{ message:{ content:'not json' } }] }; } };
  }
});
const invalidOutcome = await invalidProvider.run('Agent with tool issue_refund.', 'en');
equal(invalidOutcome.kind, 'invalid', 'invalid structured output falls back after retry');
equal(invalidCalls, 2, 'invalid output retried exactly once');

let unavailableCalls = 0;
const unavailableProvider = createOpenRouterPreCheckProvider({
  apiKey:'test-key',
  models:['one/model:free','two/model:free'],
  fetchImpl:async () => { unavailableCalls += 1; return { ok:false }; }
});
const unavailableOutcome = await unavailableProvider.run('Agent with tool issue_refund.', 'en');
equal(unavailableOutcome.kind, 'unavailable', 'all unavailable models return unavailable');
equal(unavailableCalls, 2, 'models tried in order until exhausted');

check(OPENROUTER_CHAT_COMPLETIONS_URL === 'https://openrouter.ai/api/v1/chat/completions', 'OpenRouter endpoint exact');
check(PRECHECK_R1_SYSTEM_PROMPT.includes('never execute anything') && PRECHECK_R1_SYSTEM_PROMPT.includes('exactly 3 testable hypotheses'), 'system-prompt boundaries retained');

const privateMarker = 'TOP_SECRET_SOURCE_TEXT_DO_NOT_COPY';
const summarySource = structuredClone(support);
summarySource.actions[0].evidence_before = privateMarker;
summarySource.hypotheses[0].text = privateMarker;
const compact = buildScopeResultSummary(summarySource);
check(typeof compact === 'string' && compact.length <= 600, 'Scope Handoff JSON summary within 600 chars');
check(!compact.includes(privateMarker), 'Scope Handoff summary excludes source/evidence text');
check(JSON.parse(compact).status === 'ok', 'Scope Handoff summary valid JSON');

const root = new URL('../', import.meta.url);
const pageSource = await readFile(new URL('src/pages/pre-check.astro', root), 'utf8');
const client = await readFile(new URL('public/pre-check-r1.js', root), 'utf8');
const css = await readFile(new URL('public/pre-check-r1.css', root), 'utf8');
const apiSource = await readFile(new URL('api/pre-check.ts', root), 'utf8');
const configSource = await readFile(new URL('src/lib/pre-check-r1/config.js', root), 'utf8');
const registry = JSON.parse(await readFile(new URL('src/data/public-route-registry.json', root), 'utf8'));
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const html = await readFile(new URL('dist/pre-check/index.html', root), 'utf8');
const sitemap = await readFile(new URL('dist/sitemap.xml', root), 'utf8');

check(pageSource.includes("Map your agent's authority before you test it."), 'design H1 exact');
check(pageSource.includes('Paste a tool list, an MCP server manifest or a plain description.'), 'design lead retained');
check(pageSource.includes('maxlength="8000"') && pageSource.includes('Keys, tokens and credentials are rejected.'), '8k and secret boundaries visible');
const precheckForm = (html.match(/<form\b[^>]*\bdata-precheck-form\b[^>]*>/i) || [])[0] || '';
check(/\bmethod="post"/.test(precheckForm) && !/\baction\s*=/.test(precheckForm), 'pre-check SSR uses POST without action');
const precheckSubmit = (html.match(/<button\b[^>]*\bdata-precheck-run\b[^>]*>/i) || [])[0] || '';
check(/\bdisabled\b/.test(precheckSubmit) && /\bdata-js-local-submit\b/.test(precheckSubmit), 'SSR authority button disabled');
check(/<p\b[^>]*\bdata-js-local-fallback\b/.test(html), 'SSR visible no-JS status');
check(client.includes("form.getAttribute('method') !== 'post'") && client.includes("form.hasAttribute('action')"), 'authority readiness checks form boundary');
check(client.indexOf("form.addEventListener('submit'") >= 0 &&
      client.indexOf("form.addEventListener('submit'") < client.lastIndexOf('noJsFallback.hidden = true;') &&
      client.indexOf("send.addEventListener('click'") < client.lastIndexOf('run.disabled = false;'), 'JS enables after handlers');
check(pageSource.includes('Send to Robert') && pageSource.includes('Book a free triage') && pageSource.includes('Copy result'), 'three result actions present');
check(pageSource.includes('https://cal.com/robert-dumanyan-vlck0x/free-20-minute-triage'), 'verified Cal.com URL reused');
check(pageSource.includes('robots="noindex, follow"'), 'page noindex before activation');
check(client.includes("fetch('/api/pre-check'") && !client.includes('openrouter.ai'), 'browser calls same-origin API only');
check(!/\.submit\s*\(|\.requestSubmit\s*\(/.test(client), 'client never auto-submits');
check(!client.includes('consent.checked') && !client.includes('data-scope-consent'), 'client never grants consent');
check(client.includes('The original text was not copied'), 'handoff copy states raw-input boundary');
check(css.length > 500 && css.length < 1000, 'bounded external stylesheet present');

const sandbox = { __BITEVO_PRECHECK_R1_TEST__:true };
sandbox.globalThis = sandbox;
vm.runInNewContext(client, sandbox, { filename:'pre-check-r1.js' });
const clientApi = sandbox.__BITEVO_PRECHECK_R1_TEST_API__;
check(clientApi && clientApi.detectSecret('ghp_ABCDEFGHIJKLMNOPQRSTUVWX'), 'client secret boundary active before fetch');
const clientSummary = clientApi.buildScopeSummary(support);
check(typeof clientSummary === 'string' && clientSummary.length <= 600, 'client JSON handoff summary bounded');

const route = registry.routes.find(item => item.path === '/pre-check');
check(route?.category === 'INTERNAL_NO_INDEX' && route?.indexable === false && route?.locale === 'en' && route?.parent === '/diagnostic', 'route registered noindex before activation');
check(!sitemap.includes('<loc>https://bitevo.work/pre-check</loc>'), 'pre-check absent from sitemap before activation');
check(/<meta[^>]+name="robots"[^>]+content="noindex, follow"/i.test(html), 'built pre-check HTML noindex');
check(html.includes('src="/pre-check-r1.js"') && html.includes('href="/pre-check-r1.css"'), 'built HTML uses first-party assets');
check(configSource.includes('OPENROUTER_API_KEY') && apiSource.includes('createPreCheckRateLimiter') && !apiSource.includes('sk-or-') && !configSource.includes('sk-or-'), 'runtime expects env key without embedded secret');
check(!/(?:nvidia|google|meta|openai|anthropic)\//i.test(apiSource + configSource), 'runtime source does not invent provider model list');
check(pkg.scripts?.['verify:core']?.includes('verify-f1-1-authority-precheck-r1.mjs'), 'F1.1 verifier wired into core');

console.log(
  'F1_1_AUTHORITY_PRECHECK_R1_GATE=PASS checks=' + checks +
  ' route=NOINDEX_SOURCE_PRESENT runtime_default=DISABLED input_max=8000 secret_pre_provider=PASS' +
  ' ip_hour=5 daily_limit=OWNER_ENV model_list=OWNER_ENV openrouter=SERVER_ONLY fallback=DETERMINISTIC' +
  ' scope_summary_max=600 raw_input_handoff=0 network_client=SAME_ORIGIN_ONLY'
);
