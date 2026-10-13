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

check(registry.schema === 'bitevo.public-route-registry/v1' && registry.routes.length === 143, 'R47A two-route registry extension only');
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
check(coverage.routes.length === 24 && coverage.routes.reduce((n, row) => n + row.events.length, 0) === 30, 'reviewed OFF 24 pages / 30 pairs unchanged');
check(!('d1_databases' in wrangler) && !('vars' in wrangler), 'no production D1 binding or activation config added');
check(!JSON.stringify(vercel).includes('BITEVO_EVENT_COUNTER_ENABLED'), 'Vercel activation not configured');
check(currentness.routes.length === 131, 'original 131 indexed routes preserved');
check((sitemap.match(/<loc>/g) || []).length === 131, 'sitemap still 131 indexable routes');

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
check(htmlFiles.length === 148, 'R47A should add exactly two HTML pages');
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
check(standalone === 4 && footerEn + footerRu === 144,
  'exact four reviewed standalone exceptions and 144 shared footers');
console.log('R47A_PRIVACY_LOCAL_GATE=PASS checks=' + checks + ' html=' + htmlFiles.length
  + ' noindex=2 sitemap=131 drafts=EN_RU_APPROVAL_PENDING telemetry=OFF'
  + ' footer_en=' + footerEn + ' footer_ru=' + footerRu + ' provider_writes=0');
