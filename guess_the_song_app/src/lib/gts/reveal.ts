import { CLIP_SECONDS, type ClipSeconds } from './constants';

export function secondsFromRevealIndex(revealIndex: number): ClipSeconds {
  return CLIP_SECONDS[Math.min(revealIndex, CLIP_SECONDS.length - 1)];
}

export function revealIndexFromSeconds(seconds: number): number {
  const idx = CLIP_SECONDS.findIndex((s) => s === seconds);
  return idx >= 0 ? idx : 0;
}

