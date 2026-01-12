'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

type BonusResult = {
  answer: string;
  correct: boolean;
  passed?: boolean;
};

type SongProgress = {
  status: 'in_progress' | 'solved' | 'gave_up';
  guesses: number;
  revealedSeconds: number;
  revealedHints: Record<HintKey, boolean>;
  bonus: Partial<Record<HintKey, BonusResult>>;
};

function normalize(s: string) {
  return (s ?? '').trim().toLowerCase();
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

/** Per-tab session id so new tabs can play fresh */
function tabSessionId() {
  const k = 'gts_tab_session';
  let id = sessionStorage.getItem(k);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(k, id);
  }
  return id;
}

function storageKey(lang: string) {
  return `gts_progress_${lang}_${todayUTC()}_${tabSessionId()}`;
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

/** Bonus singer question: pick ONE singer; correct if it’s in the song’s singers list. */
function matchSingerPick(user: string, actual?: string[]) {
  const u = normalize(user);
  const singers = (actual ?? []).map((x) => normalize(x)).filter(Boolean);
  if (!u || singers.length === 0) return false;
  return singers.includes(u);
}

/** Reusable autocomplete input */
function AutocompleteInput(props: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const { value, onChange, options, placeholder, disabled } = props;
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = normalize(value);
    if (!q || q.length < 2) return [];
    return options
      .filter((opt) => normalize(opt).includes(q))
      .slice(0, 8);
  }, [value, options]);

  return (
    <div className="relative">
      <input
        className="w-full px-3 py-2 rounded border bg-transparent"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      />

      {!disabled && open && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded border bg-black/90 backdrop-blur">
          {suggestions.map((sug) => (
            <button
              key={sug}
              type="button"
              className="block w-full text-left px-3 py-2 hover:bg-white/10"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(sug);
                setOpen(false);
              }}
            >
              {sug}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const lang: 'english' = 'english';

  const { songs, loading, error } = useTodaysSongs();
  const [songIndex, setSongIndex] = useState(0);

  // revealIndex tracks UI reveal for current song (synced from progress)
  const [revealIndex, setRevealIndex] = useState(0);

  // Guess UI
  const [guess, setGuess] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // Bonus UI
  const [bonusInput, setBonusInput] = useState<Partial<Record<HintKey, string>>>({});

  // Audio
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const metaById = useMemo(() => {
    const m = new Map<string, SongMeta>();
    (english_songs as SongMeta[]).forEach((s) => m.set(s.id, s));
    return m;
  }, []);

  // Dropdown pools
  const optionPools = useMemo(() => {
    const songsArr = english_songs as SongMeta[];

    const titles = Array.from(new Set(songsArr.map((s) => s.title).filter(Boolean)));
    const albums = Array.from(new Set(songsArr.map((s) => s.album).filter(Boolean)));
    const keys = Array.from(new Set(songsArr.map((s) => s.key).filter(Boolean)));
    const singers = Array.from(
      new Set(
        songsArr
          .flatMap((s) => s.singers ?? [])
          .map((x) => x?.trim())
          .filter(Boolean)
      )
    );

    titles.sort((a, b) => a.localeCompare(b));
    albums.sort((a, b) => a.localeCompare(b));
    keys.sort((a, b) => a.localeCompare(b));
    singers.sort((a, b) => a.localeCompare(b));

    return { titles, albums, keys, singers };
  }, []);

  const currentSongId = songs?.[songIndex]?.song_id;
  const currentMeta = currentSongId ? metaById.get(currentSongId) : undefined;

  const [progressMap, setProgressMap] = useState<Record<string, SongProgress>>({});

  // load per-tab session progress on mount
  useEffect(() => {
    setProgressMap(loadProgress(lang));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress: SongProgress = useMemo(() => {
    if (!currentSongId) return defaultProgress();
    return progressMap[currentSongId] ?? defaultProgress();
  }, [progressMap, currentSongId]);

  const locked = progress.status === 'solved' || progress.status === 'gave_up';
  const showBonus = locked;
  const showHints = !showBonus;

  // Sync UI state when song changes
  useEffect(() => {
    if (!currentSongId) return;

    setRevealIndex(revealIndexFromSeconds(progress.revealedSeconds));
    setGuess('');
    setSubmitted(null);
    setIsCorrect(null);
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

  const seconds: ClipSeconds = CLIP_SECONDS[Math.min(revealIndex, CLIP_SECONDS.length - 1)];
  const isLastReveal = revealIndex >= CLIP_SECONDS.length - 1;

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

  function handleRevealMore() {
    if (!currentSongId) return;

    const nextRevealIndex = Math.min(CLIP_SECONDS.length - 1, revealIndex + 1);
    const nextSeconds = secondsFromRevealIndex(nextRevealIndex);

    setRevealIndex(nextRevealIndex);
    updateProgress(currentSongId, (p) => ({
      ...p,
      revealedSeconds: Math.max(p.revealedSeconds, nextSeconds),
    }));
  }

  function handleJump30() {
    if (!currentSongId) return;
    const idx = CLIP_SECONDS.length - 1;
    setRevealIndex(idx);
    updateProgress(currentSongId, (p) => ({
      ...p,
      revealedSeconds: Math.max(p.revealedSeconds, 30),
    }));
  }

  function handleGiveUp() {
    if (!currentSongId) return;
    setSubmitted('(gave up)');
    setIsCorrect(false);
    updateProgress(currentSongId, (p) => ({ ...p, status: 'gave_up' }));
  }

  // ✅ Wrong guess => reveal more automatically; wrong at 30s => auto-lose
  function handleSubmitGuess() {
    if (!currentSongId) return;

    const answer = currentMeta?.title ?? '';
    const ok = normalize(guess) === normalize(answer);

    setSubmitted(guess);
    setIsCorrect(ok);

    updateProgress(currentSongId, (p) => {
      const nextGuesses = p.guesses + 1;

      if (ok) {
        return { ...p, guesses: nextGuesses, status: 'solved' };
      }

      const curIdx = revealIndexFromSeconds(p.revealedSeconds);
      const isMax = curIdx >= CLIP_SECONDS.length - 1;

      if (!isMax) {
        const nextIdx = Math.min(CLIP_SECONDS.length - 1, curIdx + 1);
        const nextSeconds = secondsFromRevealIndex(nextIdx);
        return {
          ...p,
          guesses: nextGuesses,
          revealedSeconds: Math.max(p.revealedSeconds, nextSeconds),
        };
      }

      // already at max => auto-lose
      return { ...p, guesses: nextGuesses, status: 'gave_up' };
    });

    // Keep UI reveal in sync immediately
    if (!ok) {
      if (!isLastReveal) setRevealIndex((i) => Math.min(CLIP_SECONDS.length - 1, i + 1));
      // if already last reveal, progress will mark gave_up
    }
  }

  function flipHint(h: HintKey) {
    if (!currentSongId) return;
    if (progress.status !== 'in_progress') return;

    updateProgress(currentSongId, (p) => ({
      ...p,
      revealedHints: { ...p.revealedHints, [h]: true },
    }));
  }

  function submitBonus(h: HintKey) {
    if (!currentSongId) return;
    const user = (bonusInput[h] ?? '').trim();

    let correct = false;
    if (h === 'album') correct = matchAlbum(user, currentMeta?.album);
    if (h === 'key') correct = matchKey(user, currentMeta?.key);
    if (h === 'singers') correct = matchSingerPick(user, currentMeta?.singers);

    updateProgress(currentSongId, (p) => ({
      ...p,
      bonus: { ...p.bonus, [h]: { answer: user, correct, passed: false } },
    }));
  }

  function passBonus(h: HintKey) {
    if (!currentSongId) return;
    updateProgress(currentSongId, (p) => ({
      ...p,
      bonus: { ...p.bonus, [h]: { answer: '', correct: false, passed: true } },
    }));
  }

  if (loading) return <main className="p-8">Loading…</main>;
  if (error) return <main className="p-8">Error: {error}</main>;
  if (!songs || songs.length === 0) return <main className="p-8">No songs for today.</main>;

  const answerTitle = currentMeta?.title ?? '(unknown title in metadata)';
  const answerAlbum = currentMeta?.album ?? '(none)';
  const answerKey = currentMeta?.key ?? '(none)';
  const answerSingers = (currentMeta?.singers ?? []).join(', ') || '(none)';

  const bonusKeys: HintKey[] = (['album', 'singers', 'key'] as HintKey[]).filter(
    (k) => !progress.revealedHints[k]
  );

  const isLastSong = songIndex >= songs.length - 1;

  return (
    <main className="p-8 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Daily Guess-the-Song (MVP)</h1>
            <div className="text-sm opacity-80">
              Song {songIndex + 1} / {songs.length} • Revealed: {seconds}s
            </div>
            <div className="text-xs opacity-60">
              song_id: <span className="font-mono">{currentSongId}</span>
            </div>
          </div>
        </div>

        {progress.status === 'solved' && (
          <div className="rounded border p-3">
            ✅ Solved in <b>{progress.guesses}</b> {progress.guesses === 1 ? 'guess' : 'guesses'}.
          </div>
        )}
        {progress.status === 'gave_up' && (
          <div className="rounded border p-3">
            🟨 You lost / gave up. Answer was: <b>{answerTitle}</b>
          </div>
        )}
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

      {/* Guess */}
      <section className="space-y-2 max-w-xl">
        <div className="font-semibold">Your guess</div>

        {!locked ? (
          <>
            <AutocompleteInput
              value={guess}
              onChange={(v) => {
                setGuess(v);
                setSubmitted(null);
                setIsCorrect(null);
              }}
              options={optionPools.titles}
              placeholder="Type the song title…"
            />

            <div className="flex items-center gap-3">
              <button
                className="px-4 py-2 rounded border font-medium"
                onClick={handleSubmitGuess}
                disabled={normalize(guess).length === 0}
              >
                Submit
              </button>

              <button className="px-4 py-2 rounded border" onClick={handleGiveUp}>
                Give up
              </button>

              {submitted !== null && isCorrect === true && (
                <div className="text-sm font-semibold">✅ Correct!</div>
              )}
              {submitted !== null && isCorrect === false && (
                <div className="text-sm">❌ Not quite — revealing more…</div>
              )}
            </div>
          </>
        ) : (
          <div className="text-sm space-y-1">
            <div>
              Answer: <b>{answerTitle}</b>
            </div>
          </div>
        )}
      </section>

      {/* Reveal controls (hidden once finished) */}
      {!locked && (
        <section className="flex items-center gap-3">
          <button
            className="px-4 py-2 rounded border font-medium"
            onClick={handleRevealMore}
            disabled={isLastReveal}
          >
            Reveal more
          </button>

          <button className="px-3 py-2 rounded border" onClick={handleJump30} disabled={isLastReveal}>
            Jump to 30s
          </button>
        </section>
      )}

      {/* Hints (hidden once bonus appears) */}
      {showHints && (
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
      )}

      {/* Bonus questions */}
      {showBonus && bonusKeys.length > 0 && (
        <section className="space-y-3 max-w-xl">
          <div className="font-semibold">Bonus questions (only for hints you didn’t flip)</div>

          {bonusKeys.map((k) => {
            const label = k === 'album' ? 'Album' : k === 'singers' ? 'Singer' : 'Key';
            const prev = progress.bonus?.[k];
            const disabled = !!prev;

            const options =
              k === 'album' ? optionPools.albums : k === 'key' ? optionPools.keys : optionPools.singers;

            const placeholder = k === 'singers' ? 'Pick a singer…' : `Pick ${label.toLowerCase()}…`;

            return (
              <div key={k} className="rounded border p-3 space-y-2">
                <div className="text-sm font-semibold">
                  {k === 'singers'
                    ? 'Bonus: Who is a singer on this track?'
                    : `Bonus: What is the ${label.toLowerCase()}?`}
                </div>

                <AutocompleteInput
                  value={bonusInput[k] ?? ''}
                  onChange={(v) => setBonusInput((p) => ({ ...p, [k]: v }))}
                  options={options}
                  placeholder={placeholder}
                  disabled={disabled}
                />

                <div className="flex gap-2">
                  <button
                    className="px-3 py-2 rounded border"
                    onClick={() => submitBonus(k)}
                    disabled={disabled || normalize(bonusInput[k] ?? '').length === 0}
                  >
                    Submit
                  </button>

                  <button className="px-3 py-2 rounded border" onClick={() => passBonus(k)} disabled={disabled}>
                    Pass
                  </button>
                </div>

                {prev && (
                <div className="text-sm space-y-1">
                  {prev.passed ? (
                    <div className="opacity-80">⏭️ Passed.</div>
                  ) : (
                    <div>
                      {prev.correct ? '✅ Correct' : '❌ Not quite'} — you answered:{' '}
                      <span className="font-mono">{prev.answer}</span>
                    </div>
                  )}

                  {/* Always reveal correct answer if passed OR wrong */}
                  {(prev.passed || !prev.correct) && (
                    <div className="opacity-90">
                      Correct answer:{' '}
                      <b>
                        {k === 'album'
                          ? answerAlbum
                          : k === 'key'
                          ? answerKey
                          : answerSingers}
                      </b>
                    </div>
                  )}
                </div>
              )}

              </div>
            );
          })}
        </section>
      )}

      {/* Nav (no duplicate next-song button) */}
      <section className="flex items-center gap-3">
        <button
          className="px-3 py-2 rounded border"
          onClick={() => setSongIndex((i) => Math.max(0, i - 1))}
          disabled={songIndex === 0}
        >
          Prev song
        </button>

        <button
          className="px-3 py-2 rounded border"
          onClick={() => setSongIndex((i) => Math.min(songs.length - 1, i + 1))}
          disabled={songIndex >= songs.length - 1}
        >
          Next song
        </button>

        {locked && isLastSong && <div className="text-sm font-semibold">🎉 Done!</div>}
      </section>

      {/* Debug list */}
      <section className="text-sm">
        <div className="font-semibold mb-2">Today’s set</div>
        <ol className="list-decimal ml-5 space-y-1">
          {songs.map((s, i) => {
            const p = progressMap[s.song_id];
            const badge =
              p?.status === 'solved'
                ? `✅ ${p.guesses}`
                : p?.status === 'gave_up'
                ? `🟨 ${p.guesses}`
                : '';
            return (
              <li key={s.song_id} className={i === songIndex ? 'font-semibold' : ''}>
                <span className="font-mono">{s.song_id}</span>
                {badge && <span className="ml-2 opacity-70">{badge}</span>}
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
