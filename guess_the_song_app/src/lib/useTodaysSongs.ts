'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Language } from './gts/types';

type DailySet = { id: string };
export type TodaysSongRow = { song_id: string; order_index: number };

export function useTodaysSongs(lang: Language) {
  const [songs, setSongs] = useState<TodaysSongRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      // IMPORTANT: use UTC date so everyone sees the same "day"
      const todayUTC = new Date().toISOString().slice(0, 10);

      // 1) fetch today's daily_set id
      const { data: dailySet, error: setErr } = await supabase
        .from('daily_sets')
        .select('id')
        .eq('play_date', todayUTC)
        .eq('language', lang)
        .single<DailySet>();

      if (setErr || !dailySet) {
        if (!cancelled) {
          setError(setErr?.message ?? 'No daily set found for today');
          setSongs([]);
          setLoading(false);
        }
        return;
      }

      // 2) fetch the 5 songs
      const { data, error: songsErr } = await supabase
        .from('daily_set_songs')
        .select('song_id, order_index')
        .eq('daily_set_id', dailySet.id)
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
  }, [lang]);

  return { songs, loading, error };
}
