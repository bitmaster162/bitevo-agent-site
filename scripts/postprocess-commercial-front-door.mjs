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

const ruPricingTemplateHtml = fs.readFileSync(path.join(distDir, 'ru', 'pricing', 'index.html'), 'utf8');
const ruScopeTemplateMatch = ruPricingTemplateHtml.match(/<section id="send-scope" class="section section-rule scope-short-section" hidden data-scope-short-section>[\s\S]*?<\/section><link rel="stylesheet" href="\/scope-handoff-short\.css"><script src="\/scope-handoff-r1\.js"[^>]*><\/script>/);
if (!ruScopeTemplateMatch) throw new Error('RU P27.1 short-scope rendered template missing from /ru/pricing');
const ruTriageScopeTemplate = ruScopeTemplateMatch[0].replace('data-scope-offer="pricing"', 'data-scope-offer="triage"');

const counters = {
  englishHeader: 0,
  englishMobile: 0,
  russianHeader: 0,
  russianMobile: 0,
  homePrimary: 0,
  russianHomePrimary: 0,
  scopeHandoff: 0,
  offerHandoffPages: 0
};

const headerPattern = /<a class="header-cta" href="\/mapper"([^>]*)>Map workflow <span([^>]*)>↗<\/span><\/a>/g;
const mobilePattern = /<a class="mobile-cta" href="\/mapper"([^>]*)>Map workflow →<\/a>/g;
const ruHeaderPattern = /<a class="header-cta" href="\/ru\/mapper"([^>]*)>Собрать workflow <span([^>]*)>↗<\/span><\/a>/g;
const ruMobilePattern = /<a class="mobile-cta" href="\/ru\/mapper"([^>]*)>Собрать workflow →<\/a>/g;
const TRIAGE_HREF = 'https://cal.com/robert-dumanyan-vlck0x/free-20-minute-triage';
const homeTriageMarker = 'data-triage-source="home-en"';
const ruHomeTriageMarker = 'data-triage-source="home-ru"';
const ruHomeSourcePrimaryPattern = /<a class="button button-primary" href="\/ru\/mapper"([^>]*)>Собрать карту workflow <span([^>]*)>↗<\/span><\/a>/;
const ruHomeSourceSecondaryPattern = /<a class="button" href="\/ru\/agent-authority-audit"([^>]*)>Посмотреть аудит<\/a>/;
const ruProductPathNeedle = 'Сначала локально сформируйте Authority Ledger и Evidence Contract, затем сравните checkpoints, найдите unresolved gates и только после этого готовьте written scope.';
const downloadPattern = /<button id="download" type="button" class="button button-ghost" disabled([^>]*)>Download \.txt<\/button>/;
const gatePattern = /<\/div><div class="gate"([^>]*)><span([^>]*)>AUTHORIZATION GATE<\/span>/;
const contactButton = '<a class="button button-ghost" data-scope-handoff href="mailto:robert@bitevo.work?subject=BitEvo%20scope%20review">Contact Robert</a>';
const entryAuditReviewHref = 'mailto:robert@bitevo.work?subject=BitEvo%20Agent%20Authority%20Entry%20Audit%20scope%20review';
const controlValidationReviewHref = 'mailto:robert@bitevo.work?subject=BitEvo%20Security%20Control%20Validation%20scope%20review';
const primaryAuditReviewHref = 'mailto:robert@bitevo.work?subject=BitEvo%20Primary%20Agent%20Authority%20Audit%20scope%20review';
const buildQualificationHref = 'mailto:robert@bitevo.work?subject=BUILD%20workflow%20diagnostic%20qualification';
const offerHandoffTargets = new Map([
  ['entry-audit/index.html', { anchorText: 'Prepare the bounded scope', href: entryAuditReviewHref, label: 'Contact Robert' }],
  ['control-validation/index.html', { anchorText: 'Scope one control boundary', href: controlValidationReviewHref, label: 'Contact Robert' }],
  ['agent-authority-audit/index.html', { anchorText: 'Prepare Primary Audit scope', href: primaryAuditReviewHref, label: 'Contact Robert' }],
  ['ru/entry-audit/index.html', { anchorText: 'Подготовить scope', href: entryAuditReviewHref, label: 'Связаться с Робертом' }],
  ['ru/control-validation/index.html', { anchorText: 'Описать control boundary', href: controlValidationReviewHref, label: 'Связаться с Робертом' }],
  ['ru/agent-authority-audit/index.html', { anchorText: 'Подготовить Primary scope ↗', href: primaryAuditReviewHref, label: 'Связаться с Робертом' }],
  ['ru/build/exception-workflow-diagnostic/index.html', { anchorText: 'Открыть Build', href: buildQualificationHref, label: 'Связаться с Робертом' }]
]);

const injectOfferHandoff = (html, rel, target) => {
  const marker = `data-offer-handoff href="${target.href}"`;
  if (html.includes(marker)) return html;
  const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    .filter(match => match[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().includes(target.anchorText));
  if (anchors.length !== 1) throw new Error(`Offer handoff anchor drift on ${rel}: expected 1, got ${anchors.length}`);
  const anchor = anchors[0][0];
  const button = `<a class="button button-ghost" data-offer-handoff href="${target.href}">${target.label}</a>`;
  const updated = html.replace(anchor, `${anchor} ${button}`);
  if (!updated.includes(marker)) throw new Error(`Offer handoff injection failed on ${rel}`);
  return updated;
};

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

  if (rel === 'index.html') {
    const count = html.split(homeTriageMarker).length - 1;
    if (count !== 1 || !html.includes(`href="${TRIAGE_HREF}"`) || !html.includes('Book a free 20-minute triage')) {
      throw new Error('EN home triage CTA drift');
    }
    const startMarker = 'data-funnel="home-primary"';
    if (!html.includes(startMarker)) {
      html = html.replace(/<a class="header-cta" href="\/start"([^>]*)>/, '<a class="header-cta" href="/start" data-funnel="home-primary"$1>');
    }
    if (!html.includes(startMarker)) throw new Error('EN home /start funnel compatibility marker missing');
    counters.homePrimary += 1;
  }

  if (rel === 'ru/index.html') {
    const primary = html.match(ruHomeSourcePrimaryPattern);
    const secondary = html.match(ruHomeSourceSecondaryPattern);
    if (!primary || !secondary) throw new Error('RU home source CTA drift before P29.1 postprocess');

    html = html.replace(
      ruHomeSourcePrimaryPattern,
      (_full, anchorAttrs, spanAttrs) => `<a class="button button-primary" href="${TRIAGE_HREF}" data-triage-click="true" data-triage-source="home-ru"${anchorAttrs}>Записаться на бесплатный разбор, 20 минут <span${spanAttrs}>↗</span></a>`
    );
    html = html.replace(
      ruHomeSourceSecondaryPattern,
      (_full, anchorAttrs) => `<a class="button" href="#send-scope"${anchorAttrs}>Отправить короткий scope</a>`
    );

    const signalSection = html.match(/<section class="section-tight section-rule"[^>]*>/);
    if (!signalSection) throw new Error('RU home signal section marker missing for short-scope injection');
    html = html.replace(signalSection[0], `${ruTriageScopeTemplate}${signalSection[0]}`);

    if (!html.includes(ruProductPathNeedle)) throw new Error('RU product-path copy drift');
    html = html.replace(ruProductPathNeedle, `${ruProductPathNeedle} <a class="text-link" href="/ru/start">Выбрать формат →</a>`);

    if (!html.includes('src="/triage-click.js"')) {
      html = html.replace('</body>', '<script src="/triage-click.js"></script></body>');
    }

    const count = html.split(ruHomeTriageMarker).length - 1;
    if (count !== 1 || !html.includes(`href="${TRIAGE_HREF}"`) || !html.includes('Записаться на бесплатный разбор, 20 минут')) {
      throw new Error('RU home triage CTA drift after P29.1 postprocess');
    }
    if (!html.includes('data-scope-offer="triage"') || !html.includes('id="send-scope"')) {
      throw new Error('RU home P27.1 short-scope injection failed');
    }
    counters.russianHomePrimary += 1;
  }

  const offerTarget = offerHandoffTargets.get(rel);
  if (offerTarget) {
    html = injectOfferHandoff(html, rel, offerTarget);
    counters.offerHandoffPages += 1;
  }

  if (rel === 'audit-intake/index.html') {
    const manualHandoffMarker = 'data-scope-handoff href="mailto:robert@bitevo.work';
    if (!html.includes(manualHandoffMarker)) {
      const downloadMatch = html.match(downloadPattern);
      const gateMatch = html.match(gatePattern);
      if (!downloadMatch || !gateMatch) {
        throw new Error('Audit intake handoff markers changed; refusing silent postprocess drift.');
      }

      html = html.replace(downloadPattern, match => `${match}${contactButton}`);
      html = html.replace(gatePattern, (_full, gateAttrs, spanAttrs) => `</div><p class="brief-explain" data-scope-handoff-note>Email opens your mail app; nothing is sent automatically. Copy or download the reviewed brief first, then share only the scope details you intend to send.</p><div class="gate"${gateAttrs}><span${spanAttrs}>AUTHORIZATION GATE</span>`);
    }
    if (!html.includes(manualHandoffMarker)) throw new Error('Audit intake manual handoff marker missing after postprocess.');
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
  counters.scopeHandoff !== 1 ||
  counters.offerHandoffPages !== offerHandoffTargets.size
) {
  throw new Error(`Commercial front-door postprocess incomplete: ${JSON.stringify(counters)}`);
}

console.log(`COMMERCIAL_FRONT_DOOR_POSTPROCESS=PASS english_header=${counters.englishHeader} english_mobile=${counters.englishMobile} russian_header=${counters.russianHeader} russian_mobile=${counters.russianMobile} home_primary=${counters.homePrimary} ru_home_primary=${counters.russianHomePrimary} scope_handoff=${counters.scopeHandoff} offer_handoff_pages=${counters.offerHandoffPages}`);
