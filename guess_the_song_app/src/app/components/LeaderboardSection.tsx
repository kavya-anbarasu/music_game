'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Language, SongProgress } from '@/lib/gts/types';
import { defaultProgress } from '@/lib/gts/defaults';
import type { TodaysSongRow } from '@/lib/useTodaysSongs';
import { fetchLeaderboard, submitLeaderboardScore, type LeaderboardEntry } from '@/lib/leaderboard';
import { scoreSong } from '@/lib/gts/scoring';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { TextInput } from './ui/TextInput';

function nameStorageKey(lang: Language) {
  return `gts_player_name_${lang}`;
}

function loadName(lang: Language) {
  try {
    return localStorage.getItem(nameStorageKey(lang)) ?? '';
  } catch {
    return '';
  }
}

function saveName(lang: Language, name: string) {
  try {
    localStorage.setItem(nameStorageKey(lang), name);
  } catch {
    // ignore
  }
}

export function LeaderboardSection(props: {
  lang: Language;
  songs: TodaysSongRow[];
  progressMap: Record<string, SongProgress>;
  playDate: string;
  onAcknowledge?: () => void;
}) {
  const { lang, songs, progressMap, playDate, onAcknowledge } = props;
  const [playerName, setPlayerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlayerName(loadName(lang));
  }, [lang]);

  const { totalScore, solvedCount } = useMemo(() => {
    let total = 0;
    let solved = 0;
    for (const row of songs) {
      const p = progressMap[row.song_id] ?? defaultProgress();
      const breakdown = scoreSong(p);
      total += breakdown.total;
      if (p.status === 'solved') solved += 1;
    }
    return { totalScore: total, solvedCount: solved };
  }, [songs, progressMap]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLeaderboard({ playDate, lang, limit: 20 });
      setEntries(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, playDate]);

  async function handleSubmit() {
    const name = playerName.trim();
    if (!name) return;

    setSubmitting(true);
    setError(null);
    try {
      saveName(lang, name);
      await submitLeaderboardScore({ playDate, lang, playerName: name, score: totalScore });
      onAcknowledge?.();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit score');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSkip() {
    onAcknowledge?.();
  }

  return (
    <Card className="space-y-3">
      <div>
        <div className="text-sm font-semibold">Leaderboard</div>
        <div className="text-xs opacity-70">
          {lang} • {playDate}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs opacity-70">Score</div>
          <div className="text-lg font-semibold">{totalScore}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs opacity-70">Solved</div>
          <div className="text-lg font-semibold">
            {solvedCount}/{songs.length}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <TextInput
          className="flex-1"
          placeholder="Your name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          disabled={submitting}
          maxLength={40}
        />
        <Button
          onClick={handleSubmit}
          disabled={submitting || playerName.trim().length === 0}
          variant="primary"
        >
          Submit
        </Button>
        <Button onClick={handleSkip} disabled={submitting} variant="secondary">
          Skip
        </Button>
      </div>

      {error && <div className="text-sm">Error: {error}</div>}

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Top scores</div>
          <Button onClick={refresh} disabled={loading} size="sm" variant="ghost">
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-sm opacity-80">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-sm opacity-80">No entries yet.</div>
        ) : (
          <ol className="space-y-1">
            {entries.map((e, i) => (
              <li key={`${e.player_name}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                <div className="truncate">
                  <span className="opacity-60">{i + 1}.</span> {e.player_name}
                </div>
                <div className="font-mono">{e.score}</div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}
