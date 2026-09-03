import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('dist');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const pages = [
  ['EN', 'audit-intake/index.html'],
  ['RU', 'ru/audit-intake/index.html']
];

for (const [locale, rel] of pages) {
  const html = read(rel);
  check(html.includes('data-intake-segmentation'), `${locale}: segmentation root missing`);
  check(html.includes('data-intake-mode="entry"'), `${locale}: Entry selector missing`);
  check(html.includes('data-intake-mode="primary"'), `${locale}: Primary selector missing`);
  check((html.match(/data-primary-only/g) || []).length >= 3, `${locale}: progressive-disclosure blocks missing`);
  check((html.match(/data-primary-required/g) || []).length >= 6, `${locale}: Primary required-field contract too shallow`);
  check(html.includes('/intake-segmentation.js'), `${locale}: local segmentation controller missing`);
  check(html.includes('Testing authorization: NOT GRANTED'), `${locale}: explicit authorization boundary missing`);
  check(html.includes('data-scope-handoff'), `${locale}: manual Contact Robert handoff missing`);
  check(html.includes('mailto:robert@bitevo.work?subject=BitEvo%20scope%20review'), `${locale}: exact manual mailto route missing`);
  check(!html.includes('mailto:robert@bitevo.work?subject=BitEvo%20scope%20review&body='), `${locale}: generated brief must not be embedded in mailto body`);
  check(!/<form[^>]+(?:action|method)=/i.test(html), `${locale}: form must remain browser-local without action/method`);
  check(!/api\.telegram\.org|t\.me\//i.test(html), `${locale}: Telegram transfer must not exist`);
}

const controller = fs.readFileSync(path.resolve('public/intake-segmentation.js'), 'utf8');
for (const forbidden of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'FormData(']) {
  check(!controller.includes(forbidden), `controller must not contain network primitive ${forbidden}`);
}
check(controller.includes("apply('entry')"), 'Entry must be the default first-step depth');
check(controller.includes("field.required = mode === 'primary'"), 'Primary-only required fields must be activated only at Primary depth');
check(controller.includes('INTAKE DEPTH:'), 'generated brief must record selected intake depth');

if (failures.length) {
  console.error(`INTAKE_SEGMENTATION_GATE=FAIL failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('INTAKE_SEGMENTATION_GATE=PASS locales=2 entry_default=1 primary_full=1 local_only=1 manual_handoff=1 auto_transfer=0 authorization_boundary=PASS');
