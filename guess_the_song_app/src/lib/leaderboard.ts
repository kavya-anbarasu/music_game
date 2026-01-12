import type { Language } from './gts/types';
import { supabase } from './supabase';

export type LeaderboardEntry = {
  player_name: string;
  score: number;
  updated_at: string;
};

export async function fetchLeaderboard(params: { playDate: string; lang: Language; limit?: number }) {
  const { playDate, lang, limit = 20 } = params;
  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select('player_name,score,updated_at')
    .eq('play_date', playDate)
    .eq('lang', lang)
    .order('score', { ascending: false })
    .order('updated_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as LeaderboardEntry[];
}

export async function submitLeaderboardScore(params: {
  playDate: string;
  lang: Language;
  playerName: string;
  score: number;
}) {
  const { playDate, lang, playerName, score } = params;
  const { error } = await supabase.rpc('submit_leaderboard_score', {
    p_play_date: playDate,
    p_lang: lang,
    p_player_name: playerName,
    p_score: score,
  });

  if (error) throw new Error(error.message);
}
