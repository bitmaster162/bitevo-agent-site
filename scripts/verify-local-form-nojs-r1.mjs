import { isExactGuide4Successor } from './guide4-route-successor-r1.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const sha256 = data => createHash('sha256').update(data.replace(/\r\n/g, '\n')).digest('hex');
const routes = [
  { path:'/diagnostic', id:'diagnostic', locale:'en', file:'src/pages/diagnostic.astro',
    sourceSha:'fe6a522079a53fcac5309184026b408d6e0c5310b1463717cfc4ec1258247a4d',
    dynamicSha:'cc50f9c26f6615132719e58765d9c0fcdd05055bcbbf9ba4270bc50b3a66c03c',
    fingerprint:'sha256:f1ff056d792829e4b5eb6e6cf0b60e08a4f8e60a2431c56957e7785f2c2008dd' },
  { path:'/ru/diagnostic', id:'ruDiagnostic', locale:'ru', file:'src/pages/ru/diagnostic.astro',
    sourceSha:'6582f479690c7de18801980814791267b9cc207dcbbc3ca391ca1db940944820',
    dynamicSha:'82460d8bc67ff290e5da190bad2288e252fd544ee08e4cd304aec3f09701e55c',
    fingerprint:'sha256:1b466696e482dffafbc9f35198912fa14df40a9243b3be2e012e453a02bd3209' },
  { path:'/mapper', id:'mapper', locale:'en', file:'src/pages/mapper.astro',
    sourceSha:'839b757c4b799801b8b87d3e4cc6c95eb08a1bea51194bee65fba25d38868022',
    dynamicSha:'c79cbf5c5a5f0ee7783113f9c512f6110c52209a8d2b635d8728edd7981d0e2c',
    fingerprint:'sha256:639416424ede243d516ccfa2983e0ae163e4ada6bf88b8fe80406574c9fcb1d2' },
  { path:'/ru/mapper', id:'ruMapper', locale:'ru', file:'src/pages/ru/mapper.astro',
    sourceSha:'a94e5d9b8e312f9a467cc86d541428897485cbd8a726ebc4f130b4eeae9a7d94',
    dynamicSha:'2e1658150b537abd56e341579536bef8eac8ecc3903d13149779d19201c62c6a',
    fingerprint:'sha256:996694e72f85365a3d56d0a2fa74fc77845b39efd3e45f9f80d309c7df1f676c' }
];
let checks = 0;
const need = (ok, message) => { assert.ok(ok, message); checks++; };
const noJsMessage = {
  en: 'The local form is inactive until its JavaScript handler loads.',
  ru: 'Локальная форма неактивна, пока не загрузился её JavaScript-обработчик.'
};

function faults(source, entry) {
  const errors = [];
  const formOpen = source.match(new RegExp('<form\\b(?=[^>]*\\bid="' + entry.id + '")[^>]*>'));
  if (!formOpen) return ['exact form ID missing'];
  const open = formOpen[0];
  if (!/\bmethod="post"/.test(open)) errors.push('missing POST default');
  if (/\baction=/.test(open)) errors.push('unexpected HTTP action');
  const start = source.indexOf(open);
  const end = source.indexOf('</form>', start);
  if (end < start) return [...errors, 'unclosed form'];
  const formBody = source.slice(start, end);
  const submit = formBody.match(/<button\b[^>]*type="submit"[^>]*>/g) || [];
  if (submit.length !== 1 || !/\bdisabled\b/.test(submit[0]) || !/\bdata-js-local-submit\b/.test(submit[0])) {
    errors.push('disabled submit marker missing or duplicated');
  }
  const note = formBody.match(/<p\b[^>]*data-js-local-fallback\b[^>]*>[\s\S]*?<\/p>/g) || [];
  if (note.length !== 1 || !note[0].includes(noJsMessage[entry.locale]) ||
      !note[0].includes('mailto:robert@bitevo.work') || /\bhidden\b/.test(note[0].split('>')[0]))
    errors.push('fail-visible message missing or prematurely hidden');
  const link = '<script src="/local-form-nojs-r1.js" defer></script>';
  if (source.split(link).length !== 2) errors.push('external script missing or duplicated');
  if (source.includes('<script is:inline>')) errors.push('new inline script violates reviewed CSP');
  if (source.indexOf(link) <= source.indexOf('<script define:vars=')) errors.push('guard link before original handler');
  return errors;
}

const guardJs = await readFile(new URL('public/local-form-nojs-r1.js', root), 'utf8');
function verifiedGuard(code) {
  const required = ["'diagnostic'", "'ruDiagnostic'", "'mapper'", "'ruMapper'",
    "form.getAttribute('method') !== 'post'", "form.hasAttribute('action')",
    "form.addEventListener('submit', event => event.preventDefault());",
    "const note = form.querySelector('[data-js-local-fallback]');",
    "note.hidden = true;", "submit.disabled = false;"];
  return required.every(v => code.includes(v)) &&
    code.indexOf("form.addEventListener('submit', event => event.preventDefault());") < code.indexOf("note.hidden = true;") &&
    code.indexOf("note.hidden = true;") < code.indexOf("submit.disabled = false;") &&
    !/(?:fetch\s*\(|XMLHttpRequest|sendBeacon|\.submit\s*\(|requestSubmit)/.test(code);
}
need(sha256(guardJs) === '9856008569aac245c0d08b77cd38e476572404adbf2c7e4913139e81d452ad6b', 'external guard SHA drift');
need(verifiedGuard(guardJs), 'external guard not fail closed');
for (const corrupt of [
  guardJs.replace("'ruDiagnostic'", "'unknownForm'"),
  guardJs.replace("form.hasAttribute('action')", "false"),
  guardJs.replace("event => event.preventDefault()", "event => {}"),
  guardJs.replace("submit.disabled = false;", "submit.disabled = true;"),
  guardJs.replace("note.hidden = true;", "note.hidden = false;")
]) need(!verifiedGuard(corrupt), 'negative guard fixture incorrectly accepted');

const manifest = JSON.parse(await readFile(new URL('src/data/sitemap-currentness.json', root), 'utf8'));
need(manifest.routes.length === (isExactGuide4Successor() ? 135 : 133), 'route registry size retained');
const byPath = new Map(manifest.routes.map(x => [x.path, x]));
for (const entry of routes) {
  const source = await readFile(new URL(entry.file, root), 'utf8');
  const html = await readFile(new URL('dist' + entry.path + '/index.html', root), 'utf8');
  need(sha256(source) === entry.sourceSha, 'exact source SHA drift: ' + entry.file);
  const dynamic = source.match(/<script define:vars=\{\{\s*\w+\s*\}\}>([\s\S]*?)<\/script>/);
  need(!!dynamic && sha256(dynamic[1]) === entry.dynamicSha, 'inherited dynamic handler changed: ' + entry.path);
  need(faults(source, entry).length === 0, 'new guard semantic fail: ' + entry.path + ' ' + faults(source, entry));
  const staticForm = html.match(new RegExp('<form\\b(?=[^>]*\\bid="' + entry.id + '")[^>]*>'));
  need(!!staticForm && /\bmethod="post"/.test(staticForm[0]), 'static POST form missing: ' + entry.path);
  const staticArea = html.slice(html.indexOf(staticForm[0]), html.indexOf('</form>', html.indexOf(staticForm[0])));
  need(/<button\b[^>]*disabled\b[^>]*data-js-local-submit/.test(staticArea), 'static disabled submit missing');
  need(html.includes('src="/local-form-nojs-r1.js"') && html.includes('defer'), 'static guard link absent');
  need(staticArea.includes(noJsMessage[entry.locale]) && staticArea.includes('mailto:robert@bitevo.work'),
       'static no-JS note missing');
  need(byPath.get(entry.path)?.lastmod === '2026-10-13' &&
       byPath.get(entry.path)?.fingerprint === entry.fingerprint, 'exact successor currentness drift');
  // Negative tests prove independent semantic fail-closed behavior, not only SHA equality.
  const perturbations = [
    source.replace('method="post"', 'method="get"'),
    source.replace('disabled data-js-local-submit', 'data-js-local-submit'),
    source.replace(noJsMessage[entry.locale], 'MISSING NOTICE'),
    source.replace('<script src="/local-form-nojs-r1.js" defer></script>', '<script src="/untrusted.js" defer></script>'),
    source.replace('<script src="/local-form-nojs-r1.js" defer></script>', '<script src="/local-form-nojs-r1.js"></script>')
  ];
  for (const corrupted of perturbations) {
    need(corrupted !== source && faults(corrupted, entry).length > 0,
         'negative mutation unexpectedly accepted: ' + entry.path);
  }
}
console.log('BITEVO_LOCAL_FORM_NOJS_R1_PASS routes=4 js_disabled=FAIL_CLOSED posts=DENIED legacy_handlers=BYTE_EXACT negative_fixtures=25 checks=' + checks);
