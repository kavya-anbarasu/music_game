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
      <ol className="list-decimal ml-5 space-y-1">
        {songs.map((s, i) => {
          const p = progressMap[s.song_id];
          const badge = p?.status === 'solved' ? `✅ ${p.guesses}` : p?.status === 'gave_up' ? `🟨 ${p.guesses}` : '';
          return (
            <li key={s.song_id} className={i === songIndex ? 'font-semibold' : ''}>
              <span className="font-mono">{s.song_id}</span>
              {badge && <span className="ml-2 opacity-70">{badge}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

