import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/agent-incidents.css', import.meta.url), 'utf8');
const mobile = css.slice(css.indexOf('@media(max-width:900px){'), css.indexOf('@media(max-width:680px){'));
const hasShrinkSafeGrid = (value) => /\.incident-card\{grid-template-columns:minmax\(0,1fr\)\}/.test(value);
const hasMinContentWrap = (value) => /\.incident-main,\.incident-evidence\{min-width:0;overflow-wrap:anywhere\}/.test(value);

test('RU/EN incident cards shrink and wrap on 320/375/390px viewports', () => {
  assert.ok(mobile.startsWith('@media(max-width:900px){'), 'responsive rule exists');
  for (const width of [320, 375, 390]) {
    assert.ok(width <= 900, width + 'px must enter mobile media query');
    assert.ok(hasShrinkSafeGrid(mobile), width + 'px grid min-content can exceed viewport');
    assert.ok(hasMinContentWrap(mobile), width + 'px long labels must wrap anywhere');
  }
});

test('regression guard rejects 1fr min-content and break-word substitutions', () => {
  assert.equal(hasShrinkSafeGrid(mobile.replace('minmax(0,1fr)', '1fr')), false);
  assert.equal(hasMinContentWrap(mobile.replace('overflow-wrap:anywhere', 'overflow-wrap:break-word')), false);
});

test('both locales load the same shrink-safe stylesheet', () => {
  const en = readFileSync(new URL('../src/pages/agent-incidents.astro', import.meta.url), 'utf8');
  const ru = readFileSync(new URL('../src/pages/ru/agent-incidents.astro', import.meta.url), 'utf8');
  assert.match(en, /import '..\/styles\/agent-incidents\.css';/);
  assert.match(ru, /import '..\/..\/styles\/agent-incidents\.css';/);
});
