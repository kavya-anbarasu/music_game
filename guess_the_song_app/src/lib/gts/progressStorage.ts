import type { Language, SongProgress } from './types';

export function todayPacific() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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
  return `gts_progress_${lang}_${todayPacific()}_${tabSessionId()}`;
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
