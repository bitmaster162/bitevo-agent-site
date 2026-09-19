import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceDir = join(root, 'dist', 'ru', '404');
const source = join(sourceDir, 'index.html');
const target = join(root, 'dist', 'ru', '404.html');

await access(source);
const html = await readFile(source, 'utf8');
for (const [label, ok] of [
  ['lang=ru', /<html\b[^>]*\blang="ru"/i.test(html)],
  ['noindex', /<meta\b[^>]*name="robots"[^>]*content="noindex, follow"/i.test(html)],
  ['canonical', html.includes('rel="canonical" href="https://bitevo.work/ru/404"')],
  ['Russian content', html.includes('Маршрут не найден') && html.includes('По этому адресу нет доступной страницы.')]
]) {
  if (!ok) throw new Error(`localized 404 postprocess precondition failed: ${label}`);
}
await mkdir(dirname(target), { recursive: true });
await writeFile(target, html, 'utf8');
await rm(sourceDir, { recursive: true, force: true });
console.log('LOCALIZED_404_POSTPROCESS=PASS source=dist/ru/404/index.html target=dist/ru/404.html removed_source_dir=1');
