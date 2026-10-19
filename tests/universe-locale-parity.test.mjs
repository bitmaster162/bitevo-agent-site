import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  parseUniverseModules,
  compareUniverseCards,
  inspectUniverseNavigation,
} from '../scripts/verify-universe-locale-parity-r1.mjs';

const root = new URL('../', import.meta.url);
const [enSource, ruSource, layoutSource, ruLayoutSource] = await Promise.all([
  'src/pages/universe.astro',
  'src/pages/ru/universe.astro',
  'src/layouts/Layout.astro',
  'src/layouts/RuLayout.astro',
].map(path => readFile(new URL(path, root), 'utf8')));
const english = parseUniverseModules(enSource, 'EN');
const russian = parseUniverseModules(ruSource, 'RU');

function mutateCard(key, newValue) {
  const anchor = "name: 'AI Skill Lab',";
  const at = ruSource.indexOf(anchor);
  assert.ok(at >= 0, 'AI Skill Lab mutation anchor exists');
  const start = ruSource.lastIndexOf('  {', at);
  const end = ruSource.indexOf('  },', at);
  assert.ok(start >= 0 && end > at, 'AI Skill Lab card boundaries exist');
  const block = ruSource.slice(start, end);
  const regex = new RegExp('(^\\s*' + key + ':\\s*)(?:null|true|false|\'[^\']*\')', 'm');
  const changed = block.replace(regex, (_, prefix) => prefix + newValue);
  assert.notEqual(changed, block, 'mutation must alter ' + key);
  return ruSource.slice(0, start) + changed + ruSource.slice(end);
}

function namedFailures(ru) {
  try {
    return compareUniverseCards(english, parseUniverseModules(ru, 'RU')).failures;
  } catch (error) {
    return [String(error.message)];
  }
}

function expectNamedFailure(ru, card, field) {
  const failures = namedFailures(ru);
  assert.ok(failures.some(message =>
    message.includes('card=' + JSON.stringify(card) + ' field=' + field)),
  failures.join('\n'));
}

test('current six Universe cards have exact EN/RU lane, status, href, internal parity', () => {
  const result = compareUniverseCards(english, russian);
  assert.deepEqual(result.failures, []);
  assert.equal(result.matched.length, 6);
  assert.equal(new Set(result.matched).size, 6);
});

test('mismatched lane fails with named AI Skill Lab card', () => {
  expectNamedFailure(mutateCard('lane', "'ARENA'"), 'AI Skill Lab', 'lane');
});

test('mismatched status fails with named AI Skill Lab card', () => {
  expectNamedFailure(mutateCard('status', "'RELEASE PREP'"), 'AI Skill Lab', 'status');
});

test('LIVE card missing href fails with named AI Skill Lab card', () => {
  expectNamedFailure(mutateCard('href', 'null'), 'AI Skill Lab', 'href');
});

test('mismatched internal boolean fails with named AI Skill Lab card', () => {
  const source = mutateCard('internal', 'true').replace(
    "href: 'https://aiskillab.work'", "href: '/ru/build'");
  expectNamedFailure(source, 'AI Skill Lab', 'internal');
});

test('incorrect RU prefix for internal BitEvo href fails with its card name', () => {
  const source = ruSource.replace("href: '/ru/build',", "href: '/build',");
  assert.notEqual(source, ruSource);
  expectNamedFailure(source, 'BitEvo', 'href');
});

test('missing AI Skill Lab name triggers the exact missing EN card and unexpected RU card', () => {
  const errors = namedFailures(mutateCard('name', "'Other Product'"));
  assert.ok(errors.some(message => message.includes(
    'card="AI Skill Lab" field=presence expected="present in RU" actual="missing"')));
  assert.ok(errors.some(message => message.includes(
    'card="Other Product" field=presence expected="present in EN" actual="unexpected RU-only card"')));
});

test('duplicated RU name fails during parsing', () => {
  assert.throws(() => parseUniverseModules(
    ruSource.replace("name: 'AI Skill Lab'", "name: 'BitEvo'"), 'RU'),
    /UNIVERSE_CARD_PARITY=FAIL card="RU" field=name uniqueness/);
});

test('duplicated RU name fails also when comparing arrays directly', () => {
  const modified = russian.map((row, i) => i === 1 ? { ...row, name: 'BitEvo' } : row);
  const result = compareUniverseCards(english, modified);
  assert.ok(result.failures.some(x => x.includes('field=name uniqueness')));
});

test('a missing RU card fails with count, not just name parity', () => {
  const modified = ruSource.replace(
    /  \{\r?\n    lane: 'LEARN',[\s\S]*?^ {2}\},?\r?\n/m, '');
  assert.notEqual(modified, ruSource);
  assert.throws(() => parseUniverseModules(modified, 'RU'),
    /UNIVERSE_CARD_PARITY=FAIL card="RU" field=count/);
});

test('extra differently indented card cannot evade card count', () => {
  const modified = ruSource.replace(/\r?\n\];/, "\n    { lane: 'OTHER', name: 'SNEAK' }\n];");
  assert.notEqual(modified, ruSource);
  assert.throws(() => parseUniverseModules(modified, 'RU'),
    /UNIVERSE_CARD_PARITY=FAIL card="RU" field=modules/);
});

test('direct array comparison fails on a seventh card', () => {
  const result = compareUniverseCards(english,
    [...russian, { ...russian[1], name: 'Additional' }]);
  assert.ok(result.failures.some(x => x.includes('field=count')));
});

for (const literal of [
  "'javascript:alert(1)'", "'http://example.com'",
  "'/build'", "'ftp://example.com'", "'https://user:pass@example.com'",
]) {
  test('unsafe external href ' + literal + ' fails with card name', () => {
    expectNamedFailure(mutateCard('href', literal), 'AI Skill Lab', 'href');
  });
}

test('invalid external href on BOTH sides must not compare green', () => {
  const en = english.map(row => row.name === 'AI Skill Lab' ? { ...row, href: '/build' } : row);
  const ru = russian.map(row => row.name === 'AI Skill Lab' ? { ...row, href: '/build' } : row);
  assert.ok(compareUniverseCards(en, ru).failures.some(x =>
    x.includes('card="AI Skill Lab" field=href')));
});

test('internal true with null href on both sides cannot compare green', () => {
  const en = english.map(row => row.name === 'BitEvo' ? { ...row, href: null } : row);
  const ru = russian.map(row => row.name === 'BitEvo' ? { ...row, href: null } : row);
  assert.ok(compareUniverseCards(en, ru).failures.some(x =>
    x.includes('card="BitEvo" field=href')));
});

test('nonboolean internal literal cannot pass source parsing', () => {
  expectNamedFailure(mutateCard('internal', "'true'"), 'AI Skill Lab', 'internal');
});

test('empty status and null lane cannot pass source parsing', () => {
  expectNamedFailure(mutateCard('status', "''"), 'AI Skill Lab', 'status');
  expectNamedFailure(mutateCard('lane', 'null'), 'AI Skill Lab', 'lane');
});

test('current RU locale-bar asymmetry produces exactly one explicit FAIL', () => {
  const nav = inspectUniverseNavigation(layoutSource, ruLayoutSource, enSource);
  assert.ok(nav.observations.some(x =>
    x.includes('surface=GLOBAL_HEADER en=ABSENT ru=ABSENT')));
  assert.ok(nav.observations.some(x =>
    x.includes('surface=GLOBAL_FOOTER_BUILD en=/universe ru=/ru/universe')));
  assert.equal(nav.failures.length, 1, nav.failures.join('\n'));
  assert.match(nav.failures[0],
    /UNIVERSE_NAV_PARITY=FAIL name=Universe surface=LOCALE_BAR en=ABSENT ru=\/ru\/universe/);
});

test('equivalent EN locale-bar in common layout would remove the asymmetry', () => {
  const simulated = layoutSource +
    '\n<div class="en-locale-bar"><a href="/universe">Universe</a></div>\n';
  const nav = inspectUniverseNavigation(simulated, ruLayoutSource, enSource);
  assert.deepEqual(nav.failures, []);
});

test('ordinary EN body/footer link must NOT pretend to be an EN locale-bar', () => {
  const link = '\n<a href="/universe">Universe</a>\n';
  const nav1 = inspectUniverseNavigation(layoutSource, ruLayoutSource, enSource + link);
  const nav2 = inspectUniverseNavigation(layoutSource + link, ruLayoutSource, enSource);
  for (const nav of [nav1, nav2]) {
    assert.ok(nav.failures.some(x =>
      x.includes('surface=LOCALE_BAR en=ABSENT ru=/ru/universe')));
  }
});

test('RU locale-bar extra anchor attributes cannot mask its existing link', () => {
  const modified = ruLayoutSource.replace(
    '<a href="/ru/universe">Universe</a>',
    '<a class="nav-link" href="/ru/universe" aria-current="page"> Universe </a>');
  assert.notEqual(modified, ruLayoutSource);
  const nav = inspectUniverseNavigation(layoutSource, modified, enSource);
  assert.ok(nav.failures.some(x =>
    x.includes('surface=LOCALE_BAR en=ABSENT ru=/ru/universe')));
});

test('removing RU locale-bar link while EN is absent must NOT silently green', () => {
  const modified = ruLayoutSource.replace('href="/ru/universe"', 'href="/ru/other"');
  assert.notEqual(modified, ruLayoutSource);
  const nav = inspectUniverseNavigation(layoutSource, modified, enSource);
  assert.ok(nav.failures.some(x => x.includes('surface=LOCALE_BAR')));
});

test('footer Universe missing from both locales fails by exact surface', () => {
  const altered = layoutSource
    .replace("['BitEvo Universe', '/universe']", "['Other', '/other']")
    .replace("['BitEvo Universe', '/ru/universe']", "['Other', '/ru/other']");
  assert.notEqual(altered, layoutSource);
  const nav = inspectUniverseNavigation(altered, ruLayoutSource, enSource);
  assert.ok(nav.failures.some(x =>
    x.includes('surface=GLOBAL_FOOTER_BUILD en=ABSENT ru=ABSENT')));
});

test('RU-only footer Universe also fails', () => {
  const altered = layoutSource.replace(
    "['BitEvo Universe', '/universe']", "['Other', '/other']");
  const nav = inspectUniverseNavigation(altered, ruLayoutSource, enSource);
  assert.ok(nav.failures.some(x =>
    x.includes('surface=GLOBAL_FOOTER_BUILD')));
});

test('unparseable footer tuple cannot get a false PASS', () => {
  const altered = layoutSource.replace(
    "['BitEvo Universe', '/universe']", '["BitEvo Universe", "/universe"]');
  const nav = () => inspectUniverseNavigation(altered, ruLayoutSource, enSource);
  assert.throws(nav, /UNIVERSE_NAV_PARITY=FAIL.*unparsed-or-empty-links/);
});

test('unexpected EN layout shows named diagnostic in observations AND failures', () => {
  const altered = enSource.replace(
    "import Layout from '../layouts/Layout.astro';",
    "import Layout from '../layouts/UnknownLayout.astro';");
  assert.notEqual(altered, enSource);
  const nav = inspectUniverseNavigation(layoutSource, ruLayoutSource, altered);
  assert.ok(nav.failures.some(x => x.includes('surface=EN_LAYOUT')));
  assert.ok(nav.observations.some(x => x.includes('surface=EN_LAYOUT')));
});

test('GLOBAL_HEADER Universe only in EN fails, even if RU has no link', () => {
  const altered = layoutSource.replace(
    "['Build', '/build'],",
    "['Build', '/build'],\n  ['Universe', '/universe'],");
  const nav = inspectUniverseNavigation(altered, ruLayoutSource, enSource);
  assert.ok(nav.failures.some(x =>
    x.includes('surface=GLOBAL_HEADER en=/universe ru=ABSENT')));
});
