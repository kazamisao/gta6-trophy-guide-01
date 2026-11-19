// Puppeteer screenshot driver for Leonida Ledger.
// node scripts/pptr-shot.mjs <scenario> <out.jpg>  (scenario: cover|roadmap|missable|collectibles)
// Serves nothing itself: the app must already run at http://127.0.0.1:8080.
import puppeteer from '/home/hatch/workspace/polyester/browser/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const [scenario, out] = process.argv.slice(2);
const SEED = ['Just Like Paradise', 'Paradise Lost', 'T**s Ass Drug Money', 'Vice City, Baby!', 'Top Of The World, Ma', 'Trust', 'Break the Bank', 'Family Matters', 'DWNFALL', 'Hi-Jacked', 'Snow Storm', 'Stick Fiddler', 'Baited My Tackle'];
const ACTIONS = {
  cover: async (page) => {
    await page.evaluate(() => {
      document.querySelectorAll('.row').forEach((r) => { if (r.querySelector('h3')?.textContent === 'The Shootist') r.click(); });
    });
  },
  roadmap: async (page) => { await page.click('[data-view="roadmap"]'); },
  missable: async (page) => {
    await page.click('#spoiler');
    await page.click('[data-view="missable"]');
  },
  collectibles: async (page) => {
    await page.click('[data-kind="collectible"]');
    await page.evaluate(() => {
      document.querySelectorAll('.row').forEach((r) => { if (r.querySelector('h3')?.textContent === "Don't Touch My Deck") r.click(); });
    });
  },
};
if (!ACTIONS[scenario]) { console.error('unknown scenario', scenario); process.exit(2); }

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/opt/meta-chromium/chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1280,800'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('requestfailed', (r) => errors.push('reqfail: ' + r.url()));
await page.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForFunction('window.__shotReady === true', { timeout: 20000 });
// Seed 13 earned trophies, then reload so the app boots from the seeded store.
await page.evaluate((seed) => localStorage.setItem('leonida-ledger-v1', JSON.stringify(seed)), SEED);
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForFunction('window.__shotReady === true', { timeout: 20000 });
await ACTIONS[scenario](page);
await new Promise((r) => setTimeout(r, 800));
const state = await page.evaluate(() => ({
  earned: document.getElementById('earnedCount').textContent,
  rows: document.querySelectorAll('.row').length,
  detail: document.querySelector('.detail h2')?.textContent || 'none',
  progress: document.getElementById('progressBar').style.width,
}));
console.log('state:', JSON.stringify(state));
console.log('errors:', errors.length ? errors.join(' | ') : '(none)');
await page.screenshot({ path: out, type: 'jpeg', quality: 82 });
console.log('wrote', out);
await browser.close();
