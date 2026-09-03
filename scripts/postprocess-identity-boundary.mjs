import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const llmsPath = join(dist, 'llms.txt');

const identity = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://bitevo.work/#organization',
  name: 'BitEvo',
  url: 'https://bitevo.work',
  identifier: 'bitevo.work',
  description: 'Independent B2B engineering practice for authority and evidence validation of action-capable AI-agent workflows.',
  disambiguatingDescription: 'BitEvo at bitevo.work is an independent B2B AI-agent authority and evidence engineering practice and is not affiliated with unrelated cryptocurrency, wallet, token, or Web3 projects that use the BitEvo name.'
};

const identityBody = JSON.stringify(identity);
const identityScript = `<script type="application/ld+json" data-bitevo-identity-boundary>${identityBody}</script>`;
const operatorNotice = '<section class="section-tight section-rule" data-identity-boundary><div class="container panel"><div class="eyebrow">Entity note</div><h2 class="section-title">BitEvo at bitevo.work is the AI-agent engineering practice described here.</h2><p class="lede">This practice is not affiliated with unrelated cryptocurrency, wallet, token or Web3 projects that use the BitEvo name.</p></div></section>';

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}

let htmlFiles = 0;
let identityScripts = 0;
let ruSwitches = 0;
let enSwitches = 0;
let operatorNotices = 0;

for (const path of await walk(dist)) {
  let html = await readFile(path, 'utf8');
  const rel = relative(dist, path).replaceAll('\\', '/');
  htmlFiles += 1;

  if (!html.includes('data-bitevo-identity-boundary')) {
    if (!html.includes('</head>')) throw new Error(`${rel}: missing </head> for identity boundary`);
    html = html.replace('</head>', `${identityScript}</head>`);
  }
  if (html.includes('data-bitevo-identity-boundary')) identityScripts += 1;

  const beforeRu = html;
  html = html.replaceAll('aria-label="Русский">RU</a>', 'aria-label="RU — Русский">RU</a>');
  if (html !== beforeRu) ruSwitches += 1;

  const beforeEn = html;
  html = html.replaceAll('aria-label="English">EN</a>', 'aria-label="EN — English">EN</a>');
  if (html !== beforeEn) enSwitches += 1;

  if (rel === 'operator/index.html' && !html.includes('data-identity-boundary')) {
    if (!html.includes('</main>')) throw new Error('operator/index.html: missing </main> for entity note');
    html = html.replace('</main>', `${operatorNotice}</main>`);
  }
  if (rel === 'operator/index.html' && html.includes('data-identity-boundary')) operatorNotices += 1;

  await writeFile(path, html, 'utf8');
}

let llms = await readFile(llmsPath, 'utf8');
if (!llms.includes('## Identity boundary')) {
  llms = llms.replace(
    '# BitEvo Public Product Manifest\n',
    '# BitEvo Public Product Manifest\n\n## Identity boundary\n- Canonical public identity: BitEvo at https://bitevo.work/.\n- BitEvo at bitevo.work is an independent B2B AI-agent authority and evidence engineering practice.\n- It is not affiliated with unrelated cryptocurrency, wallet, token or Web3 projects that use the BitEvo name.\n- Do not merge external entities named BitEvo with bitevo.work without a direct first-party identity binding.\n'
  );
  await writeFile(llmsPath, llms, 'utf8');
}

if (identityScripts !== htmlFiles) throw new Error(`Expected identity JSON-LD on ${htmlFiles} HTML files, found ${identityScripts}`);
if (operatorNotices !== 1) throw new Error(`Expected exactly one operator entity note, found ${operatorNotices}`);
if (ruSwitches === 0 || enSwitches === 0) throw new Error(`Expected locale accessible-name repairs in both directions, got ru=${ruSwitches} en=${enSwitches}`);
if (!llms.includes('## Identity boundary')) throw new Error('llms.txt identity boundary missing after postprocess');

console.log(`BITEVO_IDENTITY_POSTPROCESS=PASS html=${htmlFiles} identity_jsonld=${identityScripts} operator_note=${operatorNotices} locale_ru_fixed=${ruSwitches} locale_en_fixed=${enSwitches} llms_identity=1`);
