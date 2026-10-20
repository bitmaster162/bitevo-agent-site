// LOCAL OFFLINE ONLY. No live-send mode, credentials, real CTA request or D1.
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CACHE = 'D:/BITEVO_SEO_CACHE_20261016';
const CTA = 'https://cal.com/robert-dumanyan-vlck0x/free-20-minute-triage';
if(process.argv.length!==3||process.argv[2]!=='--offline-smoke')
  throw Error('R50_REHEARSAL_DENIED: only --offline-smoke supported');
if(!fs.existsSync(CHROME)||!fs.existsSync(CACHE))throw Error('Chrome or QA cache missing');

const html = [
'<!doctype html><html lang="en"><head><meta charset="utf-8">',
'<meta name="viewport" content="width=device-width,initial-scale=1">',
'<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; connect-src \'none\'">',
'<title>R50 local operator rehearsal: counter OFF</title>',
'<style>body{font-family:system-ui;margin:20px;max-width:640px}',
'a{display:inline-block;min-height:38px;padding:8px 12px;border:1px solid #888}</style>',
'</head><body><h1>Offline operator rehearsal</h1>',
'<p>This fixture never sends events or opens booking links.</p>',
'<a id="triage" href="__CTA__">Book a free triage</a>',
'<script>(()=>{\'use strict\';',
'const state={armed:true,count:0,event:null,page:null,locale:null,mode:"OFFLINE_SIMULATION"};',
'Object.defineProperty(window,"__r50Rehearsal",{value:state,writable:false});',
'document.getElementById("triage").addEventListener("click",evt=>{',
'evt.preventDefault();if(!state.armed)return;state.armed=false;state.count++;',
'state.event="triage_click";state.page="/agent-authority-audit";state.locale="en";',
'});})();</script></body></html>'
].join('').replace('__CTA__',CTA);
assert(!html.includes('BITEVO_EVENT_COUNTER_SIGNING_SECRET'));
assert(!html.includes('x-bitevo-r50-operator-token'));
assert(!html.includes('https://bitevo.work/api/event'));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const profile=fs.mkdtempSync(path.join(CACHE,'r50-local-browser-'));
let server=null,browser=null,ws=null,seq=0;
const pending=new Map(),requests=[],report=[];
async function freePort(){
 return new Promise((resolve,reject)=>{
  const s=net.createServer();s.once('error',reject);
  s.listen(0,'127.0.0.1',()=>{
   const port=s.address().port;s.close(()=>resolve(port));
  });
 });
}
async function until(fn,ms=15000){
 const start=Date.now();let reason='';
 while(Date.now()-start<ms){
  try{const x=await fn();if(x)return x;}catch(e){reason=String(e);}
  await sleep(200);
 }throw Error('BROWSER_TIMEOUT '+reason);
}
function command(method,params={}){
 return new Promise((resolve,reject)=>{
  const id=++seq;
  const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},8000);
  pending.set(id,msg=>{
   clearTimeout(timer);
   if(msg.error)reject(Error(method+': '+msg.error.message));else resolve(msg.result);
  });
  ws.send(JSON.stringify({id,method,params}));
 });
}
async function evaluate(expression){
 const result=await command('Runtime.evaluate',{expression,returnByValue:true});
 if(result.exceptionDetails)throw Error('JS exception in local fixture');
 return result.result?.value;
}
async function click(x,y){
 await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x,y});
 await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x,y});
}
try{
 server=http.createServer((req,res)=>{
  requests.push({method:req.method,url:req.url,external:false});
  if(req.method!=='GET'||req.url!=='/'){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
  res.end(html);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const app='http://127.0.0.1:'+server.address().port+'/';
 const debug=await freePort();
 browser=spawn(CHROME,['--headless=new','--no-first-run','--no-default-browser-check',
  '--disable-gpu','--disable-background-networking','--disable-extensions','--disable-sync',
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
  '--remote-debugging-address=127.0.0.1','--remote-debugging-port='+debug,
  '--user-data-dir='+profile,'--window-size=1280,900','about:blank'
 ],{stdio:'ignore',windowsHide:true});
 const target=await until(async()=>{
  const res=await fetch('http://127.0.0.1:'+debug+'/json/list');
  if(!res.ok)return null;
  return (await res.json()).find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
 });
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{
  ws.addEventListener('open',resolve,{once:true});
  ws.addEventListener('error',reject,{once:true});
 });
 ws.addEventListener('message',event=>{
  const p=JSON.parse(event.data);
  if(p.method==='Network.requestWillBeSent')requests.push({
   url:p.params.request.url,method:p.params.request.method,
   external:!p.params.request.url.startsWith(app)
  });
  if(p.id&&pending.has(p.id)){
   const f=pending.get(p.id);pending.delete(p.id);f(p);
  }
 });
 await command('Page.enable');await command('Runtime.enable');await command('Network.enable');
 for(const width of [390,1280]){
  await command('Emulation.setDeviceMetricsOverride',
   {width,height:844,deviceScaleFactor:1,mobile:width===390});
  const nav=await command('Page.navigate',{url:app});
  if(nav.errorText)throw Error('local navigation failed');
  const rect=await until(async()=>{
   const v=await evaluate('(()=>{const a=document.getElementById("triage");if(document.readyState!=="complete"||!a)return null;const b=a.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,href:a.href,w:innerWidth,scroll:document.documentElement.scrollWidth};})()');
   return v?.href===CTA?v:null;
  });
  assert.equal(rect.w,width);
  assert.ok(rect.scroll<=width);
  await click(rect.x,rect.y);await sleep(120);
  await click(rect.x,rect.y);await sleep(120);
  const state=await evaluate('(()=>{const s=window.__r50Rehearsal;return {count:s.count,armed:s.armed,event:s.event,page:s.page,locale:s.locale,mode:s.mode,host:location.hostname};})()');
  assert.deepEqual(state,{count:1,armed:false,event:'triage_click',
   page:'/agent-authority-audit',locale:'en',mode:'OFFLINE_SIMULATION',host:'127.0.0.1'});
  report.push({width,clicks:2,acceptedIntents:1,externalRequests:0});
 }
 assert.equal(requests.filter(x=>x.external).length,0);
 assert.equal(requests.filter(x=>x.method==='POST').length,0);
 console.log('R50_OFFLINE_BROWSER=PASS '+JSON.stringify({report,
  totalRequests:requests.length,externalRequests:0,eventPOSTs:0,realCTAClicks:0}));
} catch(err) {
 console.error('R50_OFFLINE_BROWSER=FAIL '+String(err));process.exitCode=1;
} finally {
 try{ws?.close();}catch{}
 try{browser?.kill();}catch{}
 if(server?.listening)await new Promise(resolve=>server.close(resolve));
 try{fs.rmSync(profile,{recursive:true,force:true});}catch{}
}
