'use client';

import { useTodaysSongs } from '../lib/useTodaysSongs';
import { audioPublicUrl, clipObjectPath } from '../lib/storage';

export default function Home() {
  const { songs, loading, error } = useTodaysSongs();

  if (loading) return <main className="p-8">Loading…</main>;
  if (error) return <main className="p-8">Error: {error}</main>;
  if (songs.length === 0) return <main className="p-8">No songs for today.</main>;

  const songId = songs[0].song_id;
  const url = audioPublicUrl(clipObjectPath('english', songId, 30));

  return (
    <main className="p-8">
      <h1 className="text-xl font-bold mb-4">Today’s first song (test)</h1>

      <div className="mb-2 text-sm">song_id: <span className="font-mono">{songId}</span></div>

      <audio controls src={url} />

      <div className="mt-4 text-xs break-all opacity-70">{url}</div>
    </main>
  );
}
