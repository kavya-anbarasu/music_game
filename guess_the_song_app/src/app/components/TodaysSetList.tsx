'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { HintKey, Language, SongProgress } from '@/lib/gts/types';
import type { TodaysSongRow } from '@/lib/useTodaysSongs';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

export function TodaysSetList(props: {
  songs: TodaysSongRow[];
  songIndex: number;
  progressMap: Record<string, SongProgress>;
  lang: Language;
  playDate: string;
  isToday: boolean;
}) {
  const { songs, songIndex, progressMap, lang, playDate, isToday } = props;
  const [showShare, setShowShare] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const shareTimeoutRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);

  const shareText = useMemo(() => {
    if (songs.length === 0) return '';
    const lines: string[] = [];
    lines.push(`Guess the Song — ${lang} — ${playDate}`);

    const bonusLabels: Record<HintKey, string> = {
      album: 'album',
      movie: 'movie',
      music_director: 'music director',
      singers: lang === 'english' ? 'artist' : 'singers',
      hero: 'hero',
      heroine: 'heroine',
      key: 'key',
    };

    songs.forEach((row, idx) => {
      const p = progressMap[row.song_id];
      if (!p) {
        lines.push(`${idx + 1}. ⬜ not played`);
        return;
      }

      const seconds = p.finalSeconds ?? p.revealedSeconds;
      const guesses = p.guesses;
      const guessLabel = `${guesses} ${guesses === 1 ? 'guess' : 'guesses'}`;
      const correctBonus = Object.entries(p.bonus ?? {})
        .filter(([, v]) => v?.correct)
        .map(([k]) => bonusLabels[k as HintKey]);
      const bonusLabel =
        correctBonus.length > 0 ? ` — bonus +${correctBonus.length * 10} (${correctBonus.join(', ')})` : '';

      if (p.status === 'solved') {
        lines.push(`${idx + 1}. 🟩 ${seconds} seconds, ${guessLabel}${bonusLabel}`);
      } else if (p.status === 'gave_up') {
        lines.push(`${idx + 1}. 🟨 gave up — ${seconds} seconds, ${guessLabel}${bonusLabel}`);
      } else {
        lines.push(`${idx + 1}. ⬜ in progress — ${seconds} seconds, ${guessLabel}${bonusLabel}`);
      }
    });

    return lines.join('\n');
  }, [songs, progressMap, lang, playDate]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!showShare) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showShare]);

  async function handleShare() {
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
      setShareStatus('copied');
    } catch {
      setShareStatus('error');
    } finally {
      if (shareTimeoutRef.current) {
        window.clearTimeout(shareTimeoutRef.current);
      }
      shareTimeoutRef.current = window.setTimeout(() => setShareStatus('idle'), 2000);
    }
  }

  const shareModal =
    showShare && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-6">
            <Card className="w-full max-w-2xl space-y-4 bg-[#0d0d12] text-white shadow-[0_24px_70px_rgba(0,0,0,0.7)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold">Share today</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setShowShare(false)}>
                  Close
                </Button>
              </div>
              <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-white/5 p-3 text-xs opacity-80">
                {shareText || 'No results yet.'}
              </pre>
              <div className="flex items-center gap-3">
                <Button onClick={handleShare} variant="secondary">
                  Copy text
                </Button>
                {shareStatus === 'copied' && <div className="text-xs opacity-70">Copied.</div>}
                {shareStatus === 'error' && <div className="text-xs opacity-70">Could not copy.</div>}
              </div>
            </Card>
          </div>,
          document.body
        )
      : null;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-sm font-semibold">Today</div>
          <div className="text-xs opacity-70">Progress across today’s songs.</div>
        </div>
        <Button onClick={() => setShowShare(true)} size="sm" variant="secondary">
          Share
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {songs.map((s, i) => {
          const p = progressMap[s.song_id];
          const status = p?.status ?? 'in_progress';
          const isCurrent = i === songIndex;
          const finalSeconds = p?.finalSeconds ?? p?.revealedSeconds;
          const secondsLabel = finalSeconds ? ` at ${finalSeconds} seconds` : '';

          const base = 'w-7 h-7 rounded border';
          const current = isCurrent ? ' ring-2 ring-white/70' : '';
          const color =
            status === 'solved'
              ? ' bg-green-600/80 border-green-400'
              : status === 'gave_up'
              ? ' bg-yellow-600/80 border-yellow-400'
              : ' bg-transparent border-white/30';

          return (
            <div
              key={s.song_id}
              className={base + color + current}
              aria-label={`Song ${i + 1}: ${status.replace('_', ' ')}${secondsLabel}`}
              title={`Song ${i + 1}: ${status.replace('_', ' ')}${secondsLabel}`}
            />
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs opacity-70">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded border border-white/30" /> Unplayed
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded bg-green-600/80 border border-green-400" /> Solved
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded bg-yellow-600/80 border border-yellow-400" /> Gave up
        </div>
      </div>
      {shareModal}
    </Card>
  );
}
