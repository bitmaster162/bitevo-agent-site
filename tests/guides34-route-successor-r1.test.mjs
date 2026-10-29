import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isExactGuides34Successor } from '../scripts/guides34-route-successor-r1.mjs';
const base = new URL('../', import.meta.url);
const registryText = readFileSync(new URL('src/data/public-route-registry.json', base),'utf8');
const manifestText = readFileSync(new URL('src/data/sitemap-currentness.json', base),'utf8');
test('guides34 exact successor allows the pinned two-route expansion',()=>{
 assert.equal(isExactGuides34Successor(),true);
 assert.equal(isExactGuides34Successor(registryText,manifestText),true);
});
test('alien registry or currentness manifest must fail closed',()=>{
 const changedRegistry=JSON.parse(registryText);
 changedRegistry.routes.find(x=>x.path==='/guides/false-green-and-retry-safety').locale='ru';
 assert.equal(isExactGuides34Successor(JSON.stringify(changedRegistry),manifestText),false);
 const second=JSON.parse(registryText);
 second.routes.find(x=>x.path==='/guides/mcp-and-coding-agent-governance').locale='ru';
 assert.equal(isExactGuides34Successor(JSON.stringify(second),manifestText),false);
 const changedManifest=JSON.parse(manifestText);
 changedManifest.routes.find(x=>x.path==='/ru/guides/false-green-and-retry-safety').fingerprint='sha256:'+'0'.repeat(64);
 assert.equal(isExactGuides34Successor(registryText,JSON.stringify(changedManifest)),false);
 assert.equal(isExactGuides34Successor('{}','{}'),false);
});
