'use client';

import { useEffect, useRef } from 'react';

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
    <section className="space-y-2">
      {audioUrl ? <audio ref={audioRef} key={audioKey} controls src={audioUrl} /> : <div>No audio URL</div>}
      <div className="text-xs break-all opacity-60">{audioUrl}</div>
    </section>
  );
}

