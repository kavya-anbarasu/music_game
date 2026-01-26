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

export type FreePlayState = { queue: string[]; index: number };

function freePlayStorageKey(lang: Language, playDate: string) {
  return `gts_free_play_${lang}_${playDate}_${tabSessionId()}`;
}

export function loadFreePlayState(lang: Language, playDate: string): FreePlayState | null {
  try {
    const raw = localStorage.getItem(freePlayStorageKey(lang, playDate));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FreePlayState;
    if (!Array.isArray(parsed.queue) || typeof parsed.index !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveFreePlayState(lang: Language, playDate: string, state: FreePlayState) {
  localStorage.setItem(freePlayStorageKey(lang, playDate), JSON.stringify(state));
}

export function clearFreePlayState(lang: Language, playDate: string) {
  localStorage.removeItem(freePlayStorageKey(lang, playDate));
}

function leaderboardAckKey(lang: Language, playDate: string) {
  return `gts_leaderboard_ack_${lang}_${playDate}`;
}

export function loadLeaderboardAck(lang: Language, playDate: string) {
  try {
    return sessionStorage.getItem(leaderboardAckKey(lang, playDate)) === '1';
  } catch {
    return false;
  }
}

export function saveLeaderboardAck(lang: Language, playDate: string, value: boolean) {
  try {
    if (value) {
      sessionStorage.setItem(leaderboardAckKey(lang, playDate), '1');
    } else {
      sessionStorage.removeItem(leaderboardAckKey(lang, playDate));
    }
  } catch {
    // ignore
  }
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
