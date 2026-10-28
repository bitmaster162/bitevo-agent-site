import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isExactGuide3Successor } from '../scripts/guide3-route-successor-r1.mjs';
const base = new URL('../', import.meta.url);
const registryText = readFileSync(new URL('src/data/public-route-registry.json', base),'utf8');
const manifestText = readFileSync(new URL('src/data/sitemap-currentness.json', base),'utf8');
test('guide3 exact successor allows the pinned two-route expansion',()=>{
 assert.equal(isExactGuide3Successor(),true);
 assert.equal(isExactGuide3Successor(registryText,manifestText),true);
});
test('alien registry or currentness manifest must fail closed',()=>{
 const changedRegistry=JSON.parse(registryText);
 changedRegistry.routes.find(x=>x.path==='/guides/false-green-and-retry-safety').locale='ru';
 assert.equal(isExactGuide3Successor(JSON.stringify(changedRegistry),manifestText),false);
 const changedManifest=JSON.parse(manifestText);
 changedManifest.routes.find(x=>x.path==='/ru/guides/false-green-and-retry-safety').fingerprint='sha256:'+'0'.repeat(64);
 assert.equal(isExactGuide3Successor(registryText,JSON.stringify(changedManifest)),false);
 assert.equal(isExactGuide3Successor('{}','{}'),false);
});
