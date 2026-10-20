import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {compileSnapshot,runArtifact} from '../scripts/r50-function-artifact-smoke.mjs';
const sourceRoot=fileURLToPath(new URL('../',import.meta.url));
const temp=fs.mkdtempSync(path.join(process.env.R50_LOCAL_TMP_ROOT||tmpdir(),'bitevo-r50e-package-'));
let serial=0;
function artifact(options={}){const out=path.join(temp,'case-'+(++serial));compileSnapshot(sourceRoot,out,options);return out;}
after(()=>fs.rmSync(temp,{recursive:true,force:true}));

test('R50-E emitted JavaScript cold-starts with TypeScript loading disabled and no network',()=>{
 const out=artifact();
 const entry=fs.readFileSync(path.join(out,'api/event.js'),'utf8');
 assert.match(entry,/r50-operator-admission\.js/);
 assert.match(entry,/r50-durable-grant-transport\.js/);
 assert.doesNotMatch(entry,/from\s+['"][^'"]+\.ts['"]/);
 assert.equal(fs.existsSync(path.join(out,'src/lib/b1-2/r50-operator-admission.ts')),false);
 const result=runArtifact(out);
 assert.equal(result.imported,true);assert.equal(result.networkAttempts,0);
 assert.deepEqual(result.results.map(x=>x.status),[404,404]);
 assert.equal(result.partialConfigStatus,503);
});

test('R50-E original no-rewrite artifact reproduces ERR_MODULE_NOT_FOUND before the OFF branch',()=>{
 const out=artifact({rewriteRelativeImportExtensions:false});
 assert.throws(()=>runArtifact(out),/ERR_MODULE_NOT_FOUND[\s\S]*r50-operator-admission\.ts/);
});

for(const relative of ['src/lib/b1-2/r50-operator-admission.js',
 'src/lib/b1-2/r50-durable-grant-transport.js','src/data/bitevo-event-coverage.json']){
 test('R50-E missing packaged dependency is fatal: '+relative,()=>{
  const out=artifact();fs.rmSync(path.join(out,relative));
  assert.throws(()=>runArtifact(out),/ERR_MODULE_NOT_FOUND/);
 });
}

test('R50-E artifact cannot point outside its own package or fall back to a TS handler',()=>{
 const out=artifact();const metadata=path.join(out,'.vc-config.json');
 fs.writeFileSync(metadata,JSON.stringify({handler:'../api/event.js'}));
 assert.throws(()=>runArtifact(out),/escapes artifact/);
 fs.writeFileSync(metadata,JSON.stringify({handler:'api/event.ts'}));
 assert.throws(()=>runArtifact(out),/executable JavaScript/);
});

test('R50-E root fix and mandatory suite preserve R50-D protected gate rather than skip it',()=>{
 const tsconfig=JSON.parse(fs.readFileSync(path.join(sourceRoot,'tsconfig.json'),'utf8'));
 assert.equal(tsconfig.compilerOptions?.rewriteRelativeImportExtensions,true);
 const pkg=JSON.parse(fs.readFileSync(path.join(sourceRoot,'package.json'),'utf8'));
 const suffix='node --test --test-reporter=tap tests/b1-2-r50-operator-admission.test.mjs tests/b1-2-r50-durable-grant.test.mjs tests/b1-2-r50-package-runtime.test.mjs';
 assert.ok(pkg.scripts['verify:core'].endsWith(suffix));
 assert.equal(pkg.scripts['verify:core'].split('tests/b1-2-r50-package-runtime.test.mjs').length,2);
 assert.equal(pkg.scripts['build:core'],'npm run build:site && npm run verify:core');
 assert.doesNotMatch(suffix,/test-name-pattern|\|\|/);
});
