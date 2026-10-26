import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const en=source('src/pages/start.astro');
const ru=source('src/pages/ru/start.astro');
const pricing=source('src/pages/pricing.astro');
const coverage=JSON.parse(source('src/data/bitevo-event-coverage.json'));
test('EN Company Twin follows existing approved price labels',()=>{
 for(const phrase of ['Company Twin','Free introduction · 30 minutes','Team Twin pilot · $3,000 fixed · 3 weeks','Company Twin · 12 months · from $9,000','support from $500 per month']){
  assert.ok(en.includes(phrase),phrase);
 }
 assert.match(en,/href: '\/company-twin'/);
 for(const phrase of ['Free introduction · 30 minutes','Team Twin · $3,000 fixed · 3 weeks','Company Twin · 12 months · from $9,000','Support from $500 per month']){
  assert.ok(pricing.includes(phrase),phrase+' absent from existing approved pricing');
 }
});
test('RU Company Twin route/prices do not add new claims',()=>{
 for(const phrase of ['Бесплатное знакомство · 30 минут','Team Twin — пилот $3,000 фикс, 3 недели','Company Twin — 12 месяцев от $9,000','поддержка от $500 в месяц','href="/ru/company-twin"']){
  assert.ok(ru.includes(phrase),phrase);
 }
 assert.ok(ru.includes('не бронирование встречи'));
});
test('R50/B1.2 source remains off',()=>{
 assert.equal(coverage.defaultMode,'disabled');
 assert.doesNotMatch(en+ru,/BITEVO_EVENT_COUNTER_ENABLED|BITEVO_R50_GRANT/);
});
