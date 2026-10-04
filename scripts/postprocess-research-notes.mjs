import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const data = JSON.parse(await readFile(join(root, 'src/generated/research-notes.json'), 'utf8'));

function fileFor(route) {
  return join(dist, route.replace(/^\//, ''), 'index.html');
}

function ensureNoopener(html) {
  return html.replace(/<a\b([^>]*\bhref=["']https?:\/\/[^"']+["'][^>]*)>/gi, (full, attrs) => {
    if (/\brel=["']/i.test(attrs)) {
      return full.replace(/\brel=(["'])([^"']*)\1/i, (_m, quote, value) => {
        const tokens = new Set(value.split(/\s+/).filter(Boolean));
        tokens.add('noopener');
        return `rel=${quote}${[...tokens].join(' ')}${quote}`;
      });
    }
    return `<a${attrs} rel="noopener">`;
  });
}

let updated = 0;
for (const note of data.notes) {
  const path = fileFor(note.path);
  const html = await readFile(path, 'utf8');
  const next = ensureNoopener(html);
  if (next !== html) {
    await writeFile(path, next, 'utf8');
    updated += 1;
  }
}
console.log(`RESEARCH_NOTES_POSTPROCESS=PASS notes=${data.notes.length} updated=${updated}`);
