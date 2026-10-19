import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = new URL('../', import.meta.url);
const cardFields = ['lane', 'status', 'href', 'internal'];
const expectedCardCount = 6;
const cardBlockPattern = /^ {2}\{\r?\n([\s\S]*?)^ {2}\},?\r?$/gm;

const fail = (name, field, expected, actual) =>
  'UNIVERSE_CARD_PARITY=FAIL card=' + JSON.stringify(name) +
  ' field=' + field + ' expected=' + JSON.stringify(expected) +
  ' actual=' + JSON.stringify(actual);

function parseField(block, name, field) {
  const rows = block.split(/\r?\n/).filter(line =>
    new RegExp('^\\s*' + field + '\\s*:').test(line));
  if (rows.length !== 1) {
    throw new Error(fail(name, field, 'one literal', rows.length + ' declarations'));
  }
  const value = rows[0].trim().slice(field.length + 1).trim().replace(/,$/, '').trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  const literal = /^'([^'\\]*)'$/.exec(value);
  if (!literal) throw new Error(fail(name, field, 'quoted literal | boolean | null', value));
  return literal[1];
}

function validInternalPath(href, locale) {
  if (typeof href !== 'string') return false;
  const pattern = locale === 'RU'
    ? /^\/ru\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/
    : /^\/(?!ru(?:\/|$))[a-z0-9-]+(?:\/[a-z0-9-]+)*$/;
  return pattern.test(href);
}

function validExternalUrl(href) {
  if (typeof href !== 'string' || href !== href.trim() || !href.startsWith('https://')) {
    return false;
  }
  try {
    const parsed = new URL(href);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname) &&
      parsed.username === '' && parsed.password === '';
  } catch {
    return false;
  }
}

function cardValidationFailures(card, locale) {
  const name = typeof card?.name === 'string' && card.name.trim() ? card.name : locale;
  const failures = [];
  for (const field of ['name', 'lane', 'status']) {
    const value = card?.[field];
    if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
      failures.push(fail(name, field, 'nonempty trimmed string', value));
    }
  }
  if (typeof card?.internal !== 'boolean') {
    failures.push(fail(name, 'internal', 'boolean', card?.internal));
  } else if (card.internal === true && !validInternalPath(card.href, locale)) {
    failures.push(fail(name, 'href', locale === 'RU' ? '/ru/path' : '/path', card.href));
  } else if (card.internal === false) {
    if (card.href !== null && !validExternalUrl(card.href)) {
      failures.push(fail(name, 'href', 'HTTPS URL or null', card.href));
    }
    if (card.href === null && typeof card.status === 'string' && card.status.startsWith('LIVE')) {
      failures.push(fail(name, 'href', 'HTTPS URL required for LIVE status', card.href));
    }
  }
  return failures;
}

export function parseUniverseModules(source, locale) {
  if (locale !== 'EN' && locale !== 'RU') {
    throw new Error(fail(locale, 'locale', 'EN or RU', locale));
  }
  const declaration = /\bconst modules\s*=\s*\[([\s\S]*?)\r?\n\];/.exec(source);
  if (!declaration) throw new Error(fail(locale, 'modules', 'array declaration', 'absent'));
  const blocks = [...declaration[1].matchAll(cardBlockPattern)].map(match => match[1]);
  const unparsed = declaration[1].replace(cardBlockPattern, '').replace(/[\s,]/g, '');
  if (unparsed) throw new Error(fail(locale, 'modules', 'all card syntax parsed', unparsed.slice(0, 80)));
  if (blocks.length !== expectedCardCount) {
    throw new Error(fail(locale, 'count', expectedCardCount, blocks.length));
  }
  const rows = blocks.map((block, index) => {
    const name = parseField(block, locale + '#' + (index + 1), 'name');
    const row = { name };
    for (const field of cardFields) row[field] = parseField(block, name, field);
    const failures = cardValidationFailures(row, locale);
    if (failures.length) throw new Error(failures.join('\n'));
    return row;
  });
  const names = new Set(rows.map(row => row.name));
  if (names.size !== expectedCardCount) {
    throw new Error(fail(locale, 'name uniqueness', expectedCardCount, names.size));
  }
  return rows;
}

export function compareUniverseCards(en, ru) {
  const failures = [];
  const matched = [];
  for (const [locale, rows] of [['EN', en], ['RU', ru]]) {
    if (!Array.isArray(rows)) {
      failures.push(fail(locale, 'cards', 'array', typeof rows));
      continue;
    }
    if (rows.length !== expectedCardCount) {
      failures.push(fail(locale, 'count', expectedCardCount, rows.length));
    }
    const names = new Set(rows.map(card => card?.name));
    if (names.size !== rows.length) {
      failures.push(fail(locale, 'name uniqueness', rows.length, names.size));
    }
    for (const row of rows) failures.push(...cardValidationFailures(row, locale));
  }
  if (failures.length) return { matched, failures };
  const enNames = new Set(en.map(card => card.name));
  const ruByName = new Map(ru.map(card => [card.name, card]));
  for (const enCard of en) {
    const ruCard = ruByName.get(enCard.name);
    if (!ruCard) {
      failures.push(fail(enCard.name, 'presence', 'present in RU', 'missing'));
      continue;
    }
    const issuesBefore = failures.length;
    for (const field of ['lane', 'status', 'internal']) {
      if (ruCard[field] !== enCard[field]) {
        failures.push(fail(enCard.name, field, enCard[field], ruCard[field]));
      }
    }
    const expectedRuHref = enCard.internal ? '/ru' + enCard.href : enCard.href;
    if (ruCard.href !== expectedRuHref) {
      failures.push(fail(enCard.name, 'href', expectedRuHref, ruCard.href));
    }
    if (failures.length === issuesBefore) matched.push(enCard.name);
  }
  for (const ruCard of ru) {
    if (!enNames.has(ruCard.name)) {
      failures.push(fail(ruCard.name, 'presence', 'present in EN', 'unexpected RU-only card'));
    }
  }
  return { matched, failures };
}

function dualNav(source, declaration) {
  const pattern = new RegExp('const ' + declaration + ' = isRu \\? \\[([\\s\\S]*?)\\] : \\[([\\s\\S]*?)\\];');
  const match = pattern.exec(source);
  if (!match) throw new Error('UNIVERSE_NAV_PARITY=FAIL name=Universe surface=' +
    declaration + ' reason=missing-exact-layout-declaration');
  function links(block, locale) {
    const tuple = /\[\s*'([^']+)',\s*'([^']+)'\s*\]\s*,?/g;
    const found = [...block.matchAll(tuple)].map(result => ({ label: result[1], href: result[2] }));
    const unparsed = block.replace(tuple, '').replace(/\s/g, '');
    if (found.length === 0 || unparsed) {
      throw new Error('UNIVERSE_NAV_PARITY=FAIL name=Universe surface=' +
        declaration + ' locale=' + locale + ' reason=unparsed-or-empty-links');
    }
    return found;
  }
  return { ru: links(match[1], 'RU'), en: links(match[2], 'EN') };
}

function localeBarUniverseHref(source, className) {
  const open = /<div\b[^>]*\bclass="([^"]*)"[^>]*>/g;
  const bars = [...source.matchAll(open)].filter(match =>
    match[1].split(/\s+/).includes(className));
  if (bars.length === 0) return 'ABSENT';
  if (bars.length !== 1) return 'DUPLICATE';
  const tail = source.slice(bars[0].index + bars[0][0].length);
  const close = tail.indexOf('</div>');
  if (close < 0) return 'INVALID';
  const scoped = tail.slice(0, close);
  const anchors = [...scoped.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>\s*Universe\s*<\/a>/g)];
  if (anchors.length === 0) return 'INVALID';
  if (anchors.length !== 1) return 'DUPLICATE';
  return anchors[0][1];
}

export function inspectUniverseNavigation(layoutSource, ruLayoutSource, enPageSource) {
  const failures = [];
  const observations = [];
  for (const [declaration, surface, wantedEn, wantedRu] of [
    ['nav', 'GLOBAL_HEADER', 'ABSENT', 'ABSENT'],
    ['footerBuild', 'GLOBAL_FOOTER_BUILD', '/universe', '/ru/universe'],
  ]) {
    const pair = dualNav(layoutSource, declaration);
    const ru = pair.ru.filter(row => row.label.includes('Universe') || row.href === '/ru/universe');
    const en = pair.en.filter(row => row.label.includes('Universe') || row.href === '/universe');
    const actualRu = ru.length === 1 ? ru[0].href : ru.length === 0 ? 'ABSENT' : 'DUPLICATE';
    const actualEn = en.length === 1 ? en[0].href : en.length === 0 ? 'ABSENT' : 'DUPLICATE';
    const matched = actualEn === wantedEn && actualRu === wantedRu;
    const diagnostic = 'UNIVERSE_NAV_PARITY=' + (matched ? 'PASS' : 'FAIL') +
      ' name=Universe surface=' + surface + ' en=' + actualEn + ' ru=' + actualRu;
    observations.push(diagnostic);
    if (!matched) failures.push(diagnostic);
  }
  const enUsesCommonLayout = /import Layout from '\.\.\/layouts\/Layout\.astro';/.test(enPageSource)
    && /<Layout\b/.test(enPageSource);
  const layoutDiagnostic = 'UNIVERSE_NAV_PARITY=' + (enUsesCommonLayout ? 'PASS' : 'FAIL') +
    ' name=Universe surface=EN_LAYOUT reason=' +
    (enUsesCommonLayout ? 'common-layout' : 'unexpected-layout');
  observations.push(layoutDiagnostic);
  if (!enUsesCommonLayout) failures.push(layoutDiagnostic);

  // Compare only actual locale-bar surfaces. Generic body/footer links never count as locale-bar parity.
  const ruValue = localeBarUniverseHref(ruLayoutSource, 'ru-locale-bar');
  const enValue = localeBarUniverseHref(enPageSource, 'en-locale-bar');
  const localeMatched = ruValue === '/ru/universe' && enValue === '/universe';
  const localeDiagnostic = 'UNIVERSE_NAV_PARITY=' + (localeMatched ? 'PASS' : 'FAIL') +
    ' name=Universe surface=LOCALE_BAR en=' + enValue + ' ru=' + ruValue;
  observations.push(localeDiagnostic);
  if (!localeMatched) failures.push(localeDiagnostic);
  return { observations, failures };
}

export async function runUniverseLocaleParity() {
  const files = [
    'src/pages/universe.astro',
    'src/pages/ru/universe.astro',
    'src/layouts/Layout.astro',
    'src/layouts/RuLayout.astro',
  ];
  const [enSource, ruSource, layoutSource, ruLayoutSource] =
    await Promise.all(files.map(file => readFile(new URL(file, root), 'utf8')));
  const en = parseUniverseModules(enSource, 'EN');
  const ru = parseUniverseModules(ruSource, 'RU');
  const cards = compareUniverseCards(en, ru);
  for (const name of cards.matched) console.log('UNIVERSE_CARD_PARITY=PASS card=' + JSON.stringify(name));
  for (const message of cards.failures) console.error(message);
  console.log('UNIVERSE_CARD_PARITY_SUMMARY=' + (cards.failures.length ? 'FAIL' : 'PASS') +
    ' matched=' + cards.matched.length + ' expected=' + expectedCardCount +
    ' failures=' + cards.failures.length);
  const navigation = inspectUniverseNavigation(layoutSource, ruLayoutSource, enSource);
  for (const message of navigation.observations) {
    (message.includes('=FAIL') ? console.error : console.log)(message);
  }
  console.log('UNIVERSE_LOCALE_PARITY=' +
    (cards.failures.length || navigation.failures.length ? 'FAIL' : 'PASS') +
    ' card_failures=' + cards.failures.length + ' nav_failures=' + navigation.failures.length +
    ' files_read=4 network=0 mutations=0');
  if (cards.failures.length || navigation.failures.length) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runUniverseLocaleParity().catch(error => {
    console.error(String(error?.message ?? error));
    process.exitCode = 1;
  });
}
