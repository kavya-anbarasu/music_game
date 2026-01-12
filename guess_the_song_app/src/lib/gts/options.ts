import type { OptionPools, SongMeta } from './types';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function buildOptionPools(songs: SongMeta[]): OptionPools {
  const titles = Array.from(new Set(songs.map((s) => s.title).filter(isNonEmptyString)));
  const albums = Array.from(new Set(songs.map((s) => s.album).filter(isNonEmptyString)));
  const keys = Array.from(new Set(songs.map((s) => s.key).filter(isNonEmptyString)));
  const singers = Array.from(
    new Set(
      songs
        .flatMap((s) => s.singers ?? [])
        .map((x) => x?.trim())
        .filter(isNonEmptyString)
    )
  );

  titles.sort((a, b) => a.localeCompare(b));
  albums.sort((a, b) => a.localeCompare(b));
  keys.sort((a, b) => a.localeCompare(b));
  singers.sort((a, b) => a.localeCompare(b));

  return { titles, albums, keys, singers };
}
