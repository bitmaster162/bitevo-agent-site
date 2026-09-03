import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');

if (!fs.existsSync(distDir)) {
  throw new Error(`Missing build output: ${distDir}`);
}

const htmlFiles = [];
const walk = dir => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(full);
  }
};
walk(distDir);

const counters = {
  englishHeader: 0,
  englishMobile: 0,
  russianHeader: 0,
  russianMobile: 0,
  homePrimary: 0,
  russianHomePrimary: 0,
  scopeHandoff: 0
};

const headerPattern = /<a class="header-cta" href="\/mapper"([^>]*)>Map workflow <span([^>]*)>↗<\/span><\/a>/g;
const mobilePattern = /<a class="mobile-cta" href="\/mapper"([^>]*)>Map workflow →<\/a>/g;
const ruHeaderPattern = /<a class="header-cta" href="\/ru\/mapper"([^>]*)>Собрать workflow <span([^>]*)>↗<\/span><\/a>/g;
const ruMobilePattern = /<a class="mobile-cta" href="\/ru\/mapper"([^>]*)>Собрать workflow →<\/a>/g;
const homePattern = /<a href="\/mapper" class="button button-primary" data-funnel="home-primary"([^>]*)>Map one workflow <span([^>]*)>↗<\/span><\/a>/;
const ruHomePattern = /<a class="button button-primary" href="\/ru\/mapper"([^>]*)>Собрать карту workflow <span([^>]*)>↗<\/span><\/a>/;
const downloadPattern = /<button id="download" type="button" class="button button-ghost" disabled([^>]*)>Download \.txt<\/button>/;
const gatePattern = /<\/div><div class="gate"([^>]*)><span([^>]*)>AUTHORIZATION GATE<\/span>/;
const contactButton = '<a class="button button-ghost" data-scope-handoff href="mailto:robert@bitevo.work?subject=BitEvo%20scope%20review">Contact Robert</a>';

for (const file of htmlFiles) {
  let html = fs.readFileSync(file, 'utf8');
  const original = html;
  const rel = path.relative(distDir, file).replaceAll(path.sep, '/');
  const isEnglish = /<html\b[^>]*\blang="en"/.test(html);
  const isRussian = /<html\b[^>]*\blang="ru"/.test(html);

  if (isEnglish) {
    const headerMatches = [...html.matchAll(headerPattern)];
    if (headerMatches.length) {
      html = html.replace(headerPattern, (_full, anchorAttrs, spanAttrs) => `<a class="header-cta" href="/start"${anchorAttrs}>Start here <span${spanAttrs}>↗</span></a>`);
      counters.englishHeader += headerMatches.length;
    }

    const mobileMatches = [...html.matchAll(mobilePattern)];
    if (mobileMatches.length) {
      html = html.replace(mobilePattern, (_full, anchorAttrs) => `<a class="mobile-cta" href="/start"${anchorAttrs}>Start here →</a>`);
      counters.englishMobile += mobileMatches.length;
    }
  }

  if (isRussian) {
    const headerMatches = [...html.matchAll(ruHeaderPattern)];
    if (headerMatches.length) {
      html = html.replace(ruHeaderPattern, (_full, anchorAttrs, spanAttrs) => `<a class="header-cta" href="/ru/start"${anchorAttrs}>Начать <span${spanAttrs}>↗</span></a>`);
      counters.russianHeader += headerMatches.length;
    }

    const mobileMatches = [...html.matchAll(ruMobilePattern)];
    if (mobileMatches.length) {
      html = html.replace(ruMobilePattern, (_full, anchorAttrs) => `<a class="mobile-cta" href="/ru/start"${anchorAttrs}>Начать →</a>`);
      counters.russianMobile += mobileMatches.length;
    }
  }

  if (rel === 'index.html' && homePattern.test(html)) {
    homePattern.lastIndex = 0;
    html = html.replace(homePattern, (_full, anchorAttrs, spanAttrs) => `<a href="/start" class="button button-primary" data-funnel="home-primary"${anchorAttrs}>Choose the right scope <span${spanAttrs}>↗</span></a>`);
    counters.homePrimary += 1;
  }

  if (rel === 'ru/index.html' && ruHomePattern.test(html)) {
    ruHomePattern.lastIndex = 0;
    html = html.replace(ruHomePattern, (_full, anchorAttrs, spanAttrs) => `<a class="button button-primary" href="/ru/start"${anchorAttrs}>Выбрать формат <span${spanAttrs}>↗</span></a>`);
    counters.russianHomePrimary += 1;
  }

  if (rel === 'audit-intake/index.html' && !html.includes('data-scope-handoff')) {
    const downloadMatch = html.match(downloadPattern);
    const gateMatch = html.match(gatePattern);
    if (!downloadMatch || !gateMatch) {
      throw new Error('Audit intake handoff markers changed; refusing silent postprocess drift.');
    }

    html = html.replace(downloadPattern, match => `${match}${contactButton}`);
    html = html.replace(gatePattern, (_full, gateAttrs, spanAttrs) => `</div><p class="brief-explain" data-scope-handoff-note>Email opens your mail app; nothing is sent automatically. Copy or download the reviewed brief first, then share only the scope details you intend to send.</p><div class="gate"${gateAttrs}><span${spanAttrs}>AUTHORIZATION GATE</span>`);
    counters.scopeHandoff += 1;
  }

  if (html !== original) fs.writeFileSync(file, html);
}

if (
  counters.englishHeader === 0 ||
  counters.englishMobile === 0 ||
  counters.russianHeader === 0 ||
  counters.russianMobile === 0 ||
  counters.homePrimary !== 1 ||
  counters.russianHomePrimary !== 1 ||
  counters.scopeHandoff !== 1
) {
  throw new Error(`Commercial front-door postprocess incomplete: ${JSON.stringify(counters)}`);
}

console.log(`COMMERCIAL_FRONT_DOOR_POSTPROCESS=PASS english_header=${counters.englishHeader} english_mobile=${counters.englishMobile} russian_header=${counters.russianHeader} russian_mobile=${counters.russianMobile} home_primary=${counters.homePrimary} ru_home_primary=${counters.russianHomePrimary} scope_handoff=${counters.scopeHandoff}`);
