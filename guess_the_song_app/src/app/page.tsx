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

type HintKey = 'album' | 'singers' | 'key';

type SongProgress = {
  status: 'in_progress' | 'solved' | 'gave_up';
  guesses: number;
  revealedSeconds: number; // max seconds revealed
  revealedHints: Record<HintKey, boolean>;
  bonus: Partial<Record<HintKey, { answer: string; correct: boolean }>>;
};

function normalize(s: string) {
  return (s ?? '').trim().toLowerCase();
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function storageKey(lang: string) {
  return `gts_progress_${lang}_${todayUTC()}`;
}

function loadProgress(lang: string): Record<string, SongProgress> {
  try {
    const raw = localStorage.getItem(storageKey(lang));
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveProgress(lang: string, obj: Record<string, SongProgress>) {
  localStorage.setItem(storageKey(lang), JSON.stringify(obj));
}

function defaultProgress(): SongProgress {
  return {
    status: 'in_progress',
    guesses: 0,
    revealedSeconds: 1,
    revealedHints: { album: false, singers: false, key: false },
    bonus: {},
  };
}

function secondsFromRevealIndex(revealIndex: number): number {
  return CLIP_SECONDS[Math.min(revealIndex, CLIP_SECONDS.length - 1)];
}

function revealIndexFromSeconds(sec: number): number {
  const idx = CLIP_SECONDS.findIndex((s) => s === sec);
  return idx >= 0 ? idx : 0;
}

function matchAlbum(user: string, actual?: string) {
  return normalize(user) === normalize(actual ?? '');
}

function matchKey(user: string, actual?: string) {
  return normalize(user) === normalize(actual ?? '');
}

// MVP singer matching: accept if user string contains each singer name OR exactly equals joined string
function matchSingers(user: string, actual?: string[]) {
  const u = normalize(user);
  const singers = (actual ?? []).map((x) => normalize(x)).filter(Boolean);
  if (!u || singers.length === 0) return false;
  return singers.every((s) => u.includes(s)) || u === singers.join(', ');
}

export default function Home() {
  const lang: 'english' = 'english';

  const { songs, loading, error } = useTodaysSongs();
  const [songIndex, setSongIndex] = useState(0);
  const [revealIndex, setRevealIndex] = useState(0);

  // Guess UI
  const [guess, setGuess] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Bonus UI
  const [bonusInput, setBonusInput] = useState<Partial<Record<HintKey, string>>>({});

  // Autoplay
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const metaById = useMemo(() => {
    const m = new Map<string, SongMeta>();
    (english_songs as SongMeta[]).forEach((s) => m.set(s.id, s));
    return m;
  }, []);

  const allTitles = useMemo(() => {
    return (english_songs as SongMeta[])
      .filter((s) => s.title && s.id)
      .map((s) => ({ id: s.id, title: s.title, titleNorm: normalize(s.title) }));
  }, []);

  const currentSongId = songs?.[songIndex]?.song_id;
  const currentMeta = currentSongId ? metaById.get(currentSongId) : undefined;

  // Load progress map once (client)
  const [progressMap, setProgressMap] = useState<Record<string, SongProgress>>({});

  useEffect(() => {
    setProgressMap(loadProgress(lang));
  }, []);

  // Current progress
  const progress: SongProgress = useMemo(() => {
    if (!currentSongId) return defaultProgress();
    return progressMap[currentSongId] ?? defaultProgress();
  }, [progressMap, currentSongId]);

  // Sync revealIndex to persisted revealedSeconds when changing songs
  useEffect(() => {
    if (!currentSongId) return;
    setRevealIndex(revealIndexFromSeconds(progress.revealedSeconds));
    setGuess('');
    setSubmitted(null);
    setIsCorrect(null);
    setShowSuggestions(false);
    setBonusInput({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSongId]);

  function updateProgress(songId: string, updater: (p: SongProgress) => SongProgress) {
    setProgressMap((prev) => {
      const next = { ...prev };
      const cur = next[songId] ?? defaultProgress();
      next[songId] = updater(cur);
      saveProgress(lang, next);
      return next;
    });
  }

  function goToSong(nextIndex: number) {
    setSongIndex(nextIndex);
  }

  const seconds: ClipSeconds = CLIP_SECONDS[Math.min(revealIndex, CLIP_SECONDS.length - 1)];

  const audioUrl = useMemo(() => {
    if (!currentSongId) return null;
    return audioPublicUrl(clipObjectPath(lang, currentSongId, seconds));
  }, [currentSongId, seconds]);

  // Autoplay on URL changes
  useEffect(() => {
    if (!audioUrl) return;
    const el = audioRef.current;
    if (!el) return;
    el.load();
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, [audioUrl]);

  const suggestions = useMemo(() => {
    const q = normalize(guess);
    if (!q || q.length < 2) return [];
    return allTitles.filter((s) => s.titleNorm.includes(q)).slice(0, 8);
  }, [guess, allTitles]);

  function handlePickSuggestion(title: string) {
    setGuess(title);
    setShowSuggestions(false);
  }

  function handleRevealMore() {
    if (!currentSongId) return;
    const nextRevealIndex = Math.min(CLIP_SECONDS.length - 1, revealIndex + 1);
    const nextSeconds = secondsFromRevealIndex(nextRevealIndex);

    setRevealIndex(nextRevealIndex);

    // Persist max reveal seconds
    updateProgress(currentSongId, (p) => ({
      ...p,
      revealedSeconds: Math.max(p.revealedSeconds, nextSeconds),
    }));
  }

  function handleSubmitGuess() {
    if (!currentSongId) return;
    const answer = currentMeta?.title ?? '';
    const ok = normalize(guess) === normalize(answer);

    setSubmitted(guess);
    setIsCorrect(ok);
    setShowSuggestions(false);

    updateProgress(currentSongId, (p) => {
      const nextGuesses = p.guesses + 1;
      return {
        ...p,
        guesses: nextGuesses,
        status: ok ? 'solved' : p.status,
      };
    });
  }

  function handleGiveUp() {
    if (!currentSongId) return;
    setSubmitted('(gave up)');
    setIsCorrect(false);
    setShowSuggestions(false);

    updateProgress(currentSongId, (p) => ({
      ...p,
      status: 'gave_up',
    }));
  }

  function flipHint(h: HintKey) {
    if (!currentSongId) return;
    updateProgress(currentSongId, (p) => ({
      ...p,
      revealedHints: { ...p.revealedHints, [h]: true },
    }));
  }

  function submitBonus(h: HintKey) {
    if (!currentSongId) return;
    const user = bonusInput[h] ?? '';

    let correct = false;
    if (h === 'album') correct = matchAlbum(user, currentMeta?.album);
    if (h === 'key') correct = matchKey(user, currentMeta?.key);
    if (h === 'singers') correct = matchSingers(user, currentMeta?.singers);

    updateProgress(currentSongId, (p) => ({
      ...p,
      bonus: { ...p.bonus, [h]: { answer: user, correct } },
    }));
  }

  if (loading) return <main className="p-8">Loading…</main>;
  if (error) return <main className="p-8">Error: {error}</main>;
  if (!songs || songs.length === 0) return <main className="p-8">No songs for today.</main>;

  const isLastReveal = revealIndex >= CLIP_SECONDS.length - 1;
  const isLastSong = songIndex >= songs.length - 1;

  const locked = progress.status === 'solved' || progress.status === 'gave_up';
  const nextEnabled = locked && !isLastSong;

  const answerTitle = currentMeta?.title ?? '(unknown title in metadata)';

  // Bonus questions only for hints NOT revealed
  const bonusKeys: HintKey[] = (['album', 'singers', 'key'] as HintKey[]).filter(
    (k) => !progress.revealedHints[k]
  );

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

      {/* Status banner when revisiting */}
      {progress.status === 'solved' && (
        <div className="rounded border p-3">
          ✅ Solved in <b>{progress.guesses}</b> {progress.guesses === 1 ? 'guess' : 'guesses'}.
        </div>
      )}
      {progress.status === 'gave_up' && (
        <div className="rounded border p-3">
          🟨 You gave up. Answer was: <b>{answerTitle}</b>
        </div>
      )}

      {/* Audio */}
      <section className="space-y-2">
        {audioUrl ? (
          <audio ref={audioRef} key={`${currentSongId}-${seconds}`} controls src={audioUrl} />
        ) : (
          <div>No audio URL</div>
        )}
        <div className="text-xs break-all opacity-60">{audioUrl}</div>
      </section>

      {/* Guess */}
      <section className="space-y-2 max-w-xl">
        <div className="font-semibold">Your guess</div>

        <div className="relative">
          <input
            className="w-full px-3 py-2 rounded border bg-transparent"
            placeholder="Type the song title…"
            value={guess}
            disabled={locked}
            onChange={(e) => {
              setGuess(e.target.value);
              setShowSuggestions(true);
              setSubmitted(null);
              setIsCorrect(null);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
          />

          {!locked && showSuggestions && suggestions.length > 0 && (
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
            disabled={locked || normalize(guess).length === 0}
          >
            Submit
          </button>

          {!locked && (
            <button className="px-4 py-2 rounded border" onClick={handleGiveUp}>
              Give up
            </button>
          )}

          {submitted !== null && isCorrect === true && <div className="text-sm font-semibold">✅ Correct!</div>}
          {submitted !== null && isCorrect === false && !locked && (
            <div className="text-sm">❌ Not quite — try again.</div>
          )}
        </div>

        {/* Reveal answer after solve / give up */}
        {locked && (
          <div className="text-sm">
            Answer: <b>{answerTitle}</b>
          </div>
        )}

        {/* Next song CTA */}
        {nextEnabled && (
          <button className="mt-2 px-4 py-2 rounded border font-semibold" onClick={() => goToSong(songIndex + 1)}>
            Next song →
          </button>
        )}
        {locked && isLastSong && <div className="mt-2 text-sm font-semibold">🎉 You finished today’s set!</div>}
      </section>

      {/* Reveal controls (only increase) */}
      <section className="flex items-center gap-3">
        <button className="px-4 py-2 rounded border font-medium" onClick={handleRevealMore} disabled={isLastReveal}>
          Reveal more
        </button>
        <button
          className="px-3 py-2 rounded border"
          onClick={() => {
            const idx = CLIP_SECONDS.length - 1;
            setRevealIndex(idx);
            if (currentSongId) {
              updateProgress(currentSongId, (p) => ({ ...p, revealedSeconds: Math.max(p.revealedSeconds, 30) }));
            }
          }}
          disabled={isLastReveal}
        >
          Jump to 30s
        </button>
      </section>

      {/* Hints */}
      <section className="space-y-2 max-w-xl">
        <div className="font-semibold">Hints (flip any order)</div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['album', 'singers', 'key'] as HintKey[]).map((k) => {
            const flipped = progress.revealedHints[k];
            const label = k === 'album' ? 'Album' : k === 'singers' ? 'Singers' : 'Key';
            const value =
              k === 'album'
                ? currentMeta?.album ?? '(none)'
                : k === 'singers'
                ? (currentMeta?.singers ?? []).join(', ') || '(none)'
                : currentMeta?.key ?? '(none)';

            return (
              <button
                key={k}
                className="rounded border p-3 text-left"
                onClick={() => flipHint(k)}
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

      {/* Bonus questions (only after solved/gave up) */}
      {locked && bonusKeys.length > 0 && (
        <section className="space-y-3 max-w-xl">
          <div className="font-semibold">Bonus questions (only for hints you didn’t flip)</div>

          {bonusKeys.map((k) => {
            const label = k === 'album' ? 'Album' : k === 'singers' ? 'Singers' : 'Key';
            const prev = progress.bonus?.[k];

            return (
              <div key={k} className="rounded border p-3 space-y-2">
                <div className="text-sm font-semibold">{label}</div>

                <div className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-2 rounded border bg-transparent"
                    placeholder={`Enter ${label.toLowerCase()}…`}
                    value={bonusInput[k] ?? ''}
                    onChange={(e) => setBonusInput((p) => ({ ...p, [k]: e.target.value }))}
                    disabled={!!prev}
                  />
                  <button className="px-3 py-2 rounded border" onClick={() => submitBonus(k)} disabled={!!prev}>
                    Submit
                  </button>
                </div>

                {prev && (
                  <div className="text-sm">
                    {prev.correct ? '✅ Correct' : '❌ Not quite'} — you answered: <span className="font-mono">{prev.answer}</span>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Today’s set (debug) */}
      <section className="text-sm">
        <div className="font-semibold mb-2">Today’s set</div>
        <ol className="list-decimal ml-5 space-y-1">
          {songs.map((s, i) => {
            const p = progressMap[s.song_id];
            const badge =
              p?.status === 'solved' ? `✅ ${p.guesses}` : p?.status === 'gave_up' ? '🟨' : '';
            return (
              <li key={s.song_id} className={i === songIndex ? 'font-semibold' : ''}>
                <span className="font-mono">{s.song_id}</span> {badge && <span className="ml-2 opacity-70">{badge}</span>}
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
