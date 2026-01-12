import { useCallback, useEffect, useState } from 'react';
import { defaultProgress } from './defaults';
import { loadProgressMap, saveProgressMap } from './progressStorage';
import type { Language, SongProgress } from './types';

export function useProgressMap(lang: Language) {
  const [progressMap, setProgressMap] = useState<Record<string, SongProgress>>({});

  useEffect(() => {
    setProgressMap(loadProgressMap(lang));
  }, [lang]);

  const updateProgress = useCallback(
    (songId: string, updater: (p: SongProgress) => SongProgress) => {
      setProgressMap((prev) => {
        const next = { ...prev };
        const cur = next[songId] ?? defaultProgress();
        next[songId] = updater(cur);
        saveProgressMap(lang, next);
        return next;
      });
    },
    [lang]
  );

  return { progressMap, setProgressMap, updateProgress };
}

