import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const failures = [];
const read = route => readFile(`${dist}${route}/index.html`, 'utf8');
const strip = text => text.replace(/<[^>]*>/g, ' ').replace(/&[a-z0-9#]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const hasAnchor = (html, href, label) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].some(m => (m[1] || '').match(/\bhref=[\"']([^\"']+)[\"']/i)?.[1] === href && strip(m[2] || '') === label);
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

if (!hasAnchor(en, '/security', 'Security')) failures.push('footer EN security label/link missing');
if (!hasAnchor(ru, '/ru/security', 'Безопасность')) failures.push('footer RU security label/link missing');
if (!en.includes('hreflang="ru"') || !en.includes('href="https://bitevo.work/ru/security"')) failures.push('EN RU alternate missing');
const enPrivacyPath = `${dist}/privacy/index.html`;
const ruPrivacyPath = `${dist}/ru/privacy/index.html`;
if (!(await exists(enPrivacyPath)) || !(await exists(ruPrivacyPath))) {
  failures.push('R47A bounded EN/RU privacy disclosures missing');
} else {
  const enPrivacy = await read('/privacy');
  const ruPrivacy = await read('/ru/privacy');
  for (const [locale, html, enRoute, ruRoute] of [['EN', enPrivacy, '/privacy', '/ru/privacy'], ['RU', ruPrivacy, '/privacy', '/ru/privacy']]) {
    if (!html.includes('name="robots" content="noindex, follow"')) failures.push(`${locale} R47A disclosure not noindex`);
    if (!html.includes(`hreflang="en" href="https://bitevo.work${enRoute}"`) || !html.includes(`hreflang="ru" href="https://bitevo.work${ruRoute}"`)) failures.push(`${locale} R47A disclosure hreflang missing`);
  }
  if (!enPrivacy.includes('the BitEvo first-party event counter is OFF')) failures.push('EN R47A OFF marker missing');
  if (!ruPrivacy.includes('счётчик событий BitEvo ВЫКЛЮЧЕН')) failures.push('RU R47A OFF marker missing');
  if (!hasAnchor(en, '/privacy', 'Site data events')) failures.push('footer EN privacy link missing');
  if (!hasAnchor(ru, '/ru/privacy', 'Данные сайта и счётчик')) failures.push('footer RU privacy link missing');
}
if (await exists(`${dist}/terms/index.html`)) failures.push('terms route unexpectedly published');

if (failures.length) {
  console.error('SECURITY_TRUST_SURFACE=FAIL');
  failures.forEach(x => console.error(x));
  process.exit(1);
}
console.log('SECURITY_TRUST_SURFACE=PASS locales=2 footer_security_links=2 footer_privacy_links=2 privacy_noindex_preview=2 terms_published=0 failures=0');
