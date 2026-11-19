// Gate checks for the Leonida Ledger guide: 55 official trophies, each with a
// cited guide of its own words, a kind, a missable flag and a roadmap stage.
// Run: node tests/check-trophies.mjs  (exit 0 = all green)
import { readFileSync } from 'node:fs';

const OFFICIAL = [
  'Vice Got a Price!', 'Just Like Paradise', 'Paradise Lost', 'T**s Ass Drug Money',
  'Vice City, Baby!', 'Top Of The World, Ma', 'You Gotta Know When to Get Off',
  'Trust', 'Break the Bank', 'Family Matters', 'DWNFALL', 'Hi-Jacked', 'Snow Storm',
  'A Long Road', 'Cunning Stunts', 'Master of None', 'The Shootist', 'Top Fun',
  'Earn Cash, Not Kudos', 'Baited My Tackle', 'Stick Fiddler', 'Road to Rehabilitation',
  'This Was No Boat Accident', 'The Lone Rider', 'Strangers & Freaks', 'Supply & Demand',
  "Spin On This!", 'Positive Mental Attitude', 'Fair Game', "Don't Touch My Deck",
  'You WAiNKer!', 'One Last Thing', 'Hot Together', 'Retail Therapy', 'Whip It Good',
  'Gunslinger', 'Catch Me If You Can', 'Challenging Tank', 'Sneakthief',
  'Maximum Withdrawal', 'A Classic Blitz Play', 'The Goodtime State', 'Pest Control',
  'In The Beginning…', 'Capital Offense', 'Let’s Go Bowling', 'Personal Best',
  'Actions Speak Louder', 'Bad Luck, I Guess', 'The Truth Is Out There', 'Ten Pin',
  'Dime on the Dollar', 'Treat Yo Self', 'Little Boxes', 'On the Spot',
];
const KINDS = new Set(['story', 'side', 'collectible', 'activity', 'misc']);
const GRADES = new Set(['platinum', 'gold', 'silver', 'bronze']);

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}

const raw = readFileSync(new URL('../app/data/trophies.json', import.meta.url), 'utf8');
const doc = JSON.parse(raw);
const list = doc.trophies;
check('trophies array has 55 items', list.length === 55, `got ${list.length}`);
const names = new Set(list.map((t) => t.name));
for (const n of OFFICIAL) check(`official trophy present: ${n}`, names.has(n));
check('no duplicate names', names.size === list.length);
for (const t of list) {
  const tag = t.name;
  check(`${tag}: grade valid`, GRADES.has(t.grade));
  check(`${tag}: description non-blank`, typeof t.description === 'string' && t.description.trim().length > 0);
  check(`${tag}: guide >= 120 chars, own words`, typeof t.guide === 'string' && t.guide.trim().length >= 120, `len=${(t.guide || '').length}`);
  check(`${tag}: guide is not just the description`, t.guide.trim() !== t.description.trim());
  check(`${tag}: kind valid`, KINDS.has(t.kind), `kind=${t.kind}`);
  check(`${tag}: missable flag present`, t.missable === 'possible' || t.missable === 'no');
  check(`${tag}: roadmap stage 1-5`, Number.isInteger(t.roadmap) && t.roadmap >= 1 && t.roadmap <= 5);
  check(`${tag}: sources named`, Array.isArray(t.sources) && t.sources.length >= 2 && t.sources.every((s) => s.name && s.url));
}
const story = list.filter((t) => t.kind === 'story');
check('story kind non-empty', story.length >= 10, `story=${story.length}`);
check('missable possible non-empty', list.some((t) => t.missable === 'possible'));
check('no online trophies claimed', !list.some((t) => t.kind === 'online'));
const appJs = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
check('app.js fetches no remote URL', !/fetch\(['"]https?:/.test(appJs) && !/https?:\/\/[^'")\s]+/.test(appJs.replace(/https:\/\/www\.exophase\.com[^'")\s]*/g, '').replace(/https:\/\/psnprofiles\.com[^'")\s]*/g, '')));

console.log(failures === 0 ? 'ALL GREEN' : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
