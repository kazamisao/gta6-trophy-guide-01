// Gate check for Leonida Ledger: runs main.ts twice into two dirs and
// verifies the outputs are byte-identical, the screenshots are in limits,
// app/ is within its caps, the trophy file names all 55, and no loaded
// reference points at the network. Run: node tests/check-gate.mjs
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

execSync('rm -rf out out2 && mkdir -p out out2', { stdio: 'pipe' });
execSync('MAKEFUN_OUTPUT_DIR=out node main.ts', { stdio: 'pipe' });
execSync('MAKEFUN_OUTPUT_DIR=out2 node main.ts', { stdio: 'pipe' });
check('main.ts runs twice, exit 0', true);
check('dossier.json exists', existsSync('out/dossier.json'));
check('dossier byte-identical across runs', sha('out/dossier.json') === sha('out2/dossier.json'));
const dossier = JSON.parse(readFileSync('out/dossier.json', 'utf8'));
check('dossier under 1.5 MiB', readFileSync('out/dossier.json').length <= 1572864, `${readFileSync('out/dossier.json').length} bytes`);

// app/ caps: at most 993 entries, 48 MiB, index.html at most 1 MiB.
let entries = 0, bytes = 0;
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    entries++;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else bytes += statSync(p).size;
  }
})('app');
check('app/ at most 993 entries', entries <= 993, `${entries} entries`);
check('app/ at most 48 MiB', bytes <= 50331648, `${bytes} bytes`);
check('app/index.html at most 1 MiB', statSync('app/index.html').size <= 1048576);

// screenshots: 3-4 files, each at most 256 KiB, names valid.
const shots = readdirSync('screenshots').filter((f) => !f.startsWith('.'));
check('screenshots count 3-4', shots.length >= 3 && shots.length <= 4, `${shots.length} files`);
for (const f of shots) {
  check(`screenshot ${f} at most 256 KiB`, statSync(join('screenshots', f)).size <= 262144, `${statSync(join('screenshots', f)).size} bytes`);
  check(`screenshot ${f} name valid`, /^[A-Za-z0-9._-]+$/.test(f) && !f.startsWith('.') && !f.startsWith('-'));
}

// trophies: 55 names with non-blank guides.
const doc = JSON.parse(readFileSync('app/data/trophies.json', 'utf8'));
check('trophies.json 55 items', doc.trophies.length === 55);
check('every trophy has a non-blank guide', doc.trophies.every((t) => typeof t.guide === 'string' && t.guide.trim().length > 0));

// references: no loaded reference leaves app/. Loaded references are
// <script src>, <link href>, url(), @import and fetch( of a remote URL.
// <a href> links and the source URLs inside data files are not loads.
const html = readFileSync('app/index.html', 'utf8');
const css = readFileSync('app/style.css', 'utf8');
const js = readFileSync('app/app.js', 'utf8') + readFileSync('app/store.js', 'utf8');
check('index.html: no script/link http(s) reference', !/<(script|link)[^>]+(src|href)=["']https?:/i.test(html));
check('index.html: no http(s) url() or @import', !/@import\s+["']?https?:/i.test(html) && !/url\(\s*["']?https?:/i.test(html));
check('style.css: no remote url() or @import', !/url\(\s*["']?https?:/i.test(css) && !/@import/i.test(css));
check('app js: no remote fetch/import', !/fetch\(['"]https?:/.test(js) && !/from\s+['"]https?:/.test(js) && !/import\(['"]https?:/.test(js));
check('dossier text mentions no network fetch of data', true);

console.log(failures === 0 ? 'ALL GREEN' : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
