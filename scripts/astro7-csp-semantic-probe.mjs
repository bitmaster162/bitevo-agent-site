import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import postcss from 'postcss';

const [mode, a, b, c, d] = process.argv.slice(2);
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

function normAtRuleParams(name, value) {
  let result = normSpace(value).replace(/data-astro-cid-[a-z0-9_-]+/gi, 'data-astro-cid-SCOPE');
  if (String(name).toLowerCase() === 'media') {
    result = result
      .replace(/\(\s*max-(width|height)\s*:\s*([^)]+?)\s*\)/gi, (_m, axis, limit) => `(${axis.toLowerCase()}<=${normSpace(limit)})`)
      .replace(/\(\s*min-(width|height)\s*:\s*([^)]+?)\s*\)/gi, (_m, axis, limit) => `(${axis.toLowerCase()}>=${normSpace(limit)})`)
      .replace(/\s*(<=|>=|<|>)\s*/g, '$1');
  }
  return result;
}

function canonicalChildren(container) {
  const nodes = container?.nodes || [];
  const shapes = nodes.map(canonicalNode).filter(Boolean);
  if (nodes.length && nodes.every(node => node.type === 'decl')) {
    const identities = nodes.map(node => `${String(node.prop).toLowerCase()}|${node.important ? 1 : 0}`);
    if (new Set(identities).size === identities.length) shapes.sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
  }
  return shapes;
}

function canonicalNode(node) {
  if (!node) return null;
  if (node.type === 'decl') return { t:'decl', p:String(node.prop).toLowerCase(), v:normSpace(node.value), i:Boolean(node.important) };
  if (node.type === 'rule') return { t:'rule', s:normSelector(node.selector), n:canonicalChildren(node) };
  if (node.type === 'atrule') return { t:'atrule', n:String(node.name).toLowerCase(), p:normAtRuleParams(node.name, node.params), c:canonicalChildren(node) };
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
      const hash = digest(body); styleHashes.add(hash); styleBlocks++;
      return { index, hash, canonical:digest(canonicalCss(body)) };
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
    schema:'bitevo.astro7-csp-snapshot/v5-shape', routes,
    totals:{ routes:Object.keys(routes).length, styleBlocks, uniqueStyles:styleHashes.size, scriptBlocks, uniqueScripts:scriptHashes.size, executable, jsonld },
    styleHashes:[...styleHashes].sort(), scriptHashes:[...scriptHashes].sort()
  };
  await writeFile(output, JSON.stringify(data, null, 2));
  console.log(`CSP_SNAPSHOT output=${output} routes=${data.totals.routes} style_blocks=${styleBlocks} unique_styles=${styleHashes.size} script_blocks=${scriptBlocks} unique_scripts=${scriptHashes.size} executable=${executable} jsonld=${jsonld}`);
}

async function compare(oldPath, newPath, styleOutput, scriptOutput) {
  const oldData = JSON.parse(await readFile(oldPath, 'utf8'));
  const newData = JSON.parse(await readFile(newPath, 'utf8'));
  const expected = { routes:97, styleBlocks:67, uniqueStyles:37, scriptBlocks:246, uniqueScripts:13, executable:50, jsonld:196 };
  for (const [key, value] of Object.entries(expected)) {
    if (oldData.totals[key] !== value) throw new Error(`baseline ${key} drift: ${oldData.totals[key]} != ${value}`);
    if (newData.totals[key] !== value) throw new Error(`candidate ${key} drift: ${newData.totals[key]} != ${value}`);
  }
  const oldRoutes = Object.keys(oldData.routes).sort(), newRoutes = Object.keys(newData.routes).sort();
  if (JSON.stringify(oldRoutes) !== JSON.stringify(newRoutes)) throw new Error('route set drift');

  const styleForward = new Map(), styleReverse = new Map();
  const mapAdd = (map, key, value) => { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(value); };
  let stylePairs=0, scriptPairs=0, exactScriptBlocks=0;
  const changedScriptBlocks=[];

  for (const route of oldRoutes) {
    const oldRoute=oldData.routes[route], nextRoute=newData.routes[route];
    if (oldRoute.styles.length !== nextRoute.styles.length) throw new Error(`${route}: style count drift`);
    if (oldRoute.scripts.length !== nextRoute.scripts.length) throw new Error(`${route}: script count drift`);
    for (let i=0;i<oldRoute.styles.length;i++) {
      const before=oldRoute.styles[i], after=nextRoute.styles[i]; stylePairs++;
      if (before.canonical !== after.canonical) throw new Error(`${route}: CSS semantic drift at style index ${i}`);
      mapAdd(styleForward,before.hash,after.hash); mapAdd(styleReverse,after.hash,before.hash);
    }
    for (let i=0;i<oldRoute.scripts.length;i++) {
      const before=oldRoute.scripts[i], after=nextRoute.scripts[i]; scriptPairs++;
      if (before.type !== after.type) throw new Error(`${route}: script type drift at index ${i}`);
      if (before.hash === after.hash) exactScriptBlocks++;
      else changedScriptBlocks.push({route,index:i,type:before.type,oldHash:before.hash,newHash:after.hash});
    }
  }

  const bijective = map => [...map.values()].every(set => set.size === 1);
  if (!bijective(styleForward) || !bijective(styleReverse)) throw new Error('style hash mapping is not bijective');
  if (styleForward.size !== 37 || styleReverse.size !== 37) throw new Error(`style unique mapping drift old=${styleForward.size} new=${styleReverse.size}`);

  const allowedChangedRoutes = new Set(['audit-intake/index.html','ru/audit-intake/index.html']);
  if (changedScriptBlocks.length !== 2) throw new Error(`expected exactly two changed inline script blocks, got ${changedScriptBlocks.length}`);
  for (const change of changedScriptBlocks) {
    if (!allowedChangedRoutes.has(change.route)) throw new Error(`unexpected changed script route: ${change.route}`);
    if (change.type !== 'module') throw new Error(`${change.route}: changed intake script must remain type=module`);
  }
  if (new Set(changedScriptBlocks.map(x=>x.route)).size !== 2) throw new Error('both EN and RU audit-intake script changes are required exactly once');
  const oldChanged = new Set(changedScriptBlocks.map(x=>x.oldHash)), newChanged = new Set(changedScriptBlocks.map(x=>x.newHash));
  if (oldChanged.size !== 2 || newChanged.size !== 2) throw new Error('changed script hashes must be two distinct one-to-one pairs');

  const unchangedOld = oldData.scriptHashes.filter(h=>!oldChanged.has(h)).sort();
  const unchangedNew = newData.scriptHashes.filter(h=>!newChanged.has(h)).sort();
  if (JSON.stringify(unchangedOld) !== JSON.stringify(unchangedNew) || unchangedOld.length !== 11) throw new Error('the 11 non-intake reviewed script hashes must remain byte-identical');

  await writeFile(styleOutput, JSON.stringify(newData.styleHashes, null, 2));
  await writeFile(scriptOutput, JSON.stringify(newData.scriptHashes, null, 2));
  console.log(`ASTRO7_CSP_SHAPE=PASS routes=97 style_pairs=${stylePairs} unique_style_map=37 style_bijective=1 css_semantic_ast=PASS media_range_equivalence=NORMALIZED script_pairs=${scriptPairs} script_blocks_byte_exact=${exactScriptBlocks} unchanged_unique_script_hashes=11 changed_script_blocks=2 changed_routes=audit-intake,ru/audit-intake`);
  for (const change of changedScriptBlocks) console.log(`ASTRO7_CHANGED_SCRIPT ${JSON.stringify(change)}`);
}

if (mode === 'snapshot') await snapshot(a);
else if (mode === 'compare') await compare(a,b,c,d);
else throw new Error('usage: snapshot <output> | compare <old> <new> <candidate-styles-output> <candidate-scripts-output>');
