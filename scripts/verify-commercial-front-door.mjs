import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const read = rel => fs.readFileSync(path.join(distDir, rel), 'utf8');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const home = read('index.html');
const intake = read('audit-intake/index.html');
const start = read('start/index.html');
const ruHome = read('ru/index.html');
const ruStart = read('ru/start/index.html');

check(/<a[^>]*href="\/start"[^>]*data-funnel="home-primary"[^>]*>Choose the right scope/.test(home), 'home primary CTA must route to /start');
check(!/<a[^>]*href="\/mapper"[^>]*data-funnel="home-primary"[^>]*>Map one workflow/.test(home), 'old Mapper home-primary CTA must not survive build output');
check(/<a class="header-cta" href="\/start"[^>]*>Start here/.test(home), 'English header CTA must route to /start');
check(/<a class="mobile-cta" href="\/start"[^>]*>Start here →<\/a>/.test(home), 'English mobile CTA must route to /start');

check(start.includes('$1,500 Entry Audit'), '/start must retain Entry Audit path');
check(start.includes('MCP / Tool Governance'), '/start must retain MCP path');
check(start.includes('$3,000 BUILD Workflow Exception Diagnostic'), '/start must retain BUILD path');
check(start.includes('$4,900 Primary Audit'), '/start must retain Primary Audit path');
check(start.includes('The public site does not authorize testing.'), '/start must retain no-testing boundary');

check(/<a class="button button-ghost" data-scope-handoff href="mailto:robert@bitevo\.work\?subject=BitEvo%20scope%20review">Contact Robert<\/a>/.test(intake), 'audit intake must expose explicit manual human handoff');
check(intake.includes('nothing is sent automatically'), 'audit intake must state that the handoff does not auto-send');
check(intake.includes('Copy or download the reviewed brief first'), 'audit intake must keep review-before-share instruction');
check(intake.includes('Testing authorization: NOT GRANTED by this form.'), 'audit intake must retain explicit authorization boundary');
check(!intake.includes('mailto:robert@bitevo.work?subject=BitEvo%20scope%20review&body='), 'scope brief must not be auto-embedded into mailto body');

check(/<a class="header-cta" href="\/ru\/start"[^>]*>Начать/.test(ruHome), 'RU header CTA must route to /ru/start');
check(/<a class="mobile-cta" href="\/ru\/start"[^>]*>Начать →<\/a>/.test(ruHome), 'RU mobile CTA must route to /ru/start');
check(ruHome.includes('href="/ru/start"') && ruHome.includes('Выбрать формат'), 'RU home primary commercial CTA must route to /ru/start');
check(!/<a class="header-cta" href="\/ru\/mapper"[^>]*>/.test(ruHome), 'old RU Mapper header CTA must not survive R5 build output');
check(ruHome.includes('href="/ru/mapper"'), 'RU product layer must retain a visible Mapper path after moving the commercial front door');
check(ruStart.includes('Free / 20 минут'), '/ru/start must retain Free triage path');
check(ruStart.includes('$1,500'), '/ru/start must retain Entry price marker');
check(ruStart.includes('$4,900'), '/ru/start must retain Primary price marker');
check(ruStart.includes('testing authorization'), '/ru/start must retain no-testing boundary');

if (failures.length) {
  console.error(`COMMERCIAL_FRONT_DOOR_GATE=FAIL failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('COMMERCIAL_FRONT_DOOR_GATE=PASS en_home_start=1 en_header_start=1 en_mobile_start=1 ru_home_start=1 ru_header_start=1 ru_mobile_start=1 ru_mapper_visible=1 manual_handoff=1 auto_send=0 authorization_boundary=PASS');
