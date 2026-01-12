'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { matchAlbum, matchKey, matchSingerPick } from '@/lib/gts/matchers';
import { AudioSection } from './AudioSection';
import { GuessSection } from './GuessSection';
import { HintsSection } from './HintsSection';
import { BonusSection } from './BonusSection';
import { SongNav } from './SongNav';
import { TodaysSetList } from './TodaysSetList';

export default function GuessTheSongGame(props: { lang: Language }) {
  const { lang } = props;
  const { songs, loading, error } = useTodaysSongs();

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
    updateProgress(currentSongId, (p) => ({ ...p, status: 'gave_up' }));
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
          revealedSeconds: Math.max(p.revealedSeconds, nextSeconds) as ClipSeconds,
        };
      }

      return { ...p, guesses: nextGuesses, status: 'gave_up' };
    });

    if (!ok) {
      if (!isLastReveal) setRevealIndex((i) => Math.min(CLIP_SECONDS.length - 1, i + 1));
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

  const bonusKeys: HintKey[] = (['album', 'singers', 'key'] as HintKey[]).filter((k) => !progress.revealedHints[k]);

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

      <HintsSection
        showHints={showHints}
        progress={progress}
        onFlip={flipHint}
        answerAlbum={answerAlbum}
        answerSingers={answerSingers}
        answerKey={answerKey}
      />

      <BonusSection
        showBonus={showBonus}
        bonusKeys={bonusKeys}
        progress={progress}
        bonusInput={bonusInput}
        setBonusInput={setBonusInput}
        optionPools={optionPools}
        answerAlbum={answerAlbum}
        answerSingers={answerSingers}
        answerKey={answerKey}
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

      <TodaysSetList songs={songs} songIndex={songIndex} progressMap={progressMap} />
    </main>
  );
}

