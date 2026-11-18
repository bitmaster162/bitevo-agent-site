import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { twinIntroEmails } from '../src/data/twin-intro-emails.mjs';

for (const [locale, drafts] of Object.entries(twinIntroEmails)) {
  test(`${locale}: Twin email drafts carry the chosen scope to Robert`, () => {
    const subjects = new Set();
    for (const [intent, link] of Object.entries(drafts)) {
      const url = new URL(link);
      assert.equal(url.protocol, 'mailto:');
      assert.equal(url.pathname, 'robert@bitevo.work');
      const subject = url.searchParams.get('subject');
      const body = url.searchParams.get('body');
      assert.ok(subject && body);
      assert.match(body, /30/);
      if (intent === 'team') assert.match(subject, /Team Twin/);
      if (intent === 'company') assert.match(subject, /Company Twin/);
      subjects.add(subject);
    }
    assert.equal(subjects.size, 3);
  });

  for (const page of ['pricing', 'company-twin']) {
    test(`${locale} ${page}: both Twin offer cards link to their own draft`, () => {
      const prefix = locale === 'ru' ? 'ru/' : '';
      const source = readFileSync(new URL(`../src/pages/${prefix}${page}.astro`, import.meta.url), 'utf8');
      const cards = [...source.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)].map(([card]) => card);
      for (const [intent, title] of [['team', 'Team Twin'], ['company', 'Company Twin']]) {
        assert.ok(cards.some(card => card.includes(title) && card.includes(`href={twinIntroEmails.${locale}.${intent}}`)), title);
      }
      assert.ok(source.includes(`href={twinIntroEmails.${locale}.intro}`));
    });
  }
}
