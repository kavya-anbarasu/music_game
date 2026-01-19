'use client';

import type { HintKey, SongProgress } from '@/lib/gts/types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

export function HintsSection(props: {
  showHints: boolean;
  progress: SongProgress;
  onFlip: (k: HintKey) => void;
  hintKeys: HintKey[];
  labels: Record<HintKey, string>;
  values: Record<HintKey, string>;
}) {
  const { showHints, progress, onFlip, hintKeys, labels, values } = props;
  if (!showHints) return null;

  return (
    <Card className="space-y-3">
      <div>
        <div className="text-sm font-semibold">Hints</div>
        <div className="text-xs opacity-70">Flip any order (disables bonus for that hint).</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {hintKeys.map((k) => {
          const flipped = progress.revealedHints[k];
          const label = labels[k];
          const value = values[k];

          return (
            <Button
              key={k}
              className="h-auto items-start justify-start rounded-xl p-3 text-left"
              onClick={() => onFlip(k)}
              disabled={flipped}
              title={flipped ? 'Already revealed' : 'Click to reveal'}
            >
              <div className="w-full">
                <div className="text-sm font-semibold">{label}</div>
                <div className="mt-1 text-sm opacity-80">{flipped ? value : 'Click to reveal'}</div>
              </div>
            </Button>
          );
        })}
      </div>
    </Card>
  );
}
