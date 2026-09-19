import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const failures = [];
const checks = [];
const check = (label, ok) => { checks.push(label); if (!ok) failures.push(label); };
const ru404Path = join(root, 'dist', 'ru', '404.html');
const en404Path = join(root, 'dist', '404.html');
const [ru404, en404, vercel, wrangler] = await Promise.all([
  readFile(ru404Path, 'utf8'),
  readFile(en404Path, 'utf8'),
  readFile(join(root, 'vercel.json'), 'utf8').then(JSON.parse),
  readFile(join(root, 'wrangler.jsonc'), 'utf8').then(JSON.parse)
]);

check('ru404 lang=ru', /<html\b[^>]*\blang="ru"/i.test(ru404));
check('ru404 noindex', /<meta\b[^>]*name="robots"[^>]*content="noindex, follow"/i.test(ru404));
check('ru404 canonical', ru404.includes('rel="canonical" href="https://bitevo.work/ru/404"'));
check('ru404 og:url', ru404.includes('property="og:url" content="https://bitevo.work/ru/404"'));
check('ru404 Russian title', ru404.includes('<title>404 — Страница не найдена | BitEvo</title>'));
check('ru404 Russian content', ru404.includes('Маршрут не найден') && ru404.includes('По этому адресу нет доступной страницы.'));
check('ru404 RU navigation', ru404.includes('href="/ru/doctrine"') && ru404.includes('href="/ru/pricing"') && ru404.includes('href="/ru/mapper"'));
check('ru404 RU actions', ru404.includes('href="/ru"') && ru404.includes('href="/ru/agent-authority-audit"') && ru404.includes('href="/ru/guides"'));
check('ru404 has no hreflang', !/hreflang=/i.test(ru404));
check('en404 remains lang=en', /<html\b[^>]*\blang="en"/i.test(en404));
check('en404 remains canonical /404', en404.includes('rel="canonical" href="https://bitevo.work/404"'));

const routes = Array.isArray(vercel.routes) ? vercel.routes : [];
const filesystemIndex = routes.findIndex(route => route?.handle === 'filesystem');
const ruFallbackIndex = routes.findIndex(route => route?.src === '/ru(?:/.*)?' && route?.status === 404 && route?.dest === '/ru/404');
check('vercel filesystem phase exists', filesystemIndex >= 0);
check('vercel RU 404 fallback exists', ruFallbackIndex >= 0);
check('vercel RU fallback after filesystem', filesystemIndex >= 0 && ruFallbackIndex > filesystemIndex);
check('vercel RU fallback is scoped', routes.filter(route => Number(route?.status) === 404).every(route => route?.src === '/ru(?:/.*)?'));
check('cloudflare 404-page retained', wrangler.assets?.not_found_handling === '404-page');
check('cloudflare nearest RU 404 artifact exists', ru404.length > 0);

if (failures.length) {
  console.error(`LOCALIZED_404_VERIFY=FAIL checks=${checks.length} failures=${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`LOCALIZED_404_VERIFY=PASS checks=${checks.length} ru404=dist/ru/404.html vercel_status=404 cloudflare_nearest_404=enabled failures=0`);
