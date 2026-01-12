import type { Language, SongProgress } from './types';

export function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

export function tabSessionId() {
  const k = 'gts_tab_session';
  let id = sessionStorage.getItem(k);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(k, id);
  }
  return id;
}

export function storageKey(lang: Language) {
  return `gts_progress_${lang}_${todayUTC()}_${tabSessionId()}`;
}

export function loadProgressMap(lang: Language): Record<string, SongProgress> {
  try {
    const raw = localStorage.getItem(storageKey(lang));
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveProgressMap(lang: Language, obj: Record<string, SongProgress>) {
  localStorage.setItem(storageKey(lang), JSON.stringify(obj));
}

