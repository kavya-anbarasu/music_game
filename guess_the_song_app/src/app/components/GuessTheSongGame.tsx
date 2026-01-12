'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTodaysSongs } from '@/lib/useTodaysSongs';
import { audioPublicUrl, clipObjectPath } from '@/lib/storage';
import englishSongs from '@/data/english_songs.json';
import tamilSongs from '@/data/tamil_songs.json';
import { buildOptionPools } from '@/lib/gts/options';
import { CLIP_SECONDS, type ClipSeconds } from '@/lib/gts/constants';
import type { HintKey, Language, SongMeta, SongProgress } from '@/lib/gts/types';
import { useProgressMap } from '@/lib/gts/useProgressMap';
import { defaultProgress } from '@/lib/gts/defaults';
import { normalize } from '@/lib/gts/text';
import { revealIndexFromSeconds, secondsFromRevealIndex } from '@/lib/gts/reveal';
import { matchSingerPick, matchTextExact } from '@/lib/gts/matchers';
import { AudioSection } from './AudioSection';
import { GuessSection } from './GuessSection';
import { HintsSection } from './HintsSection';
import { BonusSection } from './BonusSection';
import { SongNav } from './SongNav';
import { TodaysSetList } from './TodaysSetList';
import { LeaderboardSection } from './LeaderboardSection';
import { Button } from './ui/Button';

export default function GuessTheSongGame(props: { lang: Language }) {
  const { lang } = props;
  const { songs, loading, error } = useTodaysSongs(lang);

  const [songIndex, setSongIndex] = useState(0);
  const [revealIndex, setRevealIndex] = useState(0);

  const [guess, setGuess] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const [bonusInput, setBonusInput] = useState<Partial<Record<HintKey, string>>>({});
  const { progressMap, updateProgress } = useProgressMap(lang);

  const metaList = useMemo(() => {
    const raw = lang === 'english' ? (englishSongs as SongMeta[]) : (tamilSongs as SongMeta[]);
    return raw;
  }, [lang]);

  const metaById = useMemo(() => {
    const m = new Map<string, SongMeta>();
    metaList.forEach((s) => m.set(s.id, s));
    return m;
  }, [metaList]);

  const optionPools = useMemo(() => buildOptionPools(metaList), [metaList]);

  const currentSongId = songs?.[songIndex]?.song_id;
  const currentMeta = currentSongId ? metaById.get(currentSongId) : undefined;

  const progress: SongProgress = useMemo(() => {
    if (!currentSongId) return defaultProgress();
    return progressMap[currentSongId] ?? defaultProgress();
  }, [progressMap, currentSongId]);

  const locked = progress.status === 'solved' || progress.status === 'gave_up';
  const showBonus = locked;
  const showHints = !showBonus;

  useEffect(() => {
    if (!currentSongId) return;
    setRevealIndex(revealIndexFromSeconds(progress.revealedSeconds));
    setGuess('');
    setSubmitted(null);
    setIsCorrect(null);
    setBonusInput({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSongId]);

  // If a song is finished, always let the user listen to the full 30s clip.
  useEffect(() => {
    if (!currentSongId) return;
    if (progress.status !== 'solved' && progress.status !== 'gave_up') return;
    if (progress.revealedSeconds >= 30) return;
    setRevealIndex(CLIP_SECONDS.length - 1);
    updateProgress(currentSongId, (p) => ({ ...p, revealedSeconds: 30 as ClipSeconds }));
  }, [currentSongId, progress.status, progress.revealedSeconds, updateProgress]);

  const seconds: ClipSeconds = CLIP_SECONDS[Math.min(revealIndex, CLIP_SECONDS.length - 1)];
  const isLastReveal = revealIndex >= CLIP_SECONDS.length - 1;

  const audioUrl = useMemo(() => {
    if (!currentSongId) return null;
    return audioPublicUrl(clipObjectPath(lang, currentSongId, seconds));
  }, [currentSongId, seconds, lang]);

  function handleRevealMore() {
    if (!currentSongId) return;
    const nextRevealIndex = Math.min(CLIP_SECONDS.length - 1, revealIndex + 1);
    const nextSeconds = secondsFromRevealIndex(nextRevealIndex);

    setRevealIndex(nextRevealIndex);
    updateProgress(currentSongId, (p) => ({
      ...p,
      revealedSeconds: Math.max(p.revealedSeconds, nextSeconds) as ClipSeconds,
    }));
  }

  function handleJump30() {
    if (!currentSongId) return;
    const idx = CLIP_SECONDS.length - 1;
    setRevealIndex(idx);
    updateProgress(currentSongId, (p) => ({
      ...p,
      revealedSeconds: Math.max(p.revealedSeconds, 30) as ClipSeconds,
    }));
  }

  function handleGiveUp() {
    if (!currentSongId) return;
    setSubmitted('(gave up)');
    setIsCorrect(false);
    setRevealIndex(CLIP_SECONDS.length - 1);
    updateProgress(currentSongId, (p) => ({
      ...p,
      status: 'gave_up',
      finalSeconds: (p.finalSeconds ?? seconds) as ClipSeconds,
      revealedSeconds: 30 as ClipSeconds,
    }));
  }

  function handleSubmitGuess() {
    if (!currentSongId) return;

    const answer = currentMeta?.title ?? '';
    const ok = normalize(guess) === normalize(answer);

    setSubmitted(guess);
    setIsCorrect(ok);

    updateProgress(currentSongId, (p) => {
      const nextGuesses = p.guesses + 1;

      if (ok) {
        const solvedAt = Math.max(p.revealedSeconds, seconds) as ClipSeconds;
        return {
          ...p,
          guesses: nextGuesses,
          status: 'solved',
          finalSeconds: solvedAt,
          revealedSeconds: 30 as ClipSeconds,
        };
      }

      const curIdx = revealIndexFromSeconds(p.revealedSeconds);
      const isMax = curIdx >= CLIP_SECONDS.length - 1;

      if (!isMax) {
        const nextIdx = Math.min(CLIP_SECONDS.length - 1, curIdx + 1);
        const nextSeconds = secondsFromRevealIndex(nextIdx);
        return {
          ...p,
          guesses: nextGuesses,
          revealedSeconds: Math.max(p.revealedSeconds, nextSeconds) as ClipSeconds,
        };
      }

      return { ...p, guesses: nextGuesses, status: 'gave_up' };
    });

    if (!ok) {
      if (!isLastReveal) setRevealIndex((i) => Math.min(CLIP_SECONDS.length - 1, i + 1));
    } else {
      setRevealIndex(CLIP_SECONDS.length - 1);
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
    if (h === 'album') correct = matchTextExact(user, currentMeta?.album);
    if (h === 'movie') correct = matchTextExact(user, currentMeta?.movie);
    if (h === 'music_director') correct = matchTextExact(user, currentMeta?.music_director);
    if (h === 'key') correct = matchTextExact(user, currentMeta?.key);
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
  const answerMovie = currentMeta?.movie ?? '(none)';
  const answerMusicDirector = currentMeta?.music_director ?? '(none)';
  const answerKey = currentMeta?.key ?? '(none)';
  const answerSingers = (currentMeta?.singers ?? []).join(', ') || '(none)';

  const hintKeys: HintKey[] =
    lang === 'tamil' ? (['movie', 'music_director', 'singers'] as HintKey[]) : (['album', 'singers', 'key'] as HintKey[]);

  const availableHintKeys = hintKeys.filter((k) => {
    if (!currentMeta) return true;
    if (k === 'album') return !!currentMeta.album;
    if (k === 'movie') return !!currentMeta.movie;
    if (k === 'music_director') return !!currentMeta.music_director;
    if (k === 'key') return !!currentMeta.key;
    if (k === 'singers') return (currentMeta.singers ?? []).length > 0;
    return true;
  });

  const bonusKeys: HintKey[] = availableHintKeys.filter((k) => !progress.revealedHints[k]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-white/50">Daily game</div>
          <h1 className="text-3xl font-semibold tracking-tight">Guess the Song</h1>
          <div className="mt-1 text-sm text-white/70">
            Song {songIndex + 1} / {songs.length} • Clip: {seconds}s
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="text-sm text-white/70 hover:text-white">
            Change language
          </Link>
          {!locked && (
            <>
              <Button onClick={handleRevealMore} disabled={isLastReveal} variant="primary" size="sm">
                Reveal more
              </Button>
              <Button onClick={handleJump30} disabled={isLastReveal} size="sm">
                Jump to 30s
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="space-y-4">
          {progress.status === 'solved' && (
            <div className="rounded-2xl border border-green-400/20 bg-green-500/10 p-4 text-sm">
              <span className="font-semibold">Solved.</span> {progress.guesses} {progress.guesses === 1 ? 'guess' : 'guesses'}.
            </div>
          )}
          {progress.status === 'gave_up' && (
            <div className="rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-4 text-sm">
              <span className="font-semibold">Gave up.</span> Answer: <b>{answerTitle}</b>
            </div>
          )}

          <AudioSection audioUrl={audioUrl} audioKey={`${currentSongId}-${seconds}`} />

          <GuessSection
            locked={locked}
            guess={guess}
            setGuess={(v) => {
              setGuess(v);
              setSubmitted(null);
              setIsCorrect(null);
            }}
            submitted={submitted}
            isCorrect={isCorrect}
            onSubmit={handleSubmitGuess}
            onGiveUp={handleGiveUp}
            answerTitle={answerTitle}
            titleOptions={optionPools.titles}
          />

          <HintsSection
            showHints={showHints}
            progress={progress}
            onFlip={flipHint}
            hintKeys={availableHintKeys}
            labels={{
              album: 'Album',
              movie: 'Movie',
              music_director: 'Music director',
              singers: lang === 'tamil' ? 'Singers' : 'Artist',
              key: 'Key',
            }}
            values={{
              album: answerAlbum,
              movie: answerMovie,
              music_director: answerMusicDirector,
              singers: answerSingers,
              key: answerKey,
            }}
          />

          <BonusSection
            showBonus={showBonus}
            bonusKeys={bonusKeys}
            progress={progress}
            bonusInput={bonusInput}
            setBonusInput={setBonusInput}
            optionPools={optionPools}
            labels={{
              album: 'Album',
              movie: 'Movie',
              music_director: 'Music director',
              singers: lang === 'tamil' ? 'Singer' : 'Artist',
              key: 'Key',
            }}
            values={{
              album: answerAlbum,
              movie: answerMovie,
              music_director: answerMusicDirector,
              singers: answerSingers,
              key: answerKey,
            }}
            onSubmitBonus={submitBonus}
            onPassBonus={passBonus}
          />

          <SongNav
            songIndex={songIndex}
            songCount={songs.length}
            locked={locked}
            onPrev={() => setSongIndex((i) => Math.max(0, i - 1))}
            onNext={() => setSongIndex((i) => Math.min(songs.length - 1, i + 1))}
          />
        </div>

        <div className="space-y-4">
          <TodaysSetList songs={songs} songIndex={songIndex} progressMap={progressMap} />
          <LeaderboardSection lang={lang} songs={songs} progressMap={progressMap} />
        </div>
      </div>
    </main>
  );
}
