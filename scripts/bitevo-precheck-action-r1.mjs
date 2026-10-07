import { createHash } from 'node:crypto';
import { mkdir, lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const N23_SCHEMA = 'bitevo.github-precheck.r1';
export const N23_SUPPORTED_BASENAMES = Object.freeze(['SKILL.md', 'CLAUDE.md', '.cursorrules', 'mcp.json']);
export const N23_LIMITS = Object.freeze({
  maxFiles: 100,
  maxFileBytes: 128 * 1024,
  maxTotalBytes: 1024 * 1024,
  maxWarnings: 500,
});

const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', '.astro', '.vercel', '.wrangler', 'coverage']);
const SUPPORTED = new Set(N23_SUPPORTED_BASENAMES);

function normalizeRelative(value) {
  return value.split(path.sep).join('/');
}

function safeMessage(error) {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/[\r\n]+/g, ' ').slice(0, 300);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function resetPattern(pattern) {
  pattern.lastIndex = 0;
  return pattern;
}

export function loadCanonicalConfigScanner(source) {
  if (typeof source !== 'string' || !source.trim()) throw new Error('canonical N8 scanner source missing');
  const sandbox = { __BITEVO_CONFIG_SCAN_R1_TEST__: true };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'pre-check-config-scan-r1.js' });
  const api = sandbox.__BITEVO_CONFIG_SCAN_R1_TEST_API__;
  if (!api || api.SCHEMA !== 'bitevo.pre-check-config-scan.r1') throw new Error('canonical N8 scanner API unavailable');
  if (!Array.isArray(api.RULES) || api.RULES.length !== 7) throw new Error('canonical N8 rule count mismatch');
  if (!Array.isArray(api.SECRET_PATTERNS) || api.SECRET_PATTERNS.length !== 8) throw new Error('canonical N8 secret-pattern count mismatch');
  if (typeof api.analyzeConfigText !== 'function') throw new Error('canonical N8 analyzer unavailable');
  return api;
}

async function collectSupportedTargets(root) {
  const targets = [];
  const unsupported = [];

  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) await walk(path.join(directory, entry.name));
        continue;
      }
      if (!SUPPORTED.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      const relative = normalizeRelative(path.relative(root, absolute));
      const meta = await lstat(absolute);
      if (meta.isSymbolicLink()) {
        unsupported.push({ path: relative, reason: 'SYMLINK_INPUT_UNSUPPORTED' });
        continue;
      }
      if (!meta.isFile()) {
        unsupported.push({ path: relative, reason: 'NON_REGULAR_INPUT_UNSUPPORTED' });
        continue;
      }
      targets.push({ absolute, relative, size: meta.size });
    }
  }

  await walk(root);
  return { targets, unsupported };
}

function secretLines(text, secretPatterns) {
  const found = new Map();
  text.split(/\r?\n/).forEach((line, index) => {
    for (const [kind, pattern] of secretPatterns) {
      if (resetPattern(pattern).test(line)) {
        found.set(index + 1, kind);
        break;
      }
    }
  });
  return found;
}

function sanitizeWarning(warning, redactedLines) {
  const secretKind = redactedLines.get(warning.line) || warning.secret_kind || null;
  return Object.freeze({
    id: String(warning.id || 'UNKNOWN'),
    title: String(warning.title || 'Review signal'),
    category: String(warning.category || 'unknown'),
    line: Number.isSafeInteger(warning.line) && warning.line > 0 ? warning.line : 0,
    excerpt: secretKind ? '[credential-like material redacted]' : String(warning.excerpt || '').slice(0, 220),
    review: String(warning.review || '').slice(0, 500),
    ...(secretKind ? { secret_kind: String(secretKind) } : {}),
  });
}

function buildBoundary() {
  return Object.freeze({
    repository_read_only: true,
    network_requests: 0,
    model_calls: 0,
    external_network_required: false,
    api_keys_required: false,
    secrets_required: false,
    autofix: false,
    repository_remote_writes: false,
    pr_comments: false,
    issue_mutations: false,
    audit_finding: false,
    safety_verdict: false,
    testing_authorization: false,
  });
}

function reportStatus(warningCount, unsupportedCount) {
  if (unsupportedCount > 0) return 'UNSUPPORTED_INPUT';
  if (warningCount > 0) return 'REVIEW_REQUIRED';
  return 'PASS';
}

function exitCodeFor(status) {
  if (status === 'PASS') return 0;
  if (status === 'REVIEW_REQUIRED') return 2;
  return 3;
}

export async function scanRepository({
  root,
  scannerSource,
  limits = N23_LIMITS,
} = {}) {
  const repositoryRoot = path.resolve(root || process.cwd());
  const api = loadCanonicalConfigScanner(scannerSource);
  const inventory = await collectSupportedTargets(repositoryRoot);
  const unsupported = [...inventory.unsupported];
  const files = [];
  let totalBytes = 0;
  let observedWarnings = 0;

  if (inventory.targets.length > limits.maxFiles) {
    unsupported.push({
      path: '.',
      reason: 'SUPPORTED_FILE_COUNT_LIMIT_EXCEEDED',
      observed: inventory.targets.length,
      limit: limits.maxFiles,
    });
  }

  for (const target of inventory.targets.slice(0, limits.maxFiles)) {
    if (target.size > limits.maxFileBytes) {
      unsupported.push({
        path: target.relative,
        reason: 'FILE_SIZE_LIMIT_EXCEEDED',
        observed: target.size,
        limit: limits.maxFileBytes,
      });
      continue;
    }
    if (totalBytes + target.size > limits.maxTotalBytes) {
      unsupported.push({
        path: target.relative,
        reason: 'TOTAL_SIZE_LIMIT_EXCEEDED',
        observed: totalBytes + target.size,
        limit: limits.maxTotalBytes,
      });
      continue;
    }

    const raw = await readFile(target.absolute);
    totalBytes += raw.byteLength;
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
    } catch {
      unsupported.push({ path: target.relative, reason: 'UTF8_REQUIRED' });
      continue;
    }
    if (text.includes('\0')) {
      unsupported.push({ path: target.relative, reason: 'BINARY_INPUT_UNSUPPORTED' });
      continue;
    }

    const rawReport = api.analyzeConfigText(text);
    const redactedLines = secretLines(text, api.SECRET_PATTERNS);
    const warnings = rawReport.warnings.map(item => sanitizeWarning(item, redactedLines));
    observedWarnings += warnings.length;

    files.push(Object.freeze({
      path: target.relative,
      bytes: raw.byteLength,
      sha256: sha256(raw),
      warning_count: warnings.length,
      warnings: Object.freeze(warnings.slice(0, limits.maxWarnings)),
    }));
  }

  if (observedWarnings > limits.maxWarnings) {
    unsupported.push({
      path: '.',
      reason: 'WARNING_COUNT_LIMIT_EXCEEDED',
      observed: observedWarnings,
      limit: limits.maxWarnings,
    });
  }

  let remaining = limits.maxWarnings;
  const boundedFiles = files.map(file => {
    const warnings = file.warnings.slice(0, Math.max(0, remaining));
    remaining -= warnings.length;
    return Object.freeze({ ...file, warnings: Object.freeze(warnings) });
  });

  const storedWarnings = boundedFiles.reduce((sum, file) => sum + file.warnings.length, 0);
  const status = reportStatus(observedWarnings, unsupported.length);
  const report = Object.freeze({
    schema: N23_SCHEMA,
    status,
    scanner_schema: api.SCHEMA,
    supported_basenames: N23_SUPPORTED_BASENAMES,
    scanned_file_count: boundedFiles.length,
    total_input_bytes: totalBytes,
    warning_count: observedWarnings,
    stored_warning_count: storedWarnings,
    unsupported_count: unsupported.length,
    files: Object.freeze(boundedFiles),
    unsupported: Object.freeze(unsupported),
    boundary: buildBoundary(),
  });

  return Object.freeze({ report, exitCode: exitCodeFor(status) });
}

function mdEscape(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').trim();
}

export function renderSummary(report) {
  const lines = [
    '# BitEvo Pre-Check',
    '',
    `**Outcome:** \`${report.status}\``,
    '',
    `Scanned supported files: **${report.scanned_file_count}** · Review signals: **${report.warning_count}** · Unsupported inputs: **${report.unsupported_count}**`,
    '',
    '> Pattern matches are review signals only. This is not an audit finding, a safety verdict, or testing authorization.',
    '',
    '## Boundary',
    '',
    '- Reuses canonical N8 deterministic rules.',
    '- Repository analysis is read-only; no autofix or repository remote write.',
    '- Zero model calls and zero scanner network requests.',
    '- No API keys or secrets are required.',
    '- Output is limited to this step summary and the bounded report artifact.',
  ];

  if (report.unsupported.length) {
    lines.push('', '## Unsupported inputs', '', '| Path | Reason |', '| --- | --- |');
    for (const item of report.unsupported) {
      lines.push(`| ${mdEscape(item.path)} | ${mdEscape(item.reason)} |`);
    }
  }

  const warnings = report.files.flatMap(file => file.warnings.map(warning => ({ file: file.path, ...warning })));
  if (warnings.length) {
    lines.push('', '## Review signals', '', '| File | Line | Rule | Excerpt |', '| --- | ---: | --- | --- |');
    for (const warning of warnings) {
      lines.push(`| ${mdEscape(warning.file)} | ${warning.line} | ${mdEscape(warning.id)} | ${mdEscape(warning.excerpt)} |`);
    }
  } else if (!report.unsupported.length) {
    lines.push('', '## Review signals', '', 'No configured N8 warning pattern matched.');
  }

  lines.push('');
  return lines.join('\n');
}

function parseArgs(argv) {
  const out = { root: process.cwd(), output: 'bitevo-precheck-output' };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!['--root', '--output'].includes(token)) throw new Error(`unsupported argument: ${token}`);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${token}`);
    out[token.slice(2)] = value;
    i += 1;
  }
  return out;
}

export async function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const root = path.resolve(args.root);
  const output = path.resolve(args.output);
  await mkdir(output, { recursive: true });

  try {
    const scannerSource = await readFile(path.join(root, 'public', 'pre-check-config-scan-r1.js'), 'utf8');
    const result = await scanRepository({ root, scannerSource });
    const summary = renderSummary(result.report);
    await writeFile(path.join(output, 'report.json'), JSON.stringify(result.report, null, 2) + '\n', 'utf8');
    await writeFile(path.join(output, 'summary.md'), summary, 'utf8');
    console.log(`BITEVO_PRECHECK_ACTION_R1=${result.report.status} files=${result.report.scanned_file_count} warnings=${result.report.warning_count} unsupported=${result.report.unsupported_count} network_requests=0 model_calls=0`);
    return result.exitCode;
  } catch (error) {
    const fallback = {
      schema: N23_SCHEMA,
      status: 'UNSUPPORTED_INPUT',
      scanner_schema: null,
      supported_basenames: N23_SUPPORTED_BASENAMES,
      scanned_file_count: 0,
      total_input_bytes: 0,
      warning_count: 0,
      stored_warning_count: 0,
      unsupported_count: 1,
      files: [],
      unsupported: [{ path: '.', reason: 'RUNNER_FAILURE', detail: safeMessage(error) }],
      boundary: buildBoundary(),
    };
    await writeFile(path.join(output, 'report.json'), JSON.stringify(fallback, null, 2) + '\n', 'utf8');
    await writeFile(path.join(output, 'summary.md'), renderSummary(fallback), 'utf8');
    console.error('BITEVO_PRECHECK_ACTION_R1=UNSUPPORTED_INPUT runner_failure=1');
    return 3;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exitCode = await runCli();
