import { appendFile } from 'node:fs/promises';

const SLOT_MINUTES = 30;
const SLOT_MS = SLOT_MINUTES * 60 * 1000;
const workflowFile = 'public-uptime-monitor.yml';

function slotFor(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('invalid slot time');
  const startMs = Math.floor(date.getTime() / SLOT_MS) * SLOT_MS;
  const start = new Date(startMs);
  const stamp = start.toISOString().replace(/[-:]/g, '').replace('.000Z', 'Z');
  return {
    start,
    key: `public-monitor-slot-${stamp}`,
  };
}

async function writeOutput(name, value) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) return;
  await appendFile(output, `${name}=${value}\n`, 'utf8');
}

async function loadArtifacts() {
  const fixture = process.env.PUBLIC_MONITOR_ARTIFACTS_JSON;
  if (fixture !== undefined) return JSON.parse(fixture);

  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) {
    throw new Error('GITHUB_REPOSITORY missing or invalid');
  }

  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'bitevo-public-monitor-slot-gate',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(
    `https://api.github.com/repos/${repository}/actions/artifacts?per_page=100`,
    { headers, signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok) throw new Error(`artifact list HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const now = process.env.PUBLIC_MONITOR_SLOT_NOW || new Date().toISOString();
  const slot = slotFor(now);
  let shouldRun = true;
  let state = 'RUN';
  let artifactsSeen = 0;

  try {
    const payload = await loadArtifacts();
    const artifacts = Array.isArray(payload?.artifacts) ? payload.artifacts : [];
    artifactsSeen = artifacts.length;
    const exists = artifacts.some(artifact =>
      artifact?.name === slot.key && artifact?.expired !== true
    );
    if (exists) {
      shouldRun = false;
      state = 'SKIP';
    }
  } catch (error) {
    state = 'FAIL_OPEN';
    console.error(`PUBLIC_MONITOR_SLOT_GATE_WARNING=${error.message}`);
  }

  await writeOutput('should_run', shouldRun ? 'true' : 'false');
  await writeOutput('slot_key', slot.key);
  await writeOutput('slot_start', slot.start.toISOString());
  await writeOutput('gate_state', state);

  console.log(
    `PUBLIC_MONITOR_SLOT_GATE=${state} should_run=${shouldRun ? 'true' : 'false'} slot=${slot.key} artifacts_seen=${artifactsSeen} cadence_minutes=${SLOT_MINUTES}`,
  );
  return 0;
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll('\\', '/')}`) {
  process.exit(await main());
}

export { slotFor };
