'use client';

import type { SongProgress } from '@/lib/gts/types';
import type { TodaysSongRow } from '@/lib/useTodaysSongs';
import { Card } from './ui/Card';

export function TodaysSetList(props: {
  songs: TodaysSongRow[];
  songIndex: number;
  progressMap: Record<string, SongProgress>;
}) {
  const { songs, songIndex, progressMap } = props;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-sm font-semibold">Today</div>
          <div className="text-xs opacity-70">Progress across today’s songs.</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {songs.map((s, i) => {
          const p = progressMap[s.song_id];
          const status = p?.status ?? 'in_progress';
          const isCurrent = i === songIndex;
          const finalSeconds = p?.finalSeconds ?? p?.revealedSeconds;
          const secondsLabel = finalSeconds ? ` at ${finalSeconds}s` : '';

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
    </Card>
  );
}
