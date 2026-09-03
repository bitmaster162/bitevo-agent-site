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

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalJson(value[key]);
    return out;
  }
  return value;
}

async function canonicalExecutableJs(code, type) {
  const { minify } = await import('terser');
  const result = await minify(code, {
    module: type === 'module',
    ecma: 2022,
    compress: { defaults: true, passes: 3, unsafe: false, unsafe_arrows: false, unsafe_methods: false, unsafe_proto: false },
    mangle: { toplevel: true },
    format: { ecma: 2022, comments: false, semicolons: true, quote_style: 1, ascii_only: false }
  });
  if (!result.code) throw new Error('Terser canonicalization returned empty code');
  return result.code;
}

async function canonicalScript(script) {
  if (script.type === 'application/ld+json') return `json:${JSON.stringify(canonicalJson(JSON.parse(script.raw)))}`;
  return `js:${await canonicalExecutableJs(script.raw, script.type)}`;
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
      scripts.push({ index:scriptIndex++, type, hash, raw:body });
    }
    routes[route] = { styles, scripts };
  }
  const data = {
    schema:'bitevo.astro7-csp-snapshot/v4-semantic-js', routes,
    totals:{ routes:Object.keys(routes).length, styleBlocks, uniqueStyles:styleHashes.size, scriptBlocks, uniqueScripts:scriptHashes.size, executable, jsonld },
    styleHashes:[...styleHashes].sort(), scriptHashes:[...scriptHashes].sort()
  };
  await writeFile(output, JSON.stringify(data));
  console.log(`CSP_SNAPSHOT output=${output} routes=${data.totals.routes} style_blocks=${styleBlocks} unique_styles=${styleHashes.size} script_blocks=${scriptBlocks} unique_scripts=${scriptHashes.size} executable=${executable} jsonld=${jsonld}`);
}

function firstTextDifference(left, right) {
  const n = Math.min(left.length, right.length);
  let i=0; while (i<n && left[i]===right[i]) i++;
  const start=Math.max(0,i-180), endL=Math.min(left.length,i+1100), endR=Math.min(right.length,i+1100);
  return { index:i, old:left.slice(start,endL), next:right.slice(start,endR) };
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
  const styleForward = new Map(), styleReverse = new Map(), scriptForward = new Map(), scriptReverse = new Map();
  const mapAdd = (map, key, value) => { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(value); };
  let stylePairs=0, scriptPairs=0, scriptByteExact=0, scriptCanonical=0, jsonCanonical=0;
  for (const route of oldRoutes) {
    const oldRoute=oldData.routes[route], newRoute=newData.routes[route];
    if (oldRoute.styles.length !== newRoute.styles.length) throw new Error(`${route}: style count drift`);
    if (oldRoute.scripts.length !== newRoute.scripts.length) throw new Error(`${route}: script count drift`);
    for (let i=0;i<oldRoute.styles.length;i++) {
      const before=oldRoute.styles[i], after=newRoute.styles[i]; stylePairs++;
      if (before.canonical !== after.canonical) {
        console.log(`CSS_MISMATCH route=${route} index=${i} old_hash=${before.hash} new_hash=${after.hash}`);
        console.log(`CSS_MISMATCH_RAW ${JSON.stringify(firstTextDifference(before.raw, after.raw))}`);
        console.log(`CSS_MISMATCH_CANONICAL ${JSON.stringify(firstTextDifference(before.canonicalText, after.canonicalText))}`);
        throw new Error(`${route}: CSS semantic drift at style index ${i}`);
      }
      mapAdd(styleForward,before.hash,after.hash); mapAdd(styleReverse,after.hash,before.hash);
    }
    for (let i=0;i<oldRoute.scripts.length;i++) {
      const before=oldRoute.scripts[i], after=newRoute.scripts[i]; scriptPairs++;
      if (before.type !== after.type) throw new Error(`${route}: inline script type drift at index ${i}`);
      mapAdd(scriptForward,before.hash,after.hash); mapAdd(scriptReverse,after.hash,before.hash);
      if (before.hash === after.hash) { scriptByteExact++; continue; }
      const [oldCanonical,newCanonical] = await Promise.all([canonicalScript(before),canonicalScript(after)]);
      if (oldCanonical !== newCanonical) {
        console.log(`SCRIPT_SEMANTIC_MISMATCH route=${route} index=${i} type=${before.type||'javascript'} old_hash=${before.hash} new_hash=${after.hash}`);
        console.log(`SCRIPT_RAW_DIFF ${JSON.stringify(firstTextDifference(before.raw, after.raw))}`);
        console.log(`SCRIPT_CANONICAL_DIFF ${JSON.stringify(firstTextDifference(oldCanonical, newCanonical))}`);
        throw new Error(`${route}: inline script canonical semantic drift at index ${i}`);
      }
      if (before.type === 'application/ld+json') jsonCanonical++; else scriptCanonical++;
    }
  }
  const bijective = map => [...map.values()].every(set => set.size === 1);
  if (!bijective(styleForward) || !bijective(styleReverse)) throw new Error('style hash mapping is not bijective');
  if (!bijective(scriptForward) || !bijective(scriptReverse)) throw new Error('script hash mapping is not bijective');
  if (styleForward.size !== 37 || styleReverse.size !== 37) throw new Error(`style unique mapping drift old=${styleForward.size} new=${styleReverse.size}`);
  if (scriptForward.size !== 13 || scriptReverse.size !== 13) throw new Error(`script unique mapping drift old=${scriptForward.size} new=${scriptReverse.size}`);
  await writeFile(styleOutput, JSON.stringify(newData.styleHashes, null, 2));
  await writeFile(scriptOutput, JSON.stringify(newData.scriptHashes, null, 2));
  console.log(`ASTRO7_CSP_EQUIVALENCE=PASS routes=97 style_pairs=${stylePairs} unique_style_map=37 style_bijective=1 css_semantic_ast=PASS media_range_equivalence=NORMALIZED script_pairs=${scriptPairs} unique_script_map=13 script_bijective=1 script_byte_exact=${scriptByteExact} executable_terser_canonical=${scriptCanonical} json_canonical=${jsonCanonical}`);
}

if (mode === 'snapshot') await snapshot(a);
else if (mode === 'compare') await compare(a,b,c,d);
else throw new Error('usage: snapshot <output> | compare <old> <new> <candidate-styles-output> <candidate-scripts-output>');
