'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useTodaysSongs } from '../lib/useTodaysSongs';
import { audioPublicUrl, clipObjectPath } from '../lib/storage';
import english_songs from '../data/english_songs.json';

const CLIP_SECONDS = [1, 3, 5, 10, 20, 30] as const;
type ClipSeconds = (typeof CLIP_SECONDS)[number];

type SongMeta = {
  id: string;
  title: string;
  album?: string;
  singers?: string[];
  key?: string;
};

function normalize(s: string) {
  return s.trim().toLowerCase();
}

export default function Home() {
  const { songs, loading, error } = useTodaysSongs();

  const [songIndex, setSongIndex] = useState(0);
  const [revealIndex, setRevealIndex] = useState(0);

  // Guess UI
  const [guess, setGuess] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // For autoplay
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const metaById = useMemo(() => {
    const m = new Map<string, SongMeta>();
    (english_songs as SongMeta[]).forEach((s) => m.set(s.id, s));
    return m;
  }, []);

  const allTitles = useMemo(() => {
    return (english_songs as SongMeta[])
      .filter((s) => s.title && s.id)
      .map((s) => ({
        id: s.id,
        title: s.title,
        titleNorm: normalize(s.title),
      }));
  }, []);

  const currentSongId = songs?.[songIndex]?.song_id;
  const currentMeta = currentSongId ? metaById.get(currentSongId) : undefined;

  function resetForSong() {
    setRevealIndex(0);
    setGuess('');
    setSubmitted(null);
    setIsCorrect(null);
    setShowSuggestions(false);
  }

  function goToSong(nextIndex: number) {
    setSongIndex(nextIndex);
    resetForSong();
  }

  // Clamp if needed
  useEffect(() => {
    if (!songs || songs.length === 0) return;
    if (songIndex > songs.length - 1) setSongIndex(0);
  }, [songs, songIndex]);

  const seconds: ClipSeconds = CLIP_SECONDS[Math.min(revealIndex, CLIP_SECONDS.length - 1)];

  const audioUrl = useMemo(() => {
    if (!currentSongId) return null;
    return audioPublicUrl(clipObjectPath('english', currentSongId, seconds));
  }, [currentSongId, seconds]);

  // Suggestions dropdown
  const suggestions = useMemo(() => {
    const q = normalize(guess);
    if (!q || q.length < 2) return [];
    return allTitles.filter((s) => s.titleNorm.includes(q)).slice(0, 8);
  }, [guess, allTitles]);

  function handlePickSuggestion(title: string) {
    setGuess(title);
    setShowSuggestions(false);
  }

  function handleSubmitGuess() {
    const answer = currentMeta?.title ?? '';
    const ok = normalize(guess) === normalize(answer);
    setSubmitted(guess);
    setIsCorrect(ok);
    setShowSuggestions(false);
  }

  // ✅ Autoplay whenever the clip URL changes (reveal more OR song change)
  useEffect(() => {
    if (!audioUrl) return;
    const el = audioRef.current;
    if (!el) return;

    // attempt autoplay; browsers may block unless user interacted
    el.load();
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, [audioUrl]);

  if (loading) return <main className="p-8">Loading…</main>;
  if (error) return <main className="p-8">Error: {error}</main>;
  if (!songs || songs.length === 0) return <main className="p-8">No songs for today.</main>;

  const isLastReveal = revealIndex >= CLIP_SECONDS.length - 1;
  const canSubmit = normalize(guess).length > 0;
  const isLastSong = songIndex >= songs.length - 1;

  const nextSongEnabled = isCorrect === true && !isLastSong;

  return (
    <main className="p-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Daily Guess-the-Song (MVP)</h1>
        <div className="text-sm opacity-80">
          Song {songIndex + 1} / {songs.length} • Revealed: {seconds}s
        </div>
        <div className="text-xs opacity-60">
          song_id: <span className="font-mono">{currentSongId}</span>
        </div>
      </header>

      {/* Audio */}
      <section className="space-y-2">
        {audioUrl ? (
          <audio ref={audioRef} key={`${currentSongId}-${seconds}`} controls src={audioUrl} />
        ) : (
          <div>No audio URL</div>
        )}
        <div className="text-xs break-all opacity-60">{audioUrl}</div>
      </section>

      {/* Guess box */}
      <section className="space-y-2 max-w-xl">
        <div className="font-semibold">Your guess</div>

        <div className="relative">
          <input
            className="w-full px-3 py-2 rounded border bg-transparent"
            placeholder="Type the song title…"
            value={guess}
            onChange={(e) => {
              setGuess(e.target.value);
              setShowSuggestions(true);
              setSubmitted(null);
              setIsCorrect(null);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
            disabled={isCorrect === true} // lock after correct
          />

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded border bg-black/90 backdrop-blur">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="block w-full text-left px-3 py-2 hover:bg-white/10"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePickSuggestion(s.title)}
                >
                  {s.title}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 rounded border font-medium"
            onClick={handleSubmitGuess}
            disabled={!canSubmit || isCorrect === true}
          >
            Submit
          </button>

          {submitted !== null && isCorrect === true && (
            <div className="text-sm font-semibold">✅ Correct!</div>
          )}
          {submitted !== null && isCorrect === false && (
            <div className="text-sm">❌ Not quite — try again.</div>
          )}
        </div>

        {/* Debug (remove later) */}
        <div className="text-xs opacity-60">
          (debug) answer: <span className="font-mono">{currentMeta?.title ?? 'unknown in metadata'}</span>
        </div>

        {/* ✅ Next song CTA appears only when correct */}
        {nextSongEnabled && (
          <button
            className="mt-2 px-4 py-2 rounded border font-semibold"
            onClick={() => goToSong(songIndex + 1)}
          >
            Next song →
          </button>
        )}

        {isCorrect === true && isLastSong && (
          <div className="mt-2 text-sm font-semibold">🎉 You finished today’s set!</div>
        )}
      </section>

      {/* Reveal controls (no “Less”) */}
      <section className="flex items-center gap-3">
        <button
          className="px-4 py-2 rounded border font-medium"
          onClick={() => setRevealIndex((i) => Math.min(CLIP_SECONDS.length - 1, i + 1))}
          disabled={isLastReveal}
        >
          Reveal more
        </button>

        <button
          className="px-3 py-2 rounded border"
          onClick={() => setRevealIndex(CLIP_SECONDS.length - 1)}
          disabled={isLastReveal}
        >
          Jump to 30s
        </button>
      </section>

      {/* Song navigation */}
      <section className="flex items-center gap-3">
        <button
          className="px-3 py-2 rounded border"
          onClick={() => goToSong(Math.max(0, songIndex - 1))}
          disabled={songIndex === 0}
        >
          Prev song
        </button>

        <button
          className="px-3 py-2 rounded border"
          onClick={() => goToSong(Math.min(songs.length - 1, songIndex + 1))}
          disabled={songIndex >= songs.length - 1}
        >
          Next song
        </button>

        <button
          className="px-3 py-2 rounded border"
          onClick={() => goToSong(Math.min(songs.length - 1, songIndex + 1))}
        >
          Skip
        </button>
      </section>

      {/* Debug list */}
      <section className="text-sm">
        <div className="font-semibold mb-2">Today’s set</div>
        <ol className="list-decimal ml-5 space-y-1">
          {songs.map((s, i) => (
            <li key={s.song_id} className={i === songIndex ? 'font-semibold' : ''}>
              <span className="font-mono">{s.song_id}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
