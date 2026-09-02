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
  homePrimary: 0,
  scopeHandoff: 0
};

const headerOld = '<a class="header-cta" href="/mapper">Map workflow <span aria-hidden="true">↗</span></a>';
const headerNew = '<a class="header-cta" href="/start">Start here <span aria-hidden="true">↗</span></a>';
const mobileOld = '<a class="mobile-cta" href="/mapper">Map workflow →</a>';
const mobileNew = '<a class="mobile-cta" href="/start">Start here →</a>';
const homeOld = '<a href="/mapper" class="button button-primary" data-funnel="home-primary">Map one workflow <span aria-hidden="true">↗</span></a>';
const homeNew = '<a href="/start" class="button button-primary" data-funnel="home-primary">Choose the right scope <span aria-hidden="true">↗</span></a>';
const downloadMarker = '<button id="download" type="button" class="button button-ghost" disabled>Download .txt</button>';
const contactButton = '<a class="button button-ghost" data-scope-handoff href="mailto:robert@bitevo.work?subject=BitEvo%20scope%20review">Contact Robert</a>';
const gateMarker = '</div><div class="gate"><span>AUTHORIZATION GATE</span>';
const handoffNote = '</div><p class="brief-explain" data-scope-handoff-note>Email opens your mail app; nothing is sent automatically. Copy or download the reviewed brief first, then share only the scope details you intend to send.</p><div class="gate"><span>AUTHORIZATION GATE</span>';

for (const file of htmlFiles) {
  let html = fs.readFileSync(file, 'utf8');
  const original = html;
  const rel = path.relative(distDir, file).replaceAll(path.sep, '/');
  const isEnglish = /<html\b[^>]*\blang="en"/.test(html);

  if (isEnglish) {
    if (html.includes(headerOld)) {
      html = html.replaceAll(headerOld, headerNew);
      counters.englishHeader += 1;
    }
    if (html.includes(mobileOld)) {
      html = html.replaceAll(mobileOld, mobileNew);
      counters.englishMobile += 1;
    }
  }

  if (rel === 'index.html' && html.includes(homeOld)) {
    html = html.replace(homeOld, homeNew);
    counters.homePrimary += 1;
  }

  if (rel === 'audit-intake/index.html' && !html.includes('data-scope-handoff')) {
    if (!html.includes(downloadMarker) || !html.includes(gateMarker)) {
      throw new Error('Audit intake handoff markers changed; refusing silent postprocess drift.');
    }
    html = html.replace(downloadMarker, `${downloadMarker}${contactButton}`);
    html = html.replace(gateMarker, handoffNote);
    counters.scopeHandoff += 1;
  }

  if (html !== original) fs.writeFileSync(file, html);
}

if (counters.englishHeader === 0 || counters.englishMobile === 0 || counters.homePrimary !== 1 || counters.scopeHandoff !== 1) {
  throw new Error(`Commercial front-door postprocess incomplete: ${JSON.stringify(counters)}`);
}

console.log(`COMMERCIAL_FRONT_DOOR_POSTPROCESS=PASS english_header=${counters.englishHeader} english_mobile=${counters.englishMobile} home_primary=${counters.homePrimary} scope_handoff=${counters.scopeHandoff}`);
