'use client';

import type { SongProgress } from '@/lib/gts/types';
import type { TodaysSongRow } from '@/lib/useTodaysSongs';

export function TodaysSetList(props: {
  songs: TodaysSongRow[];
  songIndex: number;
  progressMap: Record<string, SongProgress>;
}) {
  const { songs, songIndex, progressMap } = props;

  return (
    <section className="text-sm">
      <div className="font-semibold mb-2">Today’s set</div>
      <div className="flex flex-wrap gap-2">
        {songs.map((s, i) => {
          const p = progressMap[s.song_id];
          const status = p?.status ?? 'in_progress';
          const isCurrent = i === songIndex;

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
              aria-label={`Song ${i + 1}: ${status.replace('_', ' ')}`}
              title={`Song ${i + 1}: ${status.replace('_', ' ')}`}
            />
          );
        })}
      </div>
    </section>
  );
}
