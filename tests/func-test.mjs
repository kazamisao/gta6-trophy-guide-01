// Functional test for Leonida Ledger, run against the served app.
// node tests/func-test.mjs  (needs CHROME_PATH set to a stock Chromium;
// the served app must run at http://127.0.0.1:8080)
import puppeteer from '/home/hatch/workspace/polyester/browser/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { writeFileSync } from 'node:fs';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/opt/meta-chromium/chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle0' });
await page.waitForFunction('window.__shotReady === true', { timeout: 20000 });

// 1. Fresh load: 55 rows, 0 earned.
check('55 rows on load', (await page.$$eval('.row', (r) => r.length)) === 55);
check('0 earned on fresh load', (await page.$eval('#earnedCount', (e) => e.textContent)) === '0');

// 2. Tick a trophy, reload, still earned (localStorage persistence).
await page.evaluate(() => {
  document.querySelectorAll('.row input[type="checkbox"]')[1].click();
});
await new Promise((r) => setTimeout(r, 300));
check('1 earned after tick', (await page.$eval('#earnedCount', (e) => e.textContent)) === '1');
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForFunction('window.__shotReady === true', { timeout: 20000 });
check('1 earned after reload (localStorage)', (await page.$eval('#earnedCount', (e) => e.textContent)) === '1');

// 3. Import a progress file with 5 names.
const importFile = '/tmp/leonida-import-test.json';
writeFileSync(importFile, JSON.stringify({ app: 'leonida-ledger-progress', earned: ['Vice Got a Price!', 'Cunning Stunts', 'The Shootist', 'Top Fun', 'Little Boxes'] }));
const input = await page.$('#import');
await input.uploadFile(importFile);
await new Promise((r) => setTimeout(r, 500));
check('import sets 5 earned', (await page.$eval('#earnedCount', (e) => e.textContent)) === '5');

// 4. Spoiler setting hides an unearned story trophy's name.
await page.evaluate(() => { localStorage.setItem('leonida-ledger-v1', JSON.stringify([])); });
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForFunction('window.__shotReady === true', { timeout: 20000 });
await page.click('#spoiler');
await new Promise((r) => setTimeout(r, 300));
const hiddenName = await page.evaluate(() => document.querySelectorAll('.row h3')[1].textContent);
check('spoiler hides story name', hiddenName === 'Hidden story trophy', `got "${hiddenName}"`);
const hiddenDetail = await page.evaluate(() => { document.querySelectorAll('.row')[1].click(); return document.querySelector('.detail h2').textContent; });
check('spoiler hides detail pane', hiddenDetail === 'Hidden story trophy', `got "${hiddenDetail}"`);
await page.click('#spoiler');

// 5. Filters: missable shows 18, online shows the empty state, search works.
await page.click('[data-kind="missable"]');
await new Promise((r) => setTimeout(r, 300));
check('missable filter shows 18', (await page.$$eval('.row', (r) => r.length)) === 18);
await page.click('[data-kind="online"]');
await new Promise((r) => setTimeout(r, 300));
check('online filter shows empty state', await page.$eval('#emptyState', (e) => !e.hidden && e.textContent.includes('No online trophies')));
await page.click('[data-kind="all"]');
await page.type('#search', 'shooting range');
await new Promise((r) => setTimeout(r, 300));
check('search narrows to 2 rows', (await page.$$eval('.row', (r) => r.length)) === 2, 'search "shooting range" matches The Shootist + Master of None');
await page.evaluate(() => { document.getElementById('search').value = ''; document.getElementById('search').dispatchEvent(new Event('input')); });

// 6. Export click produces no page error (download fires as a blob link).
await page.click('#export');
await new Promise((r) => setTimeout(r, 500));

// 7. Missable view: ticking a row there updates the visible row itself.
await page.click('[data-view="missable"]');
await new Promise((r) => setTimeout(r, 300));
const beforeMiss = await page.$eval('#earnedCount', (e) => e.textContent);
await page.evaluate(() => { document.querySelector('#missablePane .row input[type="checkbox"]:not(:checked)')?.click(); });
await new Promise((r) => setTimeout(r, 300));
check('missable tick updates visible row', await page.$eval('#missablePane .row.earned', (e) => !!e));
check('missable tick updates count', (await page.$eval('#earnedCount', (e) => e.textContent)) !== beforeMiss);
await page.click('[data-view="checklist"]');

// 8. Roadmap view renders 5 stages; sources view renders the honesty note.
await page.click('[data-view="roadmap"]');
await new Promise((r) => setTimeout(r, 300));
check('roadmap shows 5 stages', (await page.$$eval('.stage', (s) => s.length)) === 5);
await page.click('[data-view="sources"]');
await new Promise((r) => setTimeout(r, 300));
check('sources view mentions Exophase', await page.$eval('#sourcesPane', (e) => e.textContent.includes('Exophase')));

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(failures === 0 ? 'ALL GREEN' : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
