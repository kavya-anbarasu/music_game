'use client';

import type { HintKey, SongProgress } from '@/lib/gts/types';

export function HintsSection(props: {
  showHints: boolean;
  progress: SongProgress;
  onFlip: (k: HintKey) => void;
  answerAlbum: string;
  answerSingers: string;
  answerKey: string;
}) {
  const { showHints, progress, onFlip, answerAlbum, answerSingers, answerKey } = props;
  if (!showHints) return null;

  return (
    <section className="space-y-2 max-w-xl">
      <div className="font-semibold">Hints (flip any order)</div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(['album', 'singers', 'key'] as HintKey[]).map((k) => {
          const flipped = progress.revealedHints[k];
          const label = k === 'album' ? 'Album' : k === 'singers' ? 'Singers' : 'Key';
          const value = k === 'album' ? answerAlbum : k === 'singers' ? answerSingers : answerKey;

          return (
            <button
              key={k}
              className="rounded border p-3 text-left"
              onClick={() => onFlip(k)}
              disabled={flipped}
              title={flipped ? 'Already revealed' : 'Click to reveal'}
            >
              <div className="text-sm font-semibold">{label}</div>
              <div className="mt-1 text-sm opacity-80">{flipped ? value : 'Click to reveal'}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

