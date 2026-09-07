import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const failures = [];
const read = route => readFile(`${dist}${route}/index.html`, 'utf8');
const strip = text => text.replace(/<[^>]*>/g, ' ').replace(/&[a-z0-9#]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const exists = async path => { try { await access(path); return true; } catch { return false; } };

const en = await read('/security');
const ru = await read('/ru/security');
const enText = strip(en);
const ruText = strip(ru);

for (const phrase of [
  'Bound the work before access begins.',
  'Staging/test by default',
  'No secrets in public intake',
  'Engineering evidence, not certification.'
]) if (!enText.includes(phrase)) failures.push(`EN missing: ${phrase}`);

for (const phrase of [
  'Публикуйте границы контроля так же явно, как сами security claims.',
  'Internal dogfood и synthetic proof не превращаются в customer certification.'
]) if (!ruText.includes(phrase)) failures.push(`RU missing: ${phrase}`);

if (!en.includes('href="/security"')) failures.push('footer EN security link missing');
if (!ru.includes('href="/ru/security"')) failures.push('footer RU security link missing');
if (!en.includes('hreflang="ru"') || !en.includes('href="https://bitevo.work/ru/security"')) failures.push('EN RU alternate missing');
if (await exists(`${dist}/privacy/index.html`)) failures.push('privacy route unexpectedly published');
if (await exists(`${dist}/terms/index.html`)) failures.push('terms route unexpectedly published');

if (failures.length) {
  console.error('SECURITY_TRUST_SURFACE=FAIL');
  failures.forEach(x => console.error(x));
  process.exit(1);
}
console.log('SECURITY_TRUST_SURFACE=PASS locales=2 footer_links=2 hreflang=1 privacy_published=0 terms_published=0 failures=0');
