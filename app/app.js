// Leonida Ledger — boot, filters, checklist, detail pane, roadmap and
// missable views for the 55 GTA VI trophies. Static data only: the app
// fetches data/trophies.json from its own files and nothing else.
import { loadProgress, saveProgress, exportProgress, parseProgressFile } from './store.js';

const KIND_LABELS = { story: 'Story', side: 'Stranger strand', collectible: 'Collectible', activity: 'Activity', misc: 'Open world' };
const ROADMAP_STAGES = [
  { n: 1, title: 'Play the story', advice: 'Main missions in order, Chapters 1–4 and the final mission. Take every story-mission trophy on the first pass: the descriptions do not say missions can be replayed.' },
  { n: 2, title: 'Stranger strands', advice: 'Finish the stranger strands — Andy, Kenton, Billy, Randy, Tyrone and more — until 8 are complete. A strand only counts when its final mission is done.' },
  { n: 3, title: 'Activities & skills', advice: 'The skill trophies: 250 stunts, gold in all 42 Shooting Range challenges, 20 different races, 14 drone-race locations, 18 meditation spots, and the samplers. One activity type at a time.' },
  { n: 4, title: 'Collectibles & exploring', advice: 'All 52 areas of Leonida, 3 card sets, 100 WAiNK locations, 100 vehicles discovered, 8 garages and 10 Scooter Bros registrations, plus the beach, the showroom and the bowling alley.' },
  { n: 5, title: 'Economy, clean-up & platinum', advice: 'Launder $250,000, spend $100,000, rob the vaults, trucks and gang operations, escape the wanted levels — and let the cumulative trophies land. 100% completion and the platinum close the ledger.' },
];

const state = {
  trophies: [],
  earned: loadProgress(),
  selected: null,
  view: 'checklist',
  kind: 'all',
  grade: 'all',
  search: '',
  spoiler: false,
  hideEarned: false,
};

const $ = (id) => document.getElementById(id);

// A story trophy is spoiler-hidden until it is earned, when the reader
// asked for spoilers to be hidden. Everything else is always shown.
export function spoilerHides(trophy) {
  return state.spoiler && trophy.kind === 'story' && !state.earned.has(trophy.name);
}

export function visibleTrophies() {
  const q = state.search.trim().toLowerCase();
  return state.trophies.filter((t) => {
    if (state.kind === 'missable' && t.missable !== 'possible') return false;
    if (state.kind === 'online') return false;
    if (state.kind !== 'all' && state.kind !== 'missable' && t.kind !== state.kind) return false;
    if (state.grade !== 'all' && t.grade !== state.grade) return false;
    if (state.hideEarned && state.earned.has(t.name)) return false;
    // A spoiler-hidden trophy is searchable only by its placeholder text,
    // so a search can never leak a hidden name, description or guide.
    const haystack = spoilerHides(t) ? 'hidden story trophy' : `${t.name} ${t.description} ${t.guide} ${t.target || ''}`;
    if (q && !haystack.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function nextUpTrophies() {
  return [...state.trophies]
    .filter((t) => !state.earned.has(t.name))
    .sort((a, b) => a.roadmap - b.roadmap || a.id - b.id)
    .slice(0, 3);
}

function gradeBadge(trophy) {
  const span = document.createElement('span');
  span.className = `tag grade-${trophy.grade}`;
  span.textContent = trophy.grade;
  return span;
}

function kindTag(trophy) {
  const span = document.createElement('span');
  span.className = 'tag';
  span.textContent = KIND_LABELS[trophy.kind] || trophy.kind;
  return span;
}

function missableTag(trophy) {
  if (trophy.missable !== 'possible') return null;
  const span = document.createElement('span');
  span.className = 'tag missable';
  span.textContent = 'Possibly missable';
  return span;
}

function renderRow(trophy) {
  const li = document.createElement('li');
  li.className = 'row' + (state.earned.has(trophy.name) ? ' earned' : '') + (state.selected === trophy.name ? ' selected' : '');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = state.earned.has(trophy.name);
  box.setAttribute('aria-label', `Earned: ${spoilerHides(trophy) ? 'hidden story trophy' : trophy.name}`);
  box.addEventListener('change', () => {
    if (box.checked) state.earned.add(trophy.name);
    else state.earned.delete(trophy.name);
    saveProgress(state.earned);
    renderActiveView();
    updateProgress();
    renderDetail();
  });
  box.addEventListener('click', (e) => e.stopPropagation());
  const body = document.createElement('div');
  const h = document.createElement('h3');
  h.textContent = spoilerHides(trophy) ? 'Hidden story trophy' : trophy.name;
  if (spoilerHides(trophy)) h.className = 'spoiler-name';
  body.append(h);
  const desc = document.createElement('p');
  desc.className = 'desc';
  desc.textContent = spoilerHides(trophy) ? 'Earn it to reveal its name and guide.' : trophy.description;
  body.append(desc);
  const tags = document.createElement('div');
  tags.className = 'tags';
  tags.append(gradeBadge(trophy), kindTag(trophy));
  const miss = missableTag(trophy);
  if (miss) tags.append(miss);
  body.append(tags);
  if (!spoilerHides(trophy) && trophy.target) {
    const target = document.createElement('p');
    target.className = 'target';
    target.textContent = `Target: ${trophy.target}`;
    body.append(target);
  }
  const open = document.createElement('button');
  open.type = 'button';
  open.textContent = 'Guide ›';
  open.addEventListener('click', (e) => { e.stopPropagation(); selectTrophy(trophy.name); });
  li.append(box, body, open);
  li.addEventListener('click', () => selectTrophy(trophy.name));
  li.tabIndex = 0;
  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTrophy(trophy.name); }
  });
  return li;
}

// Re-render whichever view is on screen, so a tick, a filter or a spoiler
// toggle in the Roadmap or Missable view updates what the reader sees.
export function renderActiveView() {
  renderChecklist();
  if (state.view === 'roadmap') renderRoadmap();
  if (state.view === 'missable') renderMissable();
}

export function renderChecklist() {
  const rows = $('rows');
  rows.replaceChildren();
  const list = visibleTrophies();
  for (const t of list) rows.append(renderRow(t));
  const shown = list.length;
  $('listSummary').textContent = `${shown} of ${state.trophies.length} trophies shown · ${state.earned.size} earned`;
  const empty = $('emptyState');
  if (shown === 0) {
    empty.hidden = false;
    empty.textContent = state.kind === 'online'
      ? 'No online trophies: the official list holds no online trophy — all 55 are single-player as described. Try another filter.'
      : 'No trophies match these filters. Clear the search or pick another kind.';
  } else {
    empty.hidden = true;
  }
  const note = $('filterNote');
  if (state.kind === 'missable') {
    note.hidden = false;
    note.textContent = '“Possibly missable” is a caution flag built from the official descriptions: these trophies are tied to story chapters, story missions or stranger strands, and the descriptions do not say they can be replayed. Earn them on your first pass.';
  } else if (state.kind === 'online') {
    note.hidden = false;
    note.textContent = 'The official list holds no online trophy. All 55 are single-player as described — this filter is empty by design, not by mistake.';
  } else {
    note.hidden = true;
  }
}

function sourceLink(source) {
  const a = document.createElement('a');
  a.href = source.url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = source.name;
  return a;
}

export function renderDetail() {
  const pane = $('detailPane');
  pane.replaceChildren();
  const trophy = state.trophies.find((t) => t.name === state.selected) || state.trophies[0];
  if (!trophy) return;
  // Prev/Next is built first so it stays available even when the selected
  // trophy is spoiler-hidden and the pane shows the hidden message.
  const idx = state.trophies.indexOf(trophy);
  const nav = document.createElement('div');
  nav.className = 'nav';
  const prev = document.createElement('button');
  prev.type = 'button';
  prev.textContent = '‹ Previous';
  prev.addEventListener('click', () => selectTrophy(state.trophies[(idx + state.trophies.length - 1) % state.trophies.length].name));
  const next = document.createElement('button');
  next.type = 'button';
  next.textContent = 'Next ›';
  next.addEventListener('click', () => selectTrophy(state.trophies[(idx + 1) % state.trophies.length].name));
  nav.append(prev, next);
  if (spoilerHides(trophy)) {
    const h = document.createElement('h2');
    h.textContent = 'Hidden story trophy';
    const p = document.createElement('p');
    p.textContent = 'Spoilers are hidden. Earn this trophy to reveal its name, description and guide — or switch the spoiler setting off.';
    pane.append(h, p, nav);
    return;
  }
  const h = document.createElement('h2');
  h.textContent = trophy.name;
  const tags = document.createElement('div');
  tags.className = 'tags';
  tags.append(gradeBadge(trophy), kindTag(trophy));
  const miss = missableTag(trophy);
  if (miss) tags.append(miss);
  const desc = document.createElement('p');
  desc.className = 'desc';
  desc.textContent = `Official description: ${trophy.description}`;
  const targetH = document.createElement('h4');
  targetH.textContent = 'Target';
  const target = document.createElement('p');
  target.textContent = trophy.target || 'See the official description.';
  const guideH = document.createElement('h4');
  guideH.textContent = 'Guide — our own words';
  const guide = document.createElement('p');
  guide.className = 'guide';
  guide.textContent = trophy.guide;
  const srcH = document.createElement('h4');
  srcH.textContent = 'Sources';
  const src = document.createElement('p');
  src.className = 'sources';
  src.textContent = 'Name, description, grade and count from: ';
  for (const s of trophy.sources) src.append(sourceLink(s), document.createTextNode(' '));
  pane.append(h, tags, desc, targetH, target, guideH, guide, srcH, src);
  if (trophy.missable === 'possible' && trophy.missable_note) {
    const warn = document.createElement('p');
    warn.className = 'warn';
    warn.textContent = `Possibly missable: ${trophy.missable_note}`;
    pane.append(warn);
  }
  pane.append(nav);
}

export function selectTrophy(name) {
  state.selected = name;
  renderActiveView();
  renderDetail();
}

export function renderRoadmap() {
  const pane = $('roadmapPane');
  pane.replaceChildren();
  const h = document.createElement('h2');
  h.textContent = 'Roadmap to the platinum';
  const intro = document.createElement('p');
  intro.textContent = 'Five stages, in order. Story first — the missable flags live there — then stranger strands, activities, collectibles, and the economy clean-up. The platinum is the last line of stage 5: it pops when the other 54 are earned.';
  pane.append(h, intro);
  for (const stage of ROADMAP_STAGES) {
    const box = document.createElement('div');
    box.className = 'stage';
    const title = document.createElement('h3');
    title.textContent = `Stage ${stage.n} — ${stage.title}`;
    const advice = document.createElement('p');
    advice.textContent = stage.advice;
    const count = document.createElement('p');
    count.className = 'count';
    const members = state.trophies.filter((t) => t.roadmap === stage.n);
    const done = members.filter((t) => state.earned.has(t.name)).length;
    count.textContent = `${done} of ${members.length} earned in this stage`;
    const ul = document.createElement('ul');
    for (const t of members) {
      const li = document.createElement('li');
      if (state.earned.has(t.name)) li.className = 'done';
      li.textContent = `${spoilerHides(t) ? 'Hidden story trophy' : t.name} — ${t.grade}${t.missable === 'possible' ? ' · possibly missable' : ''}`;
      ul.append(li);
    }
    box.append(title, advice, count, ul);
    pane.append(box);
  }
}

export function renderMissable() {
  const pane = $('missablePane');
  pane.replaceChildren();
  const h = document.createElement('h2');
  h.textContent = 'Missable trophies';
  const intro = document.createElement('p');
  intro.textContent = '18 trophies are flagged “possibly missable”. The flag is a caution built from the official descriptions, not a confirmed fact: each of these is tied to a story chapter, a story mission or a stranger strand, and no description says those chapters, missions or strands can be replayed. Earn them on your first pass; everything else can be cleaned up after the story.';
  const note = document.createElement('p');
  note.className = 'warn';
  note.textContent = 'No trophy in the official list is confirmed missable by any source yet — the game is a day old. These flags say “do it now, just in case”, not “you will lose it”.';
  pane.append(h, intro, note);
  const ul = document.createElement('ul');
  ul.className = 'rows';
  for (const t of state.trophies.filter((t) => t.missable === 'possible')) {
    ul.append(renderRow(t));
  }
  pane.append(ul);
}

export function updateProgress() {
  $('earnedCount').textContent = String(state.earned.size);
  $('progressBar').style.width = `${Math.round((state.earned.size / state.trophies.length) * 100)}%`;
  const byGrade = {};
  for (const t of state.trophies) byGrade[t.grade] = (byGrade[t.grade] || 0) + (state.earned.has(t.name) ? 1 : 0);
  const totals = {};
  for (const t of state.trophies) totals[t.grade] = (totals[t.grade] || 0) + 1;
  $('gradeCounts').textContent = ['platinum', 'gold', 'silver', 'bronze']
    .map((g) => `${byGrade[g] || 0}/${totals[g] || 0} ${g}`).join(' · ');
  const next = nextUpTrophies();
  $('nextUp').textContent = next.length
    ? `Next up: ${next.map((t) => (spoilerHides(t) ? 'Hidden story trophy' : t.name)).join(' · ')}`
    : 'All 55 earned — Leonida Legend.';
}

function setView(view) {
  state.view = view;
  for (const tab of document.querySelectorAll('.tab')) {
    const active = tab.dataset.view === view;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-pressed', String(active));
  }
  $('roadmapPane').hidden = view !== 'roadmap';
  $('missablePane').hidden = view !== 'missable';
  $('sourcesPane').hidden = view !== 'sources';
  document.querySelector('.layout').style.display = view === 'checklist' ? '' : 'none';
  // The search, kind, grade, spoiler and file controls only drive the
  // checklist, so they are shown only there — never as dead controls.
  document.querySelector('.controls').style.display = view === 'checklist' ? '' : 'none';
  if (view === 'roadmap') renderRoadmap();
  if (view === 'missable') renderMissable();
}

export async function bootGuide() {
  let doc;
  try {
    doc = await (await fetch('data/trophies.json')).json();
  } catch {
    // A failed data load must never leave a silent blank page: say so.
    $('listSummary').textContent = 'The guide data could not be loaded.';
    const empty = $('emptyState');
    empty.hidden = false;
    empty.textContent = 'The trophy list (data/trophies.json) could not be loaded. Serve this folder over HTTP — for example, run node serve.ts in the repository and open the address it prints — instead of opening the file directly.';
    window.__shotReady = true;
    return;
  }
  state.trophies = doc.trophies;
  if (!state.selected && state.trophies.length) {
    state.selected = (state.trophies.find((t) => t.kind === 'story') || state.trophies[0]).name;
  }
  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => setView(tab.dataset.view));
  }
  for (const chip of document.querySelectorAll('.chip')) {
    chip.addEventListener('click', () => {
      state.kind = chip.dataset.kind;
      for (const c of document.querySelectorAll('.chip')) c.classList.toggle('active', c === chip);
      renderActiveView();
    });
  }
  $('grade').addEventListener('change', (e) => { state.grade = e.target.value; renderActiveView(); });
  $('search').addEventListener('input', (e) => { state.search = e.target.value; renderActiveView(); });
  $('spoiler').addEventListener('change', (e) => { state.spoiler = e.target.checked; renderActiveView(); renderDetail(); updateProgress(); });
  $('hideEarned').addEventListener('change', (e) => { state.hideEarned = e.target.checked; renderActiveView(); });
  $('export').addEventListener('click', () => exportProgress(state.earned));
  $('import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const parsed = parseProgressFile(await file.text());
    if (parsed) {
      state.earned = new Set([...parsed].filter((name) => state.trophies.some((t) => t.name === name)));
      saveProgress(state.earned);
      renderActiveView();
      updateProgress();
      renderDetail();
    } else {
      window.alert('That file is not a Leonida Ledger progress export.');
    }
    e.target.value = '';
  });
  $('reset').addEventListener('click', () => {
    if (window.confirm('Reset all progress? This clears every tick.')) {
      state.earned = new Set();
      saveProgress(state.earned);
      renderActiveView();
      updateProgress();
      renderDetail();
    }
  });
  renderChecklist();
  renderDetail();
  updateProgress();
  window.__shotReady = true;
}

await bootGuide();
