import type { ClipSeconds } from './constants';

export type Language = 'english' | 'tamil';

export type SongMeta = {
  id: string;
  title: string;
  album?: string;
  singers?: string[];
  key?: string;
};

export type HintKey = 'album' | 'singers' | 'key';

export type BonusResult = {
  answer: string;
  correct: boolean;
  passed?: boolean;
};

export type SongProgress = {
  status: 'in_progress' | 'solved' | 'gave_up';
  guesses: number;
  revealedSeconds: ClipSeconds;
  finalSeconds?: ClipSeconds;
  revealedHints: Record<HintKey, boolean>;
  bonus: Partial<Record<HintKey, BonusResult>>;
};

export type OptionPools = {
  titles: string[];
  albums: string[];
  keys: string[];
  singers: string[];
};
