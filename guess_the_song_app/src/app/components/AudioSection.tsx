'use client';

import { useEffect, useRef } from 'react';
import { Card } from './ui/Card';

export function AudioSection(props: { audioUrl: string | null; audioKey: string }) {
  const { audioUrl, audioKey } = props;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioUrl) return;
    const el = audioRef.current;
    if (!el) return;
    el.load();
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, [audioUrl]);

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Listen</div>
          <div className="text-xs opacity-70">Try to guess from the clip.</div>
        </div>
      </div>

      {audioUrl ? (
        <audio className="w-full" ref={audioRef} key={audioKey} controls src={audioUrl} />
      ) : (
        <div className="text-sm opacity-70">No audio available.</div>
      )}
    </Card>
  );
}
