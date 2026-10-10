import fs from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';

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
  const primaryRequiredTags = html.match(/<(?:input|textarea|select)\b[^>]*data-primary-required[^>]*>/gi) || [];
  const serverRequiredPrimary = primaryRequiredTags.filter(tag => /\srequired(?:\s|\/?>)/i.test(tag.replace(/"[^"]*"|'[^']*'/g, '')));
  check(serverRequiredPrimary.length === 0, `${locale}: Primary-only fields must not be server-rendered required`);
  check(html.includes('/intake-segmentation.js'), `${locale}: local segmentation controller missing`);
  check(html.includes('Testing authorization: NOT GRANTED'), `${locale}: explicit authorization boundary missing`);
  check(/data-scope-handoff(?:="")? href="mailto:robert@bitevo\.work/.test(html), `${locale}: manual Contact Robert handoff missing`);
  check(html.includes('mailto:robert@bitevo.work?subject=BitEvo%20scope%20review'), `${locale}: exact manual mailto route missing`);
  check(!html.includes('mailto:robert@bitevo.work?subject=BitEvo%20scope%20review&body='), `${locale}: generated brief must not be embedded in mailto body`);
  const readinessBase = locale === 'RU' ? '/ru/audit/proposal-readiness' : '/audit/proposal-readiness';
  check(html.includes('data-proposal-readiness'), `${locale}: proposal-readiness handoff missing`);
  check(html.includes(`href="${readinessBase}"`), `${locale}: generic proposal-readiness fallback missing`);
  const intakeId = locale === 'RU' ? 'ruIntake' : 'audit-intake';
  const form = [...html.matchAll(/<form\b[^>]*>/gi)].map(match => match[0]).find(tag => tag.includes('id="' + intakeId + '"')) || '';
  check(/\bmethod="post"/i.test(form) && !/\baction\s*=/i.test(form), locale + ': method post and no action');
  const submit = (html.match(/<button\b[^>]*\bdata-js-local-submit\b[^>]*>/i) || [])[0] || '';
  check(/\bdisabled\b/.test(submit) && /\btype="submit"/.test(submit), locale + ': SSR submit disabled');
  const fallback = (html.match(/<p\b[^>]*\bdata-js-local-fallback\b[^>]*>/i) || [])[0] || '';
  check(/\brole="status"/.test(fallback) && !/\bhidden\b/.test(fallback), locale + ': SSR JS warning visible');
  check(!/api\.telegram\.org|t\.me\//i.test(html), `${locale}: Telegram transfer must not exist`);
}

for (const [locale, sourcePath] of [['EN', 'src/pages/audit-intake.astro'], ['RU', 'src/pages/ru/audit-intake.astro']]) {
  const source = fs.readFileSync(path.resolve(sourcePath), 'utf8');
  check(source.includes("form.getAttribute('method')") && source.includes("!form.hasAttribute('action')"), locale + ': activation checks POST and no action');
  check(source.indexOf("addEventListener('submit'") >= 0 && source.indexOf("addEventListener('submit'") < source.indexOf('localSubmit.disabled'), locale + ': listener before enable');
  check(source.indexOf("addEventListener('reset'") >= 0 && source.indexOf("addEventListener('reset'") < source.indexOf('localSubmit.disabled'), locale + ': reset before enable');
  check(source.includes('localFallback.hidden') && source.includes('localSubmit.disabled'), locale + ': disabled SSR, enabled JS');
  check(source.includes("form.dataset.segReady === '1'") ||
        source.includes("form.dataset.segReady==='1'"),
        locale + ': generator enables submit only after segmentation readiness');
  check(source.indexOf('form.dataset.segReady') < source.indexOf('localSubmit.disabled'),
        locale + ': segmentation ready gate must precede activation');
}
const controller = fs.readFileSync(path.resolve('public/intake-segmentation.js'), 'utf8');

// Reproduce the original classic-script/deferred-module event ordering.
// Every generated brief is recreated on submit; annotation must run afterwards.
const verifyFirstSubmit = (locale, queryOffer, expectedDepth, expectedOffer, readyState) => {
  const formHandlers = [];
  const docHandlers = new Map();
  const brief = { value: '' };
  const submit = { childNodes: [{ textContent: '' }] };
  const form = {
    dataset: {},
    checkValidity: () => true,
    querySelector: selector => selector === 'button[type="submit"]' ? submit : null,
    addEventListener: (event, callback) => {
      if (event === 'submit') formHandlers.push(callback);
    },
  };
  const depthButtons = ['entry', 'primary'].map(intakeMode => ({
    dataset: { intakeMode },
    setAttribute: () => {},
    addEventListener: () => {},
    classList: { toggle: () => {} },
  }));
  const primaryBlock = { hidden: true };
  const primaryField = { required: false };
  const state = { textContent: '' };
  const handoff = { href: '' };
  const readiness = { href: '' };
  const root = {
    dataset: {},
    getAttribute: name => name === 'data-intake-locale' ? locale : null,
    querySelector: selector => ({
      form,
      '[data-intake-mode-state]': state,
      '[data-segmented-brief]': brief,
    })[selector] ?? null,
    querySelectorAll: selector => ({
      '[data-intake-mode]': depthButtons,
      '[data-primary-only]': [primaryBlock, { hidden: true }, { hidden: true }],
      '[data-primary-required]': [primaryField, { required: false }, { required: false }, { required: false }, { required: false }, { required: false }],
    })[selector] ?? [],
  };
  const document = {
    readyState,
    querySelector: selector => ({
      '[data-intake-segmentation]': root,
      '[data-scope-handoff]': handoff,
      '[data-proposal-readiness]': readiness,
    })[selector] ?? null,
    addEventListener: (event, callback) => docHandlers.set(event, callback),
  };
  const generator = () => {
    brief.value = 'SCOPE BRIEF\nOWNER DECISION\nR7 SYNTHETIC TEST NO SECRETS\nTesting authorization: NOT GRANTED';
  };
  if (readyState !== 'loading') formHandlers.push(generator);
  runInNewContext(controller, {
    document,
    window: { location: { search: queryOffer ? '?offer=' + encodeURIComponent(queryOffer) : '' } },
    URLSearchParams,
    encodeURIComponent,
  }, { timeout: 1500 });
  if (readyState === 'loading') {
    // Deferred Astro module installs the generator before DOMContentLoaded.
    formHandlers.push(generator);
    const ready = docHandlers.get('DOMContentLoaded');
    check(typeof ready === 'function', locale + ': DOMContentLoaded marker listener missing');
    ready?.();
  }
  check(form.dataset.segReady === '1',
        locale + ': segmentation readiness missing after controller setup');
  check(root.dataset.intakeDepth === expectedDepth, locale + ': wrong depth ' + queryOffer);
  check(primaryBlock.hidden === (expectedDepth !== 'primary'), locale + ': Primary block visibility changed');
  check(primaryField.required === (expectedDepth === 'primary'), locale + ': required-field gating changed');
  check(formHandlers.length === 2, locale + ': expected exactly two submit listeners');
  if (queryOffer === 'nonsense-untrusted-offer') {
    check(!root.dataset.offerIntent, locale + ': unknown offer accepted');
  }
  for (let n = 0; n < 2; n++) {
    for (const callback of formHandlers) callback();
    const lines = brief.value.split('\n');
    const depths = lines.filter(line => line.startsWith('INTAKE DEPTH:'));
    const offers = lines.filter(line => line.startsWith('OFFER INTENT:'));
    const suffix = ' on submit ' + (n + 1) + ' for ' + (queryOffer ?? 'default') + ' readyState=' + readyState;
    check(depths.length === 1 && depths[0].startsWith('INTAKE DEPTH: ' + expectedDepth.toUpperCase()),
      locale + ': missing/duplicate depth marker' + suffix);
    if (expectedOffer) {
      check(offers.length === 1 && offers[0].startsWith('OFFER INTENT: ' + expectedOffer + ' '),
        locale + ': missing/duplicate allowlisted offer marker' + suffix);
    } else {
      check(offers.length === 0, locale + ': unexpected offer marker' + suffix);
    }
    check(brief.value.includes('Testing authorization: NOT GRANTED'), locale + ': no-testing boundary missing' + suffix);
  }
};
const markerVariants = [
  [null, 'entry', null],
  ['entry-audit', 'entry', 'entry-audit'],
  ['security-control-validation', 'entry', 'security-control-validation'],
  ['primary-agent-authority-audit', 'primary', 'primary-agent-authority-audit'],
  ['nonsense-untrusted-offer', 'entry', null],
];
for (const locale of ['en', 'ru']) {
  for (const [offer, depth, acceptedOffer] of markerVariants) {
    for (const readyState of ['loading', 'complete']) {
      verifyFirstSubmit(locale, offer, depth, acceptedOffer, readyState);
    }
  }
}

for (const forbidden of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'FormData(']) {
  check(!controller.includes(forbidden), `controller must not contain network primitive ${forbidden}`);
}
check(controller.includes("offer?.depth ?? 'entry'"), 'queryless/unknown offer must fall back to Entry depth');
check(controller.includes("field.required = mode === 'primary'"), 'Primary-only required fields must be activated only at Primary depth');
check(controller.includes('INTAKE DEPTH:'), 'generated brief must record selected intake depth');
check(controller.includes("form.dataset.segReady = '1'"),
  'controller must publish positive readiness after it initializes its listeners');
check(controller.indexOf("form?.addEventListener('reset'") < controller.indexOf("form.dataset.segReady = '1'"),
  'controller readiness must be published after reset handler setup');
check(controller.includes("const registerSubmissionMarkers = () => form?.addEventListener('submit', () => {"),
  'marker handler must be registered only by readiness gate');
check(controller.includes("document.addEventListener('DOMContentLoaded', registerSubmissionMarkers, { once: true })"),
  'defer marker listener until module scripts have registered generator listeners');
check(controller.includes('else registerSubmissionMarkers();'),
  'marker listener must initialize when DOMContentLoaded has already passed');
check(!controller.includes('queueMicrotask('), 'microtask sequencing does not solve the submit-listener ordering race');
check(controller.includes('new URLSearchParams(window.location.search)'), 'offer intent must be derived only from the local URL query');
for (const offer of ['entry-audit', 'security-control-validation', 'primary-agent-authority-audit']) {
  check(controller.includes(`'${offer}'`), `allowlisted offer intent missing: ${offer}`);
}
for (const subject of ['BitEvo Agent Authority Entry Audit scope review', 'BitEvo Security Control Validation scope review', 'BitEvo Primary Agent Authority Audit scope review']) {
  check(controller.includes(subject), `offer-specific handoff subject missing: ${subject}`);
}
check(controller.includes('OFFER INTENT:'), 'generated brief must preserve selected offer intent');
check(controller.includes('encodeURIComponent(offer.subject)'), 'offer-specific subject must be encoded locally');
check(controller.includes("proposalReadinessBase = locale === 'ru' ? '/ru/audit/proposal-readiness' : '/audit/proposal-readiness'"), 'localized proposal-readiness base route missing');
check(controller.includes('encodeURIComponent(offer.key)'), 'proposal-readiness query must preserve only the allowlisted offer key');
check(controller.includes('proposalReadiness.href = offer'), 'proposal-readiness handoff must branch on validated offer intent');
check(!controller.includes('&body='), 'offer-aware handoff must never embed the generated brief in mailto body');

if (failures.length) {
  console.error(`INTAKE_SEGMENTATION_GATE=FAIL failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('INTAKE_SEGMENTATION_GATE=PASS locales=2 entry_default=1 primary_full=1 offer_allowlist=3 offer_intent_brief=1 proposal_readiness_handoff=PASS local_only=1 manual_handoff=1 auto_transfer=0 authorization_boundary=PASS');
