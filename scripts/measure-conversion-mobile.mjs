// Read-only production measurement on the Linux GitHub runner. No form interactions.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { once } from 'node:events';

const routes = ['https://bitevo.work/', 'https://bitevo.work/start', 'https://bitevo.work/audit-intake',
  'https://aiskillab.work/', 'https://aiskillab.work/start'];
const analytics = /analytics|insights|pageview|plausible|umami|collect|beacon|mypageviews/i;
const ua = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36';

function connect(child) {
  let seq = 0;
  let buffer = '';
  const calls = new Map();
  const listeners = new Set();
  child.stdio[4].setEncoding('utf8').on('data', chunk => {
    buffer += chunk;
    let end;
    while ((end = buffer.indexOf('\0')) >= 0) {
      const packet = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      const call = calls.get(packet.id);
      if (call) {
        calls.delete(packet.id);
        if (packet.error) call.reject(Error(packet.error.message));
        else call.resolve(packet.result);
      } else for (const listen of listeners) listen(packet);
    }
  });
  return {
    on(fn) { listeners.add(fn); },
    send(method, params = {}, sessionId) {
      const id = ++seq;
      return new Promise((resolve, reject) => {
        calls.set(id, { resolve, reject });
        child.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
      });
    },
  };
}

function layout() {
  const { responseStart, domContentLoadedEventEnd, loadEventEnd } = performance.getEntriesByType('navigation')[0];
  const targets = [...document.querySelectorAll('a[href],button')].filter(e => {
    if (!e.getClientRects().length) return false;
    const rect = e.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.left >= 0 &&
      /Заявк|Написать|Продолжить|знакомств|Обсудить|Telegram|WhatsApp|Start here|triage|short scope|Scope brief|Entry Audit|Generate Entry|Submit|Send scope/i.test(e.innerText);
  }).slice(0, 10).map(e => {
    const r = e.getBoundingClientRect();
    return { text: e.innerText.trim().replace(/\s+/g, ' ').slice(0, 64),
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
  return { viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth,
    targets, ttfbMs: Math.round(responseStart), dclMs: Math.round(domContentLoadedEventEnd),
    loadMs: Math.round(loadEventEnd),
    fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
    lcpSampleMs: window.r1Metrics.lcp, clsSample: window.r1Metrics.cls };
}

async function measure(url, width, trial) {
  const profile = await mkdtemp(join(tmpdir(), 'conversion-chrome-'));
  const child = spawn('google-chrome', ['--headless', '--no-sandbox', '--disable-dev-shm-usage',
    '--disable-extensions', '--disable-background-networking', '--no-first-run', '--remote-debugging-pipe',
    '--user-data-dir=' + profile, 'about:blank'], { stdio: ['ignore','ignore','ignore','pipe','pipe'] });
  const exit = once(child, 'close');
  const cdp = connect(child);
  let timer;
  try {
    const sample = async () => {
      const { product } = await cdp.send('Browser.getVersion');
      const { targetId } = await cdp.send('Target.createTarget', { url:'about:blank' });
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten:true });
      const send = (method, params) => cdp.send(method, params, sessionId);
      await send('Page.enable');
      await send('Network.enable');
      await send('Network.setCacheDisabled', { cacheDisabled:true });
      await send('Network.setUserAgentOverride', { userAgent:ua });
      await send('Emulation.setDeviceMetricsOverride', { width, height:844, deviceScaleFactor:2, mobile:true });
      await send('Page.addScriptToEvaluateOnNewDocument', { source:
        "window.r1Metrics={lcp:null,cls:0};new PerformanceObserver(l=>{for(const e of l.getEntries())r1Metrics.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)r1Metrics.cls+=e.value}).observe({type:'layout-shift',buffered:true});" });
      const events = new Map();
      let status;
      let finish;
      const loaded = new Promise(resolve => { finish=resolve; });
      cdp.on(packet => {
        if (packet.sessionId !== sessionId) return;
        const p = packet.params || {};
        if (packet.method === 'Page.loadEventFired') finish();
        if (packet.method === 'Network.requestWillBeSent') {
          const u = new URL(p.request.url);
          if (analytics.test(u.host + u.pathname))
            events.set(p.requestId, { path:u.origin + u.pathname, method:p.request.method, status:'pending' });
        }
        if (packet.method === 'Network.responseReceived') {
          if (p.type === 'Document' && p.response.url.replace(/\/$/, '') === url.replace(/\/$/, '')) status=p.response.status;
          if (events.has(p.requestId)) events.get(p.requestId).status=p.response.status;
        }
        if (packet.method === 'Network.loadingFailed' && events.has(p.requestId))
          events.get(p.requestId).status=p.errorText;
      });
      const nav = await send('Page.navigate', { url });
      if (nav.errorText) throw Error(nav.errorText);
      await loaded;
      await delay(1800);
      const result = await send('Runtime.evaluate', { expression:'(' + layout.toString() + ')()', returnByValue:true });
      if (result.exceptionDetails || !result.result.value || status !== 200) throw Error('Incomplete page, HTTP ' + status);
      return { url,width,trial,product,status,...result.result.value,analytics:[...events.values()] };
    };
    return await Promise.race([sample(), exit.then(() => { throw Error('Chrome exited'); }),
      new Promise((_, reject) => { timer=setTimeout(() => reject(Error('Chrome timed out')), 35000); })]);
  } finally {
    clearTimeout(timer);
    child.kill('SIGKILL');
    await exit.catch(() => {});
    await rm(profile,{recursive:true,force:true,maxRetries:3});
  }
}

console.log('Real public pages, new Chrome profile per load, 844px tall, DPR 2, no CPU/network throttle, 1.8s observation after load. Sampled vitals, not field data.');
let failures = 0;
for (const url of routes) for (const width of [320,390]) for (const trial of [1,2,3]) {
  try { console.log('MOBILE ' + JSON.stringify(await measure(url,width,trial))); }
  catch (error) { console.error('MOBILE_ERROR', url, width, trial, error.message); failures++; }
}
if (failures) process.exitCode=1;
