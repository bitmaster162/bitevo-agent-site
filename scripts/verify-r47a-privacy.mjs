import { isExactGuide3Successor } from './guide3-route-successor-r1.mjs';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const read = path => readFile(join(root, path), 'utf8');
const html = route => readFile(join(dist, route.replace(/^\//, ''), 'index.html'), 'utf8');
let checks = 0;
const check = (ok, message) => { assert.ok(ok, message); checks++; };

const [registry, coverage, wrangler, vercel, sitemap, currentness, enSource, ruSource, enHtml, ruHtml, layout] = await Promise.all([
  read('src/data/public-route-registry.json').then(JSON.parse),
  read('src/data/bitevo-event-coverage.json').then(JSON.parse),
  read('wrangler.jsonc').then(JSON.parse),
  read('vercel.json').then(JSON.parse),
  readFile(join(dist, 'sitemap.xml'), 'utf8'),
  read('src/data/sitemap-currentness.json').then(JSON.parse),
  read('src/pages/privacy.astro'),
  read('src/pages/ru/privacy.astro'),
  html('/privacy'),
  html('/ru/privacy'),
  read('src/layouts/Layout.astro')
]);

check(registry.schema === 'bitevo.public-route-registry/v1' && registry.routes.length === (isExactGuide3Successor() ? 147 : 145), 'R47A noindex pair retained with B2 route pair');
for (const [path, locale, parent, built, source] of [
  ['/privacy', 'en', '/security', enHtml, enSource],
  ['/ru/privacy', 'ru', '/ru/security', ruHtml, ruSource]
]) {
  const route = registry.routes.find(row => row.path === path);
  check(route?.locale === locale && route?.parent === parent && route?.category === 'INTERNAL_NO_INDEX'
    && route.indexable === false && route.state === 'disclosure_review', path + ': reviewed noindex registry entry');
  check(source.includes('robots="noindex, follow"'), path + ': noindex source');
  check(built.includes('<meta name="robots" content="noindex, follow">'), path + ': noindex static HTML');
  check(built.includes('rel="canonical" href="https://bitevo.work' + path + '"'), path + ': canonical');
  for (const [lang, alt] of [['en', '/privacy'], ['ru', '/ru/privacy']]) {
    check(built.includes('hreflang="' + lang + '" href="https://bitevo.work' + alt + '"'), path + ': reciprocal ' + lang);
  }
  check([...built.matchAll(/<h1\b/gi)].length === 1, path + ': one H1');
  check(!sitemap.includes('<loc>https://bitevo.work' + path + '</loc>'), path + ': absent from sitemap pending owner review');
  check(!currentness.routes.some(row => row.path === path), path + ': absent from indexed currentness');
  for (const event of ['triage_click','mailto_click','scope_generated','pilot_click']) {
    check(built.includes(event), path + ': event meaning present: ' + event);
  }
  check(built.includes('robert@bitevo.work'), path + ': correct commercial contact');
}

const enDraft = 'When the BitEvo first-party event counter is activated, it counts clicks on triage booking links, email links and pilot links, as well as local scope-brief generation. Only the date, event type, page, language and aggregate count are stored in the counter table. Contact details, form or scope-brief contents, cookies and IP addresses are not stored in that table. A recorded event does not confirm that an email was sent, an appointment was booked or a service was purchased.';
const ruDraft = 'При активированном счётчике BitEvo учитывает нажатия на ссылки записи на triage, email-ссылки и ссылки пилота, а также факт локальной генерации scope-brief. В агрегированной таблице сохраняются только дата, тип события, страница, язык и количество событий. Контактные данные, содержимое формы или scope-brief, cookies и IP-адреса в эту таблицу не записываются. Зафиксированное событие не подтверждает отправку письма, бронирование встречи или оплату услуги.';
check(enSource.includes(enDraft) && enHtml.includes(enDraft), 'reviewed EN disclosure draft byte text');
check(ruSource.includes(ruDraft) && ruHtml.includes(ruDraft), 'reviewed RU disclosure draft byte text');
check(enHtml.includes('the BitEvo first-party event counter is OFF'), 'EN OFF statement');
check(ruHtml.includes('счётчик событий BitEvo ВЫКЛЮЧЕН'), 'RU OFF statement');
check(enHtml.includes('No retention period for event aggregates is approved by this page.'), 'EN aggregate retention unapproved');
check(ruHtml.includes('Эта страница не устанавливает срок хранения агрегатов событий.'), 'RU aggregate retention unapproved');
check(enHtml.includes('Infrastructure logs may be processed by Vercel, Cloudflare') && ruHtml.includes('могут обрабатывать инфраструктурные логи'), 'provider log caveat both locales');
check(enHtml.includes('That period is not an event-counter retention rule.') && ruHtml.includes('Этот срок не переносится автоматически на счётчик событий.'), '30-day site scope retention not borrowed for event data');
check(!enHtml.includes('your data is not used to train AI models') && !ruHtml.includes('ваши данные не используются для обучения AI-моделей'), 'unverified model training claims absent');
check(layout.includes("['Site data & events', '/privacy']") && layout.includes("['Данные сайта и счётчик', '/ru/privacy']"), 'both shared footer routes');
check(coverage.schema === 'bitevo.event-coverage/v1' && coverage.defaultMode === 'disabled', 'event counter default OFF');
check(coverage.routes.length === 24 && coverage.routes.reduce((n, row) => n + row.events.length, 0) === 31, 'reviewed OFF 24 pages / 31 pairs unchanged');
// R48 admits exactly the owner-reviewed configuration; this is not live activation evidence.
check(JSON.stringify(wrangler.d1_databases) === JSON.stringify([{
  binding: 'BITEVO_EVENT_DB',
  database_name: 'bitevo-events-b12',
  database_id: 'b533a76e-ddd0-406b-9449-94e878bc2c50'
}]), 'R48: exact D1 binding only');
check(JSON.stringify(wrangler.ratelimits) === JSON.stringify([{
  name: 'BITEVO_EVENT_RATE_LIMITER',
  namespace_id: '1001',
  simple: { limit: 10, period: 60 }
}]), 'R48: exact 10/60 limiter only');
check(JSON.stringify(wrangler.vars) === JSON.stringify({
  BITEVO_EVENT_COUNTER_RECEIVER_ENABLED: 'true'
}), 'R48: receiver flag only; report and secrets absent');
check(Object.keys(wrangler).join(',') === '$schema,name,compatibility_date,main,workers_dev,assets,d1_databases,ratelimits,vars',
  'R48: no unrelated configuration keys');
check(!JSON.stringify(vercel).includes('BITEVO_EVENT_COUNTER_ENABLED'), 'Vercel activation not configured');
check(currentness.routes.length === (isExactGuide3Successor() ? 135 : 133), 'original 133 indexed routes preserved');
check((sitemap.match(/<loc>/g) || []).length === (isExactGuide3Successor() ? 135 : 133), 'sitemap still 133 indexable routes');

async function walk(dir) {
  const output = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) output.push(...await walk(path));
    else if (entry.isFile() && path.endsWith('.html')) output.push(path);
  }
  return output;
}
const htmlFiles = await walk(dist);
check(htmlFiles.length === 150, 'R47A should add exactly two HTML pages');
const standaloneWithoutSharedFooter = new Set([
  'concierge/index.html',
  'site-agent-copilot-lab/index.html',
  'site-agent-fleet-desk/index.html',
  'site-agent-lab/index.html'
]);
let footerEn = 0, footerRu = 0, standalone = 0;
for (const file of htmlFiles) {
  const source = await readFile(file, 'utf8');
  const ru = /<html\b[^>]*lang="ru"/i.test(source);
  const link = ru ? 'href="/ru/privacy"' : 'href="/privacy"';
  const short = relative(dist, file).replaceAll(String.fromCharCode(92), '/');
  if (standaloneWithoutSharedFooter.has(short)) {
    check(!source.includes('class="site-footer"') && !source.includes(link),
      file + ': reviewed standalone page remains outside shared-footer scope');
    standalone++;
  } else {
    check(source.includes('class="site-footer"'), file + ': expected shared footer');
    check(source.includes(link), file + ': locale-correct privacy footer link');
    if (ru) footerRu++; else footerEn++;
  }
  check(!source.includes('data-bitevo-events="enabled"'), file + ': event client remains OFF');
}
check(standalone === 4 && footerEn + footerRu === 146,
  'exact four reviewed standalone exceptions and 146 shared footers');

// R47A-F3: distinguish B1.2 OFF from separate analytics and describe processing
// before aggregation. These checks add to the prior 487 checks, not replace them.
const f3ChecksStart = checks;
let f3NegativeCases = 0;
const f3Disclosure = {
  "en": {
    "heading": "B1.2 event counting is OFF",
    "intro": "It does not claim live B1.2 event collection, a verified production B1.2 database, or a complete legal privacy policy.",
    "analytics": "The OFF status described here applies to the BitEvo B1.2 event counter. The site separately includes Vercel Web Analytics for page-view statistics. That integration and provider infrastructure logs are outside the five-column B1.2 aggregate table and are not disabled by the B1.2 switch. This notice does not claim that all website analytics or infrastructure logging is disabled.",
    "processing": "Under the described design, only after B1.2 is separately activated, the Vercel handler reads the request IP address, derives an HMAC token and sends that token to the Cloudflare Worker together with a request ID, event time and event fields. The Worker uses the token as a rate-limit key. Only the day, event type, page, language and count are written to the B1.2 aggregate table; the token and request ID are not written to that table. This table boundary is not a claim that providers perform no other processing or immediately delete all related data."
  },
  "ru": {
    "heading": "Счётчик событий B1.2 выключен",
    "intro": "Здесь описана проверенная схема счётчика, а не работающий сбор событий B1.2, подтверждённая production-база B1.2 или полная юридическая политика обработки данных.",
    "analytics": "Указанный здесь статус OFF относится к счётчику событий BitEvo B1.2. Сайт отдельно подключает Vercel Web Analytics для статистики просмотров страниц. Эта интеграция и инфраструктурные логи провайдеров не ограничиваются пятью колонками агрегированной таблицы B1.2 и не отключаются переключателем B1.2. Эта страница не утверждает, что вся аналитика сайта или инфраструктурное журналирование отключены.",
    "processing": "В описанной схеме, только после отдельного включения B1.2, обработчик на Vercel получает IP-адрес запроса, вычисляет HMAC-токен и передаёт его Cloudflare Worker вместе с идентификатором запроса, временем и полями события. Worker использует токен как ключ ограничения частоты запросов. В агрегированную таблицу B1.2 записываются только день, тип события, страница, язык и счётчик; токен и идентификатор запроса в эту таблицу не записываются. Эта граница таблицы не означает, что провайдеры не выполняют другую обработку или немедленно удаляют все связанные данные."
  }
};
const f3Text = value => value.replace(/\s+/g, ' ').trim();
function hasF3Disclosure(value, locale) {
  const expected = f3Disclosure[locale];
  const normalized = f3Text(value);
  return Object.entries(expected).every(([key, text]) => normalized.includes(
    f3Text(key === 'heading' ? '<h2>' + text + '</h2>' : text)
  ));
}
for (const [locale, source, built] of [['en', enSource, enHtml], ['ru', ruSource, ruHtml]]) {
  check(hasF3Disclosure(source, locale), locale + ': F3 source disclosure complete');
  check(hasF3Disclosure(built, locale), locale + ': F3 rendered disclosure complete');
  for (const [key, text] of Object.entries(f3Disclosure[locale])) {
    const anchor = key === 'heading' ? '<h2>' + text + '</h2>' : text;
    const changed = source.replace(anchor, '');
    check(changed !== source, locale + ': F3 negative anchor exists: ' + key);
    check(!hasF3Disclosure(changed, locale), locale + ': F3 rejects removed ' + key);
    f3NegativeCases++;
  }
  const boundaries = locale === 'en' ? [
    ['separate analytics', 'Vercel Web Analytics', 'unidentified analytics'],
    ['activation gate', 'only after B1.2 is separately activated, ', ''],
    ['provider transfer', 'sends that token to the Cloudflare Worker', 'does not send the token to another provider'],
    ['request metadata', 'a request ID, event time and event fields', 'event fields only'],
    ['limiter processing', 'The Worker uses the token as a rate-limit key.', ''],
    ['no deletion guarantee', 'This table boundary is not a claim that providers perform no other processing or immediately delete all related data.', 'Providers immediately delete all related data.']
  ] : [
    ['separate analytics', 'Vercel Web Analytics', 'неназванную аналитику'],
    ['activation gate', 'только после отдельного включения B1.2, ', ''],
    ['provider transfer', 'передаёт его Cloudflare Worker', 'не передаёт его другому провайдеру'],
    ['request metadata', 'с идентификатором запроса, временем и полями события', 'только с полями события'],
    ['limiter processing', 'Worker использует токен как ключ ограничения частоты запросов.', ''],
    ['no deletion guarantee', 'Эта граница таблицы не означает, что провайдеры не выполняют другую обработку или немедленно удаляют все связанные данные.', 'Провайдеры немедленно удаляют все связанные данные.']
  ];
  for (const [label, before, after] of boundaries) {
    const changed = source.replace(before, after);
    check(changed !== source, locale + ': F3 mutation anchor exists: ' + label);
    check(!hasF3Disclosure(changed, locale), locale + ': F3 rejects weakening: ' + label);
    f3NegativeCases++;
  }
}
check(layout.includes('<script defer src="/_vercel/insights/script.js"></script>'),
  'F3 separately configured Vercel integration stays distinct from B1.2 OFF');
console.log('R47A_F3_CONTENT_GATE=PASS locales=2 added_checks=' + (checks - f3ChecksStart)
  + ' negative_cases=' + f3NegativeCases + ' runtime_changes=0');

console.log('R47A_PRIVACY_LOCAL_GATE=PASS checks=' + checks + ' html=' + htmlFiles.length
  + ' noindex=2 sitemap=133 drafts=EN_RU_APPROVAL_PENDING telemetry=OFF'
  + ' footer_en=' + footerEn + ' footer_ru=' + footerRu + ' provider_writes=0');
