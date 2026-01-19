import type { OptionPools, SongMeta } from './types';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function buildOptionPools(songs: SongMeta[]): OptionPools {
  const titles = Array.from(new Set(songs.map((s) => s.title).filter(isNonEmptyString)));
  const albums = Array.from(new Set(songs.map((s) => s.album).filter(isNonEmptyString)));
  const movies = Array.from(new Set(songs.map((s) => s.movie ?? undefined).filter(isNonEmptyString)));
  const musicDirectors = Array.from(
    new Set(songs.map((s) => s.music_director ?? undefined).filter(isNonEmptyString))
  );
  const heroes = Array.from(new Set(songs.map((s) => s.hero ?? undefined).filter(isNonEmptyString)));
  const heroines = Array.from(new Set(songs.map((s) => s.heroine ?? undefined).filter(isNonEmptyString)));
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
  movies.sort((a, b) => a.localeCompare(b));
  musicDirectors.sort((a, b) => a.localeCompare(b));
  heroes.sort((a, b) => a.localeCompare(b));
  heroines.sort((a, b) => a.localeCompare(b));
  keys.sort((a, b) => a.localeCompare(b));
  singers.sort((a, b) => a.localeCompare(b));

  return { titles, albums, movies, musicDirectors, heroes, heroines, keys, singers };
}
