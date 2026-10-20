// Offline smoke for emitted JS or an actual @vercel/node function artifact.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const SOURCES = [
  'api/event.ts', 'src/lib/b1-2/r50-operator-admission.ts',
  'src/lib/b1-2/r50-durable-grant-transport.ts'
];
const DATA = ['src/data/public-route-registry.json','src/data/bitevo-event-coverage.json'];

// This producer is a compiler-derived fixture, NOT a claim of provider bundling.
// The same runArtifact checker also accepts an independently produced bundle.
export function compileSnapshot(sourceRoot, outputRoot, override = {}) {
  const pkg = JSON.parse(fs.readFileSync(path.join(sourceRoot,'package.json'),'utf8'));
  const ts = require(process.env.BITEVO_R50E_TYPESCRIPT_PATH || 'typescript');
  assert.equal(ts.version,pkg.devDependencies.typescript,'use the pinned project compiler');
  const config = ts.getParsedCommandLineOfConfigFile(path.join(sourceRoot,'tsconfig.json'), {}, {
    ...ts.sys, onUnRecoverableConfigFileDiagnostic(d) { throw Error(ts.flattenDiagnosticMessageText(d.messageText,' ')); }
  });
  assert.ok(config,'root compiler configuration missing');
  const options = { ...config.options, noEmit:false, declaration:false,
    emitDeclarationOnly:false, sourceMap:false, inlineSourceMap:false, inlineSources:false, ...override };
  fs.mkdirSync(outputRoot,{recursive:true});
  for (const relative of SOURCES) {
    const input = fs.readFileSync(path.join(sourceRoot,relative),'utf8');
    const output = ts.transpileModule(input,{fileName:path.join(sourceRoot,relative),compilerOptions:options});
    const dest = path.join(outputRoot,relative.replace(/\.ts$/,'.js'));
    fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,output.outputText);
  }
  for(const relative of DATA) {
    const dest=path.join(outputRoot,relative);fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.copyFileSync(path.join(sourceRoot,relative),dest);
  }
  fs.writeFileSync(path.join(outputRoot,'package.json'),JSON.stringify({type:pkg.type})+'\n');
  fs.writeFileSync(path.join(outputRoot,'.vc-config.json'),JSON.stringify({handler:'api/event.js',runtime:'nodejs24.x'})+'\n');
  return {compiler:ts.version,rewriteRelativeImportExtensions:options.rewriteRelativeImportExtensions===true,kind:'COMPILER_DERIVED'};
}

export function runArtifact(artifactRoot) {
  const root=fs.realpathSync(artifactRoot);
  const config=JSON.parse(fs.readFileSync(path.join(root,'.vc-config.json'),'utf8'));
  assert.equal(typeof config.handler,'string');
  const relative=config.handler.replaceAll('\\','/');
  assert.ok(/\.(?:js|mjs|cjs)$/.test(relative),'artifact must contain executable JavaScript');
  const entry=path.resolve(root,relative);
  assert.ok(entry.startsWith(root+path.sep),'handler escapes artifact');
  const entryUrl=pathToFileURL(entry).href;
  const childSource = `
    import assert from 'node:assert/strict';
    import {createRequire,syncBuiltinESMExports} from 'node:module';
    const require=createRequire(import.meta.url);let networkAttempts=0;
    const deny=()=>{networkAttempts++;throw Error('R50E_NETWORK_FORBIDDEN')};
    globalThis.fetch=deny;
    for(const n of ['node:http','node:https']){const m=require(n);m.request=deny;m.get=deny;}
    require('node:net').Socket.prototype.connect=deny;syncBuiltinESMExports();
    const mod=await import(${JSON.stringify(entryUrl)});
    assert.equal(typeof mod.default?.fetch,'function');
    const results=[];
    for(const method of ['GET','POST']){
      const request=new Request('https://bitevo.work/api/event',{method});
      const response=await mod.default.fetch(request);
      assert.equal(response.status,404);
      assert.deepEqual(await response.json(),{ok:false,error:'NOT_FOUND'});
      assert.equal(response.headers.get('cache-control'),'no-store');
      results.push({method,status:404,mode:'OFF'});
    }
    const denied=await mod.handleBitEvoPublicEvent(new Request('https://bitevo.work/api/event',{method:'POST'}),{BITEVO_EVENT_COUNTER_ENABLED:'true'});
    assert.equal(denied.status,503);assert.equal((await denied.json()).error,'COUNTER_NOT_READY');
    assert.equal(networkAttempts,0);
    console.log('R50_ARTIFACT_SMOKE='+JSON.stringify({pass:true,imported:true,results,partialConfigStatus:503,networkAttempts}));
  `;
  // Do not inherit NODE_PATH, NODE_OPTIONS, credentials or provider settings.
  const env={};for(const k of ['SystemRoot','WINDIR','PATH','Path','TEMP','TMP','TMPDIR'])if(process.env[k])env[k]=process.env[k];
  const result=spawnSync(process.execPath,['--no-experimental-strip-types','--input-type=module','-e',childSource],{
    cwd:root,env,encoding:'utf8',timeout:15000,maxBuffer:256*1024,windowsHide:true
  });
  if(result.error || result.status!==0)throw Error('ARTIFACT_RUNTIME_FAILED '+(result.stderr||result.error||result.stdout).slice(0,2500));
  const marker=result.stdout.split(/\r?\n/).find(x=>x.startsWith('R50_ARTIFACT_SMOKE='));
  assert.ok(marker,'missing child runtime receipt');
  return JSON.parse(marker.slice('R50_ARTIFACT_SMOKE='.length));
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.equal(process.argv.length,4,'usage: node scripts/r50-function-artifact-smoke.mjs --artifact-root PATH');
  assert.equal(process.argv[2],'--artifact-root');
  console.log('R50_PACKAGED_FUNCTION_SMOKE='+JSON.stringify(runArtifact(path.resolve(process.argv[3]))));
}
