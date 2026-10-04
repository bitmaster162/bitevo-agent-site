import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const contentDir = join(root, 'src/content/research-notes');
const generatedPath = join(root, 'src/generated/research-notes.json');
const registryPath = join(root, 'src/data/public-route-registry.json');
const vercelPath = join(root, 'vercel.json');
const generatedBy = 'research-notes';
const required = ['site','path','alternate','lang','card','title','seo_title','description','reviewed','next_review','related','schema','research_source'];

function parseValue(raw) {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map(item => item.trim()).map(item => {
      if (item.startsWith('"') && item.endsWith('"')) return JSON.parse(item);
      if (item.startsWith("'") && item.endsWith("'")) return item.slice(1, -1);
      return item;
    });
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export function parseFrontmatter(text, source = '<memory>') {
  const normalized = text.replace(/^\uFEFF/, '');
  if (!normalized.startsWith('---\n')) throw new Error(`${source}: frontmatter start missing`);
  const end = normalized.indexOf('\n---\n', 4);
  if (end < 0) throw new Error(`${source}: frontmatter end missing`);
  const lines = normalized.slice(4, end).split(/\r?\n/);
  const data = {};
  for (const line of lines) {
    if (!line.trim()) continue;
    const match = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!match) throw new Error(`${source}: unsupported frontmatter line: ${line}`);
    data[match[1]] = parseValue(match[2]);
  }
  return data;
}

function slugFromPath(path, lang) {
  const prefix = lang === 'ru' ? '/ru/guides/' : '/guides/';
  if (!path.startsWith(prefix)) throw new Error(`${path}: research note path must start with ${prefix}`);
  const slug = path.slice(prefix.length);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`${path}: invalid research note slug`);
  return slug;
}

function cardParts(card, source) {
  const parts = String(card).split(' · ');
  if (parts.length < 3) throw new Error(`${source}: card must contain number · type · text`);
  const number = parts.shift();
  const type = parts.shift();
  const text = parts.join(' · ');
  if (!/^\d{2}$/.test(number)) throw new Error(`${source}: card number must be two digits`);
  return { number, type, text };
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export async function collectResearchNotes() {
  const files = (await readdir(contentDir)).filter(name => name.endsWith('.md')).sort();
  const notes = [];
  for (const name of files) {
    const full = join(contentDir, name);
    const text = await readFile(full, 'utf8');
    const fm = parseFrontmatter(text, name);
    for (const key of required) if (fm[key] === undefined || fm[key] === '') throw new Error(`${name}: missing frontmatter field ${key}`);
    if (fm.site !== 'bitevo.work') throw new Error(`${name}: site must be bitevo.work`);
    if (!['en','ru'].includes(fm.lang)) throw new Error(`${name}: lang must be en or ru`);
    if (!validDate(fm.reviewed) || !validDate(fm.next_review)) throw new Error(`${name}: reviewed/next_review must be YYYY-MM-DD`);
    if (!Array.isArray(fm.related) || !Array.isArray(fm.schema)) throw new Error(`${name}: related/schema must be arrays`);
    if (!fm.schema.includes('Article') || !fm.schema.includes('BreadcrumbList')) throw new Error(`${name}: schema must include Article and BreadcrumbList`);
    const slug = slugFromPath(fm.path, fm.lang);
    const card = cardParts(fm.card, name);
    notes.push({
      source: relative(root, full).split(sep).join('/'),
      filename: basename(name),
      slug,
      path: fm.path,
      alternate: fm.alternate,
      lang: fm.lang,
      card: fm.card,
      card_number: card.number,
      card_type: card.type,
      card_text: card.text,
      title: fm.title,
      seo_title: fm.seo_title,
      description: fm.description,
      reviewed: fm.reviewed,
      next_review: fm.next_review,
      related: fm.related,
      schema: fm.schema,
      research_source: fm.research_source
    });
  }

  const byPath = new Map();
  for (const note of notes) {
    if (byPath.has(note.path)) throw new Error(`duplicate research note path: ${note.path}`);
    byPath.set(note.path, note);
  }
  for (const note of notes) {
    const partner = byPath.get(note.alternate);
    if (!partner) throw new Error(`${note.path}: missing alternate ${note.alternate}`);
    if (partner.alternate !== note.path) throw new Error(`${note.path}: alternate is not reciprocal`);
    if (partner.lang === note.lang) throw new Error(`${note.path}: alternate language must differ`);
    if (partner.slug !== note.slug) throw new Error(`${note.path}: alternate slug mismatch`);
  }
  return notes.sort((a,b) => a.path.localeCompare(b.path));
}

function generatedRoute(note) {
  return {
    path: note.path,
    category: 'RESEARCH',
    indexable: true,
    locale: note.lang,
    parent: note.lang === 'ru' ? '/ru/guides' : '/guides',
    generatedBy,
    reviewed: note.reviewed
  };
}

function fallbackSource(enSlugs) {
  const staticAllowed = ['security-sandboxing','fleet-coordinator-drift-monitoring','d3-tool-io-bridge-contract'];
  const allowed = [...new Set([...staticAllowed, ...enSlugs])].sort();
  return `/guides/:slug((?!${allowed.join('|')}).*)`;
}

async function updateRegistry(notes) {
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const baseRoutes = registry.routes.filter(route => route.generatedBy !== generatedBy);
  registry.routes = [...baseRoutes, ...notes.map(generatedRoute)];
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
}

async function updateVercel(notes) {
  const vercel = JSON.parse(await readFile(vercelPath, 'utf8'));
  const redirects = Array.isArray(vercel.redirects) ? vercel.redirects : [];
  const fallback = redirects.find(item => String(item.source || '').startsWith('/guides/:slug'));
  if (!fallback) throw new Error('vercel guide fallback redirect missing');
  fallback.source = fallbackSource(notes.filter(note => note.lang === 'en').map(note => note.slug));
  fallback.destination = '/guides';
  fallback.permanent = true;
  await writeFile(vercelPath, `${JSON.stringify(vercel, null, 2)}\n`, 'utf8');
}

export async function generateResearchNotes() {
  await mkdir(join(root, 'src/generated'), { recursive: true });
  const notes = await collectResearchNotes();
  await writeFile(generatedPath, `${JSON.stringify({ schema: 'bitevo.research-notes/v1', generatedBy, notes }, null, 2)}\n`, 'utf8');
  await updateRegistry(notes);
  await updateVercel(notes);
  console.log(`RESEARCH_NOTES_GENERATE=PASS notes=${notes.length} pairs=${notes.length / 2} paths=${notes.map(note => note.path).join(',')}`);
  return notes;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateResearchNotes();
}
