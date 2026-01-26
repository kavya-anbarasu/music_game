'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Language } from './gts/types';
import { todayPacific } from './gts/progressStorage';

type DailySet = { id: string; created_at: string; play_date: string };
export type TodaysSongRow = { song_id: string; order_index: number };

export function useTodaysSongs(lang: Language, playDate?: string) {
  const [songs, setSongs] = useState<TodaysSongRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sets, setSets] = useState<DailySet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [minPlayDate, setMinPlayDate] = useState<string | null>(null);
  const [maxPlayDate, setMaxPlayDate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      setSongs([]);
      setSets([]);
      setSelectedSetId(null);

      const targetDate = playDate ?? todayPacific();

      const { data: dailySets, error: setErr } = await supabase
        .from('daily_sets')
        .select('id, created_at, play_date')
        .eq('play_date', targetDate)
        .eq('language', lang)
        .order('created_at', { ascending: true });

      if (setErr) {
        if (!cancelled) {
          setError(setErr.message);
          setLoading(false);
        }
        return;
      }

      if (!dailySets || dailySets.length === 0) {
        if (!cancelled) {
          setError('No songs to show for that date.');
          setSelectedSetId(null);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setSets(dailySets);
        setSelectedSetId((prev) => (prev && dailySets.some((s) => s.id === prev) ? prev : dailySets[0].id));
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [lang, playDate]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!selectedSetId) return;
      setLoading(true);
      setError(null);

      const { data, error: songsErr } = await supabase
        .from('daily_set_songs')
        .select('song_id, order_index')
        .eq('daily_set_id', selectedSetId)
        .order('order_index', { ascending: true });

      if (songsErr) {
        if (!cancelled) {
          setError(songsErr.message);
          setSongs([]);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setSongs((data ?? []) as TodaysSongRow[]);
        setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedSetId]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { data: minData, error: minErr } = await supabase
        .from('daily_sets')
        .select('play_date')
        .eq('language', lang)
        .order('play_date', { ascending: true })
        .limit(1);
      if (!cancelled) {
        if (minErr || !minData || minData.length === 0) {
          setMinPlayDate(null);
        } else {
          setMinPlayDate(minData[0].play_date);
        }
      }

      const { data: maxData, error: maxErr } = await supabase
        .from('daily_sets')
        .select('play_date')
        .eq('language', lang)
        .order('play_date', { ascending: false })
        .limit(1);
      if (!cancelled) {
        if (maxErr || !maxData || maxData.length === 0) {
          setMaxPlayDate(null);
        } else {
          setMaxPlayDate(maxData[0].play_date);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  return {
    songs,
    loading,
    error,
    sets,
    selectedSetId,
    setSelectedSetId,
    minPlayDate,
    maxPlayDate,
  };
}
