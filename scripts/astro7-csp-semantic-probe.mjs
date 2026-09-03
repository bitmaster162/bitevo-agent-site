import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import postcss from 'postcss';

const [mode, a, b, c] = process.argv.slice(2);
const dist = 'dist';
const digest = value => createHash('sha256').update(value).digest('base64');

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(path);
  }
  return out.sort();
}

const normSpace = value => String(value || '').replace(/\s+/g, ' ').trim();
const normSelector = value => normSpace(value)
  .replace(/data-astro-cid-[a-z0-9_-]+/gi, 'data-astro-cid-SCOPE')
  .replace(/\s*([>+~,])\s*/g, '$1');

function canonicalChildren(container) {
  const nodes = container?.nodes || [];
  const shapes = nodes.map(canonicalNode).filter(Boolean);
  if (nodes.length && nodes.every(node => node.type === 'decl')) {
    const identities = nodes.map(node => `${String(node.prop).toLowerCase()}|${node.important ? 1 : 0}`);
    if (new Set(identities).size === identities.length) {
      shapes.sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
    }
  }
  return shapes;
}

function canonicalNode(node) {
  if (!node) return null;
  if (node.type === 'decl') return { t:'decl', p:String(node.prop).toLowerCase(), v:normSpace(node.value), i:Boolean(node.important) };
  if (node.type === 'rule') return { t:'rule', s:normSelector(node.selector), n:canonicalChildren(node) };
  if (node.type === 'atrule') return { t:'atrule', n:String(node.name).toLowerCase(), p:normSpace(node.params).replace(/data-astro-cid-[a-z0-9_-]+/gi, 'data-astro-cid-SCOPE'), c:canonicalChildren(node) };
  if (node.type === 'comment') return null;
  throw new Error(`unsupported CSS AST node type: ${node.type}`);
}

function canonicalCss(body) {
  const scoped = body.replace(/data-astro-cid-[a-z0-9_-]+/gi, 'data-astro-cid-SCOPE');
  return JSON.stringify(canonicalChildren(postcss.parse(scoped)));
}

async function snapshot(output) {
  const routes = {};
  let styleBlocks = 0, scriptBlocks = 0, executable = 0, jsonld = 0;
  const styleHashes = new Set(), scriptHashes = new Set();
  for (const path of await walk(dist)) {
    const route = relative(dist, path).replaceAll('\\', '/');
    const html = await readFile(path, 'utf8');
    const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m, index) => {
      const body = m[1] || '';
      const canonicalText = canonicalCss(body);
      const hash = digest(body); styleHashes.add(hash); styleBlocks++;
      return { index, hash, canonical:digest(canonicalText), raw:body, canonicalText };
    });
    const scripts = [];
    let scriptIndex = 0;
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const attrs = m[1] || '', body = m[2] || '';
      if (/\bsrc\s*=/.test(attrs) || !body.trim()) continue;
      const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() || '';
      const hash = digest(body); scriptHashes.add(hash); scriptBlocks++;
      if (type === 'application/ld+json') jsonld++; else executable++;
      scripts.push({ index:scriptIndex++, type, hash });
    }
    routes[route] = { styles, scripts };
  }
  const data = {
    schema:'bitevo.astro7-csp-snapshot/v2-debug', routes,
    totals:{ routes:Object.keys(routes).length, styleBlocks, uniqueStyles:styleHashes.size, scriptBlocks, uniqueScripts:scriptHashes.size, executable, jsonld },
    styleHashes:[...styleHashes].sort(), scriptHashes:[...scriptHashes].sort()
  };
  await writeFile(output, JSON.stringify(data));
  console.log(`CSP_SNAPSHOT output=${output} routes=${data.totals.routes} style_blocks=${styleBlocks} unique_styles=${styleHashes.size} script_blocks=${scriptBlocks} unique_scripts=${scriptHashes.size} executable=${executable} jsonld=${jsonld}`);
}

function firstTextDifference(left, right) {
  const n = Math.min(left.length, right.length);
  let i=0; while (i<n && left[i]===right[i]) i++;
  const start=Math.max(0,i-180), endL=Math.min(left.length,i+700), endR=Math.min(right.length,i+700);
  return { index:i, old:left.slice(start,endL), next:right.slice(start,endR) };
}

async function compare(oldPath, newPath, styleOutput) {
  const oldData = JSON.parse(await readFile(oldPath, 'utf8'));
  const newData = JSON.parse(await readFile(newPath, 'utf8'));
  const expected = { routes:97, styleBlocks:67, uniqueStyles:37, scriptBlocks:246, uniqueScripts:13, executable:50, jsonld:196 };
  for (const [key, value] of Object.entries(expected)) {
    if (oldData.totals[key] !== value) throw new Error(`baseline ${key} drift: ${oldData.totals[key]} != ${value}`);
    if (newData.totals[key] !== value) throw new Error(`candidate ${key} drift: ${newData.totals[key]} != ${value}`);
  }
  const oldRoutes = Object.keys(oldData.routes).sort(), newRoutes = Object.keys(newData.routes).sort();
  if (JSON.stringify(oldRoutes) !== JSON.stringify(newRoutes)) throw new Error('route set drift');
  const forward = new Map(), reverse = new Map();
  const mapAdd = (map, key, value) => { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(value); };
  let stylePairs=0, scriptPairs=0;
  for (const route of oldRoutes) {
    const oldRoute=oldData.routes[route], newRoute=newData.routes[route];
    if (oldRoute.styles.length !== newRoute.styles.length) throw new Error(`${route}: style count drift`);
    if (oldRoute.scripts.length !== newRoute.scripts.length) throw new Error(`${route}: script count drift`);
    for (let i=0;i<oldRoute.styles.length;i++) {
      const before=oldRoute.styles[i], after=newRoute.styles[i]; stylePairs++;
      if (before.canonical !== after.canonical) {
        const rawDiff=firstTextDifference(before.raw, after.raw);
        const canonDiff=firstTextDifference(before.canonicalText, after.canonicalText);
        console.log(`CSS_MISMATCH route=${route} index=${i} old_hash=${before.hash} new_hash=${after.hash}`);
        console.log(`CSS_MISMATCH_RAW ${JSON.stringify(rawDiff)}`);
        console.log(`CSS_MISMATCH_CANONICAL ${JSON.stringify(canonDiff)}`);
        console.log(`CSS_OLD_RAW ${JSON.stringify(before.raw.slice(0,8000))}`);
        console.log(`CSS_NEW_RAW ${JSON.stringify(after.raw.slice(0,8000))}`);
        throw new Error(`${route}: CSS semantic drift at style index ${i}`);
      }
      mapAdd(forward,before.hash,after.hash); mapAdd(reverse,after.hash,before.hash);
    }
    for (let i=0;i<oldRoute.scripts.length;i++) {
      const before=oldRoute.scripts[i], after=newRoute.scripts[i]; scriptPairs++;
      if (before.type !== after.type || before.hash !== after.hash) throw new Error(`${route}: inline script byte drift at index ${i}`);
    }
  }
  if ([...forward.values()].some(set => set.size !== 1) || [...reverse.values()].some(set => set.size !== 1)) throw new Error('style hash mapping is not bijective');
  if (forward.size !== 37 || reverse.size !== 37) throw new Error(`style unique mapping drift old=${forward.size} new=${reverse.size}`);
  if (JSON.stringify(oldData.scriptHashes) !== JSON.stringify(newData.scriptHashes)) throw new Error('script hash set drift');
  await writeFile(styleOutput, JSON.stringify(newData.styleHashes, null, 2));
  console.log(`ASTRO7_CSP_EQUIVALENCE=PASS routes=97 style_pairs=${stylePairs} unique_style_map=37 bijective=1 script_pairs=${scriptPairs} scripts_byte_exact=1 css_semantic_ast=PASS`);
}

if (mode === 'snapshot') await snapshot(a);
else if (mode === 'compare') await compare(a,b,c);
else throw new Error('usage: snapshot <output> | compare <old> <new> <candidate-styles-output>');
