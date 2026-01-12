import type { SongProgress } from './types';

export function defaultProgress(): SongProgress {
  return {
    status: 'in_progress',
    guesses: 0,
    revealedSeconds: 1,
    revealedHints: { album: false, singers: false, key: false },
    bonus: {},
  };
}

