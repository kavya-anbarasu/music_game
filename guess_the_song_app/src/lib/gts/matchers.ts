import { normalize } from './text';

export function matchTextExact(user: string, actual?: string | null) {
  return normalize(user) === normalize(actual ?? '');
}

export function matchAlbum(user: string, actual?: string) {
  return matchTextExact(user, actual ?? '');
}

export function matchKey(user: string, actual?: string) {
  return matchTextExact(user, actual ?? '');
}

export function matchSingerPick(user: string, actual?: string[]) {
  const u = normalize(user);
  const singers = (actual ?? []).map((x) => normalize(x)).filter(Boolean);
  if (!u || singers.length === 0) return false;
  return singers.includes(u);
}
