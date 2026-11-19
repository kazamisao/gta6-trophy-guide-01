// CDP screenshot helper for Leonida Ledger: node scripts/shot.mjs <scenario> <out.jpg>
// Expects Chrome running headless with --remote-debugging-port=9222 and the
// app served at http://127.0.0.1:8080. Scenarios: cover, roadmap, missable,
// collectibles. Seeds 13 earned trophies in localStorage first so the
// progress bar, filters and detail pane show real state.
import { writeFileSync } from 'node:fs';

const [scenario, out] = process.argv.slice(2);
const PORT = 9222;
const URL = 'http://127.0.0.1:8080/';
const SEED = ['Just Like Paradise', 'Paradise Lost', 'T**s Ass Drug Money', 'Vice City, Baby!', 'Top Of The World, Ma', 'Trust', 'Break the Bank', 'Family Matters', 'DWNFALL', 'Hi-Jacked', 'Snow Storm', 'Stick Fiddler', 'Baited My Tackle'];

const SCENARIOS = {
  cover: `document.querySelectorAll('.row').forEach(r => { if (r.querySelector('h3')?.textContent === 'The Shootist') r.click(); });`,
  roadmap: `document.querySelector('[data-view="roadmap"]').click();`,
  missable: `document.getElementById('spoiler').click(); document.querySelector('[data-view="missable"]').click();`,
  collectibles: `document.querySelector('[data-kind="collectible"]').click(); document.querySelectorAll('.row').forEach(r => { if (r.querySelector('h3')?.textContent === "Don't Touch My Deck") r.click(); });`,
};
if (!SCENARIOS[scenario]) { console.error('unknown scenario', scenario); process.exit(2); }

async function getTarget() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
  return res.json();
}

const target = await getTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}
const evalJs = (expression) => send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
const pageErrors = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === 'Runtime.exceptionThrown') pageErrors.push(msg.params.exceptionDetails?.text + ': ' + (msg.params.exceptionDetails?.exception?.description || ''));
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') pageErrors.push(msg.params.entry.text + ' ' + (msg.params.entry.url || ''));
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
};
await new Promise((r) => { ws.onopen = r; });
await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL });
let ready = false;
for (let i = 0; i < 40 && !ready; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const r = await evalJs('window.__shotReady === true');
  ready = r?.result?.value === true;
}
console.log('ready:', ready);
// Seed progress, then reload so the app boots from the seeded store.
await evalJs(`localStorage.setItem('leonida-ledger-v1', JSON.stringify(${JSON.stringify(SEED)})); 'seeded'`);
await send('Page.navigate', { url: URL });
ready = false;
for (let i = 0; i < 40 && !ready; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const r = await evalJs('window.__shotReady === true');
  ready = r?.result?.value === true;
}
console.log('ready after seed:', ready);
const errors = await evalJs(`(window.__errors || []).join(' | ')`);
console.log('page errors:', pageErrors.length ? pageErrors.join(' | ') : '(none)');
await evalJs(SCENARIOS[scenario]);
await new Promise((r) => setTimeout(r, 800));
const state = await evalJs(`document.getElementById('earnedCount').textContent + ' earned; rows=' + document.querySelectorAll('.row').length + '; detail=' + (document.querySelector('.detail h2')?.textContent || 'none')`);
console.log('state:', state?.result?.value);
const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log('wrote', out);
process.exit(0);
