'use client';

export function SongNav(props: {
  songIndex: number;
  songCount: number;
  locked: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { songIndex, songCount, locked, onPrev, onNext } = props;
  const isLastSong = songIndex >= songCount - 1;

  return (
    <section className="flex items-center gap-3">
      <button className="px-3 py-2 rounded border" onClick={onPrev} disabled={songIndex === 0}>
        Prev song
      </button>

      <button className="px-3 py-2 rounded border" onClick={onNext} disabled={songIndex >= songCount - 1}>
        Next song
      </button>

      {locked && isLastSong && <div className="text-sm font-semibold">🎉 Done!</div>}
    </section>
  );
}

