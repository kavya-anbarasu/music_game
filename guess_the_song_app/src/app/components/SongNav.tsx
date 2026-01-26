'use client';

import { Button } from './ui/Button';

export function SongNav(props: {
  songIndex: number;
  songCount: number;
  locked: boolean;
  onPrev: () => void;
  onNext: () => void;
  doneLabel?: string;
}) {
  const { songIndex, songCount, locked, onPrev, onNext, doneLabel } = props;
  const isLastSong = songIndex >= songCount - 1;

  return (
    <section className="flex items-center gap-3">
      <Button onClick={onPrev} disabled={songIndex === 0} size="sm">
        Prev song
      </Button>

      <Button onClick={onNext} disabled={songIndex >= songCount - 1} size="sm">
        Next song
      </Button>

      {locked && isLastSong && <div className="text-sm font-semibold">{doneLabel ?? '🎉 Done!'}</div>}
    </section>
  );
}
