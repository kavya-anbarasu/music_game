import type { ClipSeconds } from './constants';
import type { HintKey, SongProgress } from './types';

const BASE_POINTS: Record<ClipSeconds, number> = {
  1: 100,
  3: 90,
  5: 75,
  10: 50,
  20: 35,
  30: 20,
};

const HINT_PENALTY: Record<HintKey, number> = {
  singers: 10,
  album: 5,
  movie: 5,
  music_director: 5,
  hero: 5,
  heroine: 5,
  key: 5,
};

const BONUS_POINTS: Record<HintKey, number> = {
  singers: 10,
  album: 5,
  movie: 5,
  music_director: 5,
  hero: 5,
  heroine: 5,
  key: 5,
};

export type SongScoreBreakdown = {
  status: SongProgress['status'];
  baseSeconds: ClipSeconds;
  basePoints: number;
  hintPenalty: number;
  bonusPoints: number;
  total: number;
};

export function scoreSong(progress: SongProgress): SongScoreBreakdown {
  const baseSeconds = (progress.finalSeconds ?? progress.revealedSeconds) as ClipSeconds;

  if (progress.status !== 'solved') {
    return {
      status: progress.status,
      baseSeconds,
      basePoints: 0,
      hintPenalty: 0,
      bonusPoints: 0,
      total: 0,
    };
  }

  const basePoints = BASE_POINTS[baseSeconds] ?? 0;

  const hintPenalty =
    (progress.revealedHints.album ? HINT_PENALTY.album : 0) +
    (progress.revealedHints.movie ? HINT_PENALTY.movie : 0) +
    (progress.revealedHints.music_director ? HINT_PENALTY.music_director : 0) +
    (progress.revealedHints.hero ? HINT_PENALTY.hero : 0) +
    (progress.revealedHints.heroine ? HINT_PENALTY.heroine : 0) +
    (progress.revealedHints.key ? HINT_PENALTY.key : 0) +
    (progress.revealedHints.singers ? HINT_PENALTY.singers : 0);

  const bonusPoints =
    (progress.bonus.album?.correct ? BONUS_POINTS.album : 0) +
    (progress.bonus.movie?.correct ? BONUS_POINTS.movie : 0) +
    (progress.bonus.music_director?.correct ? BONUS_POINTS.music_director : 0) +
    (progress.bonus.hero?.correct ? BONUS_POINTS.hero : 0) +
    (progress.bonus.heroine?.correct ? BONUS_POINTS.heroine : 0) +
    (progress.bonus.key?.correct ? BONUS_POINTS.key : 0) +
    (progress.bonus.singers?.correct ? BONUS_POINTS.singers : 0);

  return {
    status: progress.status,
    baseSeconds,
    basePoints,
    hintPenalty,
    bonusPoints,
    total: Math.max(0, basePoints - hintPenalty + bonusPoints),
  };
}
