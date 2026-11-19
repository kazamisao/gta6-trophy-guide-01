// Progress store for Leonida Ledger: the checklist lives in localStorage only,
// and can be exported to a file and imported back. No network, no cookie.
export const STORE_KEY = 'leonida-ledger-v1';
export const EXPORT_KEY = 'leonida-ledger-progress';

// Read the earned set from localStorage. A corrupt or foreign value yields an
// empty set instead of throwing, so the guide never fails to open.
export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((name) => typeof name === 'string'));
  } catch {
    return new Set();
  }
}

// Persist the earned set. Returns true when the write landed.
export function saveProgress(earned) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify([...earned]));
    return true;
  } catch {
    return false;
  }
}

// Download the progress as a JSON file the reader can keep or move.
export function exportProgress(earned) {
  const blob = new Blob([JSON.stringify({ app: EXPORT_KEY, earned: [...earned] }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'leonida-ledger-progress.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Parse an imported progress file into an earned set, or null when the file
// is not a progress file at all. Accepts our export shape and a bare array.
export function parseProgressFile(text) {
  try {
    const parsed = JSON.parse(text);
    const list = Array.isArray(parsed) ? parsed : parsed.earned;
    if (!Array.isArray(list)) return null;
    return new Set(list.filter((name) => typeof name === 'string'));
  } catch {
    return null;
  }
}
